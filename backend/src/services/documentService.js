import { extractPdfData } from './pdfService.js';

// Only the first N pages are extracted at upload time, regardless of how long the
// document actually is — this is what keeps the upload request fast and memory-bounded
// for a 500+ page textbook. It's also all that's needed for the auto-detect/highlight
// sample and the explanation context safety net; the reader gets the rest of the
// document's text on demand, page range by page range, via pdfService.extractPageRange.
const SAMPLE_PAGES = 20;

/**
 * SHA-256 hex digest via Web Crypto (`crypto.subtle`), the Workers-compatible
 * replacement for Node's synchronous `require('crypto').createHash('sha256')` — the
 * latter isn't available in the Workers runtime. `crypto` itself needs no import; it's
 * a Workers/browser global (same one `crypto.randomUUID()` already relies on).
 * @returns {Promise<string>}
 */
const sha256Hex = async (input) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Processes a PDF file and returns a structured document object plus its bounded text
 * sample. The sample is kept out of the document object on purpose — that object is
 * JSON-serialized straight into the /api/upload response, and the full extracted text
 * of a large document has no business travelling over the wire or living in the
 * browser's React state.
 * @param {Object} file - { buffer: Uint8Array, originalname: string, size: number }
 * @param {string} ownerId - the requesting owner's identity-cookie id
 * @returns {Promise<{document: Object, sampleText: string}>}
 */
const processDocument = async (file, ownerId) => {
    const { text, pageCount, info } = await extractPdfData(file.buffer, { first: SAMPLE_PAGES });

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
    // ownerId is folded into the hash so two different owners uploading identical
    // content land on different ids (independent quota accounting, no cross-owner
    // collision) while the same owner re-uploading their own file still dedupes.
    const contentHash = (await sha256Hex(`${ownerId}:${cleanedText}`)).slice(0, 16);

    // Create the structured document object for future compatibility. sizeBytes is
    // the actual measured upload size (Web File.size, from Hono's parseBody) — the
    // authoritative figure quota accounting sums, never a re-derived or client-supplied
    // number.
    const document = {
        id: `doc_${contentHash}`,
        filename: file.originalname,
        sizeBytes: file.size,
        metadata: {
            pageCount: pageCount,
            title: info?.Title || file.originalname,
            author: info?.Author || 'Unknown',
            createdAt: new Date().toISOString()
        }
    };

    return { document, sampleText: cleanedText };
};

export { processDocument, SAMPLE_PAGES };
