const { PDFParse } = require('pdf-parse');

/**
 * Extracts text and metadata from a PDF buffer.
 * @param {Buffer} buffer - The PDF file buffer
 * @param {Object} [options]
 * @param {number} [options.first] - If set, only extract text for the first N pages.
 *   `total`/`pageCount` still reflect the whole document regardless of this bound —
 *   only the returned `text` is limited. Keeps this call fast and memory-bounded
 *   independent of how large the document actually is (a 500+ page book costs the
 *   same as a 20-page one here).
 * @returns {Promise<Object>} - The parsed PDF data
 */
const extractPdfData = async (buffer, { first } = {}) => {
    let parser;
    try {
        // pdf.js transfers the backing buffer to its worker, so pass a copy and
        // run the two reads sequentially rather than in parallel.
        parser = new PDFParse({ data: Uint8Array.from(buffer) });
        const text = await parser.getText(first ? { first } : undefined);
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

/**
 * Extracts text for a specific inclusive page range, for on-demand fetching (e.g. the
 * text-fallback reader view) without ever re-extracting the whole document.
 * @param {Buffer} buffer
 * @param {number} first - 1-indexed, inclusive
 * @param {number} last - 1-indexed, inclusive
 * @returns {Promise<{pages: Array<{num: number, text: string}>, total: number}>}
 */
const extractPageRange = async (buffer, first, last) => {
    let parser;
    try {
        parser = new PDFParse({ data: Uint8Array.from(buffer) });
        const result = await parser.getText({ first, last });
        return { pages: result.pages || [], total: result.total || 0 };
    } catch (error) {
        console.error('Error parsing PDF page range:', error);
        throw new Error('Failed to extract the requested pages.');
    } finally {
        if (parser) {
            await parser.destroy().catch(() => {});
        }
    }
};

module.exports = {
    extractPdfData,
    extractPageRange
};
