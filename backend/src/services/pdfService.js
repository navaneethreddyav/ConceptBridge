const pdf = require('pdf-parse');

/**
 * Extracts text and metadata from a PDF buffer.
 * @param {Buffer} buffer - The PDF file buffer
 * @returns {Promise<Object>} - The parsed PDF data
 */
const extractPdfData = async (buffer) => {
    try {
        const data = await pdf(buffer);
        return {
            text: data.text,
            pageCount: data.numpages,
            info: data.info,
            metadata: data.metadata
        };
    } catch (error) {
        console.error('Error parsing PDF:', error);
        throw new Error('Failed to parse PDF. The file might be corrupted or a scanned image.');
    }
};

module.exports = {
    extractPdfData
};
