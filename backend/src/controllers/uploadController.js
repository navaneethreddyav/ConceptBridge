const fileValidationService = require('../services/fileValidationService');
const documentService = require('../services/documentService');
const pdfService = require('../services/pdfService');
const documentStore = require('../services/documentStore');
const quotaService = require('../services/quotaService');
const { sendError } = require('../utils/errorResponse');

const MAX_PAGE_RANGE = 10;

const handleUpload = async (req, res) => {
    try {
        const file = req.file;
        const ownerId = req.userId;

        const validation = fileValidationService.validatePdfFile(file);
        if (!validation.isValid) {
            return res.status(400).json({ success: false, error: validation.error });
        }

        // Quota check happens BEFORE PDF processing (text extraction) so an
        // over-quota upload never pays that cost just to be rejected afterward.
        // file.size is multer's measured byte count, never a client-supplied value.
        const { ok, usage } = quotaService.checkQuota(ownerId, file.size);
        if (!ok) {
            return res.status(507).json({
                success: false,
                error: 'Your free storage limit of 100 MB has been reached. Delete existing PDFs or upgrade your storage.',
                usage
            });
        }

        const { document, sampleText } = await documentService.processDocument(file, ownerId);

        const existing = documentStore.getDocument(document.id);
        if (existing && documentStore.getOwner(document.id) === ownerId) {
            existing.filename = file.originalname;
            documentStore.saveBuffer(existing.id, file.buffer);
            return res.status(200).json({
                success: true,
                document: existing,
                reused: true,
                usage: quotaService.getUsage(ownerId)
            });
        }

        documentStore.saveDocument(document, ownerId);
        documentStore.saveBuffer(document.id, file.buffer);
        documentStore.saveSampleText(document.id, sampleText);

        return res.status(200).json({
            success: true,
            document,
            usage: quotaService.getUsage(ownerId)
        });
    } catch (error) {
        console.error('Upload handling error:', error);
        return sendError(res, error, 'An error occurred while processing the PDF.');
    }
};

const getDocumentFile = (req, res) => {
    const { id } = req.params;
    const doc = documentStore.getDocument(id);
    const buffer = documentStore.getBuffer(id);

    // 404 (not 403) on ownership mismatch — doesn't reveal to an unauthorized
    // requester that a document with this id even exists.
    if (!doc || !buffer || documentStore.getOwner(id) !== req.userId) {
        return res.status(404).json({ success: false, error: 'File not found.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.send(buffer);
};

const getDocumentPages = async (req, res) => {
    try {
        const { id } = req.params;
        const doc = documentStore.getDocument(id);
        const buffer = documentStore.getBuffer(id);

        if (!doc || !buffer || documentStore.getOwner(id) !== req.userId) {
            return res.status(404).json({ success: false, error: 'File not found.' });
        }

        const totalPages = doc.metadata?.pageCount || 1;
        let first = Math.max(1, parseInt(req.query.first, 10) || 1);
        let last = Math.max(first, parseInt(req.query.last, 10) || first);
        first = Math.min(first, totalPages);
        last = Math.min(last, totalPages, first + MAX_PAGE_RANGE - 1);

        const { pages, total } = await pdfService.extractPageRange(buffer, first, last);
        return res.status(200).json({ success: true, pages, total });
    } catch (error) {
        console.error('Page extraction error:', error);
        return sendError(res, error, 'Failed to extract the requested pages.');
    }
};

const listDocuments = (req, res) => {
    const documents = documentStore.listDocuments(req.userId);
    return res.status(200).json({ success: true, documents, usage: quotaService.getUsage(req.userId) });
};

const getUsage = (req, res) => {
    return res.status(200).json({ success: true, usage: quotaService.getUsage(req.userId) });
};

const deleteDocument = (req, res) => {
    const deleted = documentStore.deleteDocument(req.params.id, req.userId);
    if (!deleted) {
        return res.status(404).json({ success: false, error: 'Document not found.' });
    }
    return res.status(200).json({ success: true, usage: quotaService.getUsage(req.userId) });
};

module.exports = {
    handleUpload,
    getDocumentFile,
    getDocumentPages,
    listDocuments,
    getUsage,
    deleteDocument
};
