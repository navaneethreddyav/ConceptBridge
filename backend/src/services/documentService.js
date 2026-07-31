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

    // Create the structured document object for future compatibility
    const document = {
        id: `doc_${Date.now()}`,
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
