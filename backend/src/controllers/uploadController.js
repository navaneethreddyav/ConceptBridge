const fileValidationService = require('../services/fileValidationService');
const documentService = require('../services/documentService');
const { sendError } = require('../utils/errorResponse');

const handleUpload = async (req, res) => {
    try {
        const file = req.file;

        // 1. Validation
        const validation = fileValidationService.validatePdfFile(file);
        if (!validation.isValid) {
            return res.status(400).json({ success: false, error: validation.error });
        }

        // 2. Process Document
        const document = await documentService.processDocument(file);

        // 3. Save to in-memory store — but if this exact content was already uploaded
        // this session (document.id is a content hash), reuse the existing record
        // instead of overwriting it. Overwriting would wipe any concepts already
        // cached on it, forcing a free-tier Gemini re-analysis for no reason.
        const documentStore = require('../services/documentStore');
        const existing = documentStore.getDocument(document.id);

        if (existing) {
            // Content matched, but this upload's filename may differ from the one
            // that first produced this record (e.g. a renamed copy) — keep the
            // display name current without touching the cached concepts/analysis.
            existing.filename = file.originalname;
            documentStore.saveBuffer(existing.id, file.buffer);
            return res.status(200).json({
                success: true,
                document: existing,
                reused: true
            });
        }

        documentStore.saveDocument(document);
        documentStore.saveBuffer(document.id, file.buffer);

        // 4. Return Response
        return res.status(200).json({
            success: true,
            document: document
        });

    } catch (error) {
        console.error('Upload handling error:', error);
        return sendError(res, error, 'An error occurred while processing the PDF.');
    }
};

const getDocumentFile = (req, res) => {
    const documentStore = require('../services/documentStore');
    const buffer = documentStore.getBuffer(req.params.id);

    if (!buffer) {
        return res.status(404).json({ success: false, error: 'File not found.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    // helmet defaults to same-origin CORP, which would block the browser PDF viewer
    // from loading this file from the frontend origin.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.send(buffer);
};

module.exports = {
    handleUpload,
    getDocumentFile
};
