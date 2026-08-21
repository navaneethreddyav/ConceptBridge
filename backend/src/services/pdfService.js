// Deviation from the pre-migration audit, documented here since it was flagged as the
// single highest-uncertainty item in the whole migration: `pdf-parse` (its pdf.js-based
// "browser" build, `pdf-parse/dist/pdf-parse/web/pdf-parse.es.js`) throws
// `ReferenceError: DOMMatrix is not defined` as soon as it's `require()`'d under
// `wrangler dev` (workerd) — confirmed by actually running it, not just reading the
// source. `DOMMatrix` is a browser Canvas API workerd doesn't provide, pulled in by
// pdf.js's rendering/canvas code path even when only text extraction is used. Swapped
// to `unpdf`, which ships a PDF.js build specifically compiled for serverless/edge
// runtimes (no DOM/canvas globals required for text extraction) and confirmed working
// under `wrangler dev` with a real PDF (see stage-1 test results).
//
// To preserve the original "N pages costs the same as the whole 500+ page book" bound
// (the whole reason `first`/`last` exist here), pages are extracted one at a time via
// the raw PDF.js document proxy (`pdf.getPage(n)` + `getTextContent()`) instead of
// unpdf's higher-level `extractText()` helper, which always walks every page.
import { getDocumentProxy, getMeta } from 'unpdf';

const extractPageText = async (pdf, pageNum) => {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    return content.items.map((item) => item.str).join(' ');
};

/**
 * Extracts text and metadata from a PDF buffer.
 * @param {Uint8Array} buffer - The PDF file bytes
 * @param {Object} [options]
 * @param {number} [options.first] - If set, only extract text for the first N pages.
 *   `pageCount` still reflects the whole document regardless of this bound — only the
 *   returned `text` is limited. Keeps this call fast and memory-bounded independent of
 *   how large the document actually is.
 * @returns {Promise<Object>} - The parsed PDF data
 */
const extractPdfData = async (buffer, { first } = {}) => {
    let pdf;
    try {
        pdf = await getDocumentProxy(Uint8Array.from(buffer));
        const totalPages = pdf.numPages;
        const lastPage = first ? Math.min(first, totalPages) : totalPages;

        const pageTexts = [];
        for (let pageNum = 1; pageNum <= lastPage; pageNum++) {
            pageTexts.push(await extractPageText(pdf, pageNum));
        }

        const { info } = await getMeta(pdf);

        return {
            text: pageTexts.join('\n\n'),
            pageCount: totalPages,
            info: info || null,
            metadata: null
        };
    } catch (error) {
        console.error('Error parsing PDF:', error);
        throw new Error('Failed to parse PDF. The file might be corrupted or a scanned image.');
    } finally {
        // PDFDocumentProxy (what getDocumentProxy resolves to) exposes `cleanup()`, not
        // `destroy()` — `destroy()` lives on the loading task, one layer up.
        if (pdf) {
            await pdf.cleanup().catch(() => {});
        }
    }
};

/**
 * Extracts text for a specific inclusive page range, for on-demand fetching (e.g. the
 * text-fallback reader view) without ever re-extracting the whole document.
 * @param {Uint8Array} buffer
 * @param {number} first - 1-indexed, inclusive
 * @param {number} last - 1-indexed, inclusive
 * @returns {Promise<{pages: Array<{num: number, text: string}>, total: number}>}
 */
const extractPageRange = async (buffer, first, last) => {
    let pdf;
    try {
        pdf = await getDocumentProxy(Uint8Array.from(buffer));
        const totalPages = pdf.numPages;
        const boundedLast = Math.min(last, totalPages);

        const pages = [];
        for (let pageNum = first; pageNum <= boundedLast; pageNum++) {
            pages.push({ num: pageNum, text: await extractPageText(pdf, pageNum) });
        }

        return { pages, total: totalPages };
    } catch (error) {
        console.error('Error parsing PDF page range:', error);
        throw new Error('Failed to extract the requested pages.');
    } finally {
        if (pdf) {
            await pdf.cleanup().catch(() => {});
        }
    }
};

export { extractPdfData, extractPageRange };
