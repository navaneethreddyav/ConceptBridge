import { validatePdfFile } from '../services/fileValidationService.js';
import { extractPageRange } from '../services/pdfService.js';
import * as documentService from '../services/documentService.js';
import * as documentStore from '../services/documentStore.js';
import * as quotaService from '../services/quotaService.js';

const MAX_PAGE_RANGE = 10;

// Local error helper (Hono-flavored `c.json(...)`) rather than reusing
// `utils/errorResponse.js`, which is still Express-`res`-shaped and is shared by the
// stage-2-owned controllers (concept/explanation/media/ai) — not touched here so as not
// to break those files further before stage 2 ports them onto Hono too.
const sendError = (c, error, fallbackMessage) => {
    return c.json({
        success: false,
        error: error.userFacing ? error.message : fallbackMessage,
        details: c.env?.NODE_ENV === 'development' ? error.message : undefined
    }, error.statusCode || 500);
};

const handleUpload = async (c) => {
    try {
        const env = c.env;
        const ownerId = c.get('userId');

        const body = await c.req.parseBody();
        const uploaded = body['pdf'];

        // Hono's parseBody() gives back a Web File for a real file field, or a plain
        // string if the field was missing/sent as text — either way, "no usable file".
        if (!uploaded || typeof uploaded === 'string') {
            return c.json({ success: false, error: 'No file provided.' }, 400);
        }

        // fileValidationService expects Multer's field names (mimetype/originalname);
        // adapt the Web File's shape at the call site rather than changing that
        // (unchanged-per-audit) service.
        const fileForValidation = {
            mimetype: uploaded.type,
            originalname: uploaded.name,
            size: uploaded.size
        };
        const validation = validatePdfFile(fileForValidation);
        if (!validation.isValid) {
            return c.json({ success: false, error: validation.error }, 400);
        }

        // Quota check happens BEFORE PDF processing (text extraction) so an
        // over-quota upload never pays that cost just to be rejected afterward.
        // uploaded.size is the Workers runtime's measured byte count, never a
        // client-supplied value.
        const { ok, usage } = await quotaService.checkQuota(env, ownerId, uploaded.size);
        if (!ok) {
            return c.json({
                success: false,
                error: 'Your free storage limit of 100 MB has been reached. Delete existing PDFs or upgrade your storage.',
                usage
            }, 507);
        }

        const bytes = new Uint8Array(await uploaded.arrayBuffer());

        const { document, sampleText } = await documentService.processDocument(
            { buffer: bytes, originalname: uploaded.name, size: uploaded.size },
            ownerId
        );

        const existing = await documentStore.getDocument(env, document.id);
        if (existing) {
            const existingOwner = await documentStore.getOwner(env, document.id);
            if (existingOwner === ownerId) {
                await documentStore.updateFilename(env, existing.id, document.filename);
                await documentStore.saveBuffer(env, existing.id, bytes);
                existing.filename = document.filename;
                return c.json({
                    success: true,
                    document: existing,
                    reused: true,
                    usage: await quotaService.getUsage(env, ownerId)
                }, 200);
            }
        }

        await documentStore.saveDocument(env, document, ownerId);
        await documentStore.saveBuffer(env, document.id, bytes);
        await documentStore.saveSampleText(env, document.id, sampleText);

        return c.json({
            success: true,
            document,
            usage: await quotaService.getUsage(env, ownerId)
        }, 200);
    } catch (error) {
        console.error('Upload handling error:', error);
        return sendError(c, error, 'An error occurred while processing the PDF.');
    }
};

const getDocumentFile = async (c) => {
    const env = c.env;
    const userId = c.get('userId');
    const id = c.req.param('id');

    const doc = await documentStore.getDocument(env, id);
    const owner = doc ? await documentStore.getOwner(env, id) : null;

    // 404 (not 403) on ownership mismatch — doesn't reveal to an unauthorized
    // requester that a document with this id even exists.
    if (!doc || owner !== userId) {
        return c.json({ success: false, error: 'File not found.' }, 404);
    }

    const buffer = await documentStore.getBuffer(env, id);
    if (!buffer) {
        return c.json({ success: false, error: 'File not found.' }, 404);
    }

    c.header('Content-Type', 'application/pdf');
    c.header('Cross-Origin-Resource-Policy', 'cross-origin');
    return c.body(buffer, 200);
};

const getDocumentPages = async (c) => {
    try {
        const env = c.env;
        const userId = c.get('userId');
        const id = c.req.param('id');

        const doc = await documentStore.getDocument(env, id);
        const owner = doc ? await documentStore.getOwner(env, id) : null;
        if (!doc || owner !== userId) {
            return c.json({ success: false, error: 'File not found.' }, 404);
        }

        const buffer = await documentStore.getBuffer(env, id);
        if (!buffer) {
            return c.json({ success: false, error: 'File not found.' }, 404);
        }

        const totalPages = doc.metadata?.pageCount || 1;
        let first = Math.max(1, parseInt(c.req.query('first'), 10) || 1);
        let last = Math.max(first, parseInt(c.req.query('last'), 10) || first);
        first = Math.min(first, totalPages);
        last = Math.min(last, totalPages, first + MAX_PAGE_RANGE - 1);

        const { pages, total } = await extractPageRange(buffer, first, last);
        return c.json({ success: true, pages, total }, 200);
    } catch (error) {
        console.error('Page extraction error:', error);
        return sendError(c, error, 'Failed to extract the requested pages.');
    }
};

const listDocuments = async (c) => {
    const env = c.env;
    const userId = c.get('userId');
    const documents = await documentStore.listDocuments(env, userId);
    return c.json({ success: true, documents, usage: await quotaService.getUsage(env, userId) }, 200);
};

const getUsage = async (c) => {
    const env = c.env;
    const userId = c.get('userId');
    return c.json({ success: true, usage: await quotaService.getUsage(env, userId) }, 200);
};

const deleteDocument = async (c) => {
    const env = c.env;
    const userId = c.get('userId');
    const id = c.req.param('id');

    const deleted = await documentStore.deleteDocument(env, id, userId);
    if (!deleted) {
        return c.json({ success: false, error: 'Document not found.' }, 404);
    }
    return c.json({ success: true, usage: await quotaService.getUsage(env, userId) }, 200);
};

export {
    handleUpload,
    getDocumentFile,
    getDocumentPages,
    listDocuments,
    getUsage,
    deleteDocument
};
