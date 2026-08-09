const { PDFParse } = require('pdf-parse');

/**
 * Extracts text and metadata from a PDF buffer.
 * @param {Buffer} buffer - The PDF file buffer
 * @returns {Promise<Object>} - The parsed PDF data
 */
const extractPdfData = async (buffer) => {
    let parser;
    try {
        // pdf.js transfers the backing buffer to its worker, so pass a copy and
        // run the two reads sequentially rather than in parallel.
        parser = new PDFParse({ data: Uint8Array.from(buffer) });
        const text = await parser.getText();
        const info = await parser.getInfo();

        return {
            text: text.text || '',
            pageCount: text.total || 0,
            info: info.info || null,
            metadata: info.metadata || null
        };
    } catch (error) {
        console.error('Error parsing PDF:', error);
        throw new Error('Failed to parse PDF. The file might be corrupted or a scanned image.');
    } finally {
        if (parser) {
            await parser.destroy().catch(() => {});
        }
    }
};

module.exports = {
    extractPdfData
};
