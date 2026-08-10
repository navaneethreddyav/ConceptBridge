const fileValidationService = require('../services/fileValidationService');
const documentService = require('../services/documentService');
const pdfService = require('../services/pdfService');
const documentStore = require('../services/documentStore');
const { sendError } = require('../utils/errorResponse');

// Hard ceiling on how many pages a single /pages request can extract, independent of
// whatever the caller asks for — keeps every on-demand extraction bounded and fast
// regardless of document size, the same guarantee the upload-time sample relies on.
const MAX_PAGE_RANGE = 10;

const handleUpload = async (req, res) => {
    try {
        const file = req.file;

        // 1. Validation
        const validation = fileValidationService.validatePdfFile(file);
        if (!validation.isValid) {
            return res.status(400).json({ success: false, error: validation.error });
        }

        // 2. Process Document (bounded — only the first N pages are ever extracted here,
        // regardless of the document's actual length)
        const { document, sampleText } = await documentService.processDocument(file);

        // 3. Save to in-memory store — but if this exact content was already uploaded
        // this session (document.id is a content hash), reuse the existing record
        // instead of overwriting it. Overwriting would wipe any concepts already
        // cached on it, forcing a free-tier Gemini re-analysis for no reason.
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
        documentStore.saveSampleText(document.id, sampleText);

        // 4. Return Response — no extracted text of any size travels over the wire here.
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

/**
 * On-demand page text, for the text-fallback reader view (used when the PDF itself
 * fails to render). Never extracts more than MAX_PAGE_RANGE pages in one call, no
 * matter what range is requested, and never touches the whole document.
 */
const getDocumentPages = async (req, res) => {
    try {
        const buffer = documentStore.getBuffer(req.params.id);
        const doc = documentStore.getDocument(req.params.id);

        if (!buffer || !doc) {
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

module.exports = {
    handleUpload,
    getDocumentFile,
    getDocumentPages
};
