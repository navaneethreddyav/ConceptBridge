const crypto = require('crypto');
const pdfService = require('./pdfService');

// Only the first N pages are extracted at upload time, regardless of how long the
// document actually is — this is what keeps the upload request fast and memory-bounded
// for a 500+ page textbook. It's also all that's needed for the auto-detect/highlight
// sample and the explanation context safety net; the reader gets the rest of the
// document's text on demand, page range by page range, via pdfService.extractPageRange.
const SAMPLE_PAGES = 20;

/**
 * Processes a PDF file and returns a structured document object plus its bounded text
 * sample. The sample is kept out of the document object on purpose — that object is
 * JSON-serialized straight into the /api/upload response, and the full extracted text
 * of a large document has no business travelling over the wire or living in the
 * browser's React state.
 * @param {Object} file - The uploaded file object (multer)
 * @returns {Promise<{document: Object, sampleText: string}>}
 */
const processDocument = async (file) => {
    const { text, pageCount, info } = await pdfService.extractPdfData(file.buffer, { first: SAMPLE_PAGES });

    // Clean up text slightly (remove excessive newlines, trim)
    const cleanedText = text
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    // Content-derived ID (not a timestamp): re-uploading the same PDF — e.g. after a
    // page reload wipes client state — reproduces the same ID, so the concept-detection
    // and explanation caches (both keyed by documentId) transparently hit instead of
    // re-spending free-tier Gemini quota on a document already analyzed this session.
    // Hashing the bounded sample rather than the full text is a deliberate tradeoff:
    // two different documents that happen to share identical first-N pages (rare) would
    // incorrectly dedupe, but requiring a full-document pass just to compute a dedupe
    // key would reintroduce the exact cost this function exists to avoid.
    const contentHash = crypto.createHash('sha256').update(cleanedText).digest('hex').slice(0, 16);

    // Create the structured document object for future compatibility
    const document = {
        id: `doc_${contentHash}`,
        filename: file.originalname,
        metadata: {
            pageCount: pageCount,
            title: info?.Title || file.originalname,
            author: info?.Author || 'Unknown',
            createdAt: new Date().toISOString()
        }
    };

    return { document, sampleText: cleanedText };
};

module.exports = {
    processDocument,
    SAMPLE_PAGES
};
