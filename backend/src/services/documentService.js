const crypto = require('crypto');
const pdfService = require('./pdfService');

/**
 * Processes a PDF file and returns a structured document object.
 * @param {Object} file - The uploaded file object (multer)
 * @returns {Promise<Object>} - Structured document representation
 */
const processDocument = async (file) => {
    // Extract text and basic info using pdfService
    const { text, pageCount, info } = await pdfService.extractPdfData(file.buffer);

    // Clean up text slightly (remove excessive newlines, trim)
    const cleanedText = text
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    // Content-derived ID (not a timestamp): re-uploading the same PDF — e.g. after a
    // page reload wipes client state — reproduces the same ID, so the concept-detection
    // and explanation caches (both keyed by documentId) transparently hit instead of
    // re-spending free-tier Gemini quota on a document already analyzed this session.
    const contentHash = crypto.createHash('sha256').update(cleanedText).digest('hex').slice(0, 16);

    // Create the structured document object for future compatibility
    const document = {
        id: `doc_${contentHash}`,
        filename: file.originalname,
        metadata: {
            pageCount: pageCount,
            extractedTextLength: cleanedText.length,
            title: info?.Title || file.originalname,
            author: info?.Author || 'Unknown',
            createdAt: new Date().toISOString()
        },
        content: {
            rawText: cleanedText,
            // In future milestones, we will add 'concepts', 'sections', etc. here
        }
    };

    return document;
};

module.exports = {
    processDocument
};
