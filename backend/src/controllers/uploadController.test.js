import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/documentStore.js', () => ({
    getDocument: vi.fn(),
    getOwner: vi.fn(),
    getBuffer: vi.fn()
}));

vi.mock('../services/pdfService.js', () => ({
    extractPageRange: vi.fn(),
    extractPdfData: vi.fn()
}));

const documentStore = await import('../services/documentStore.js');
const { extractPageRange } = await import('../services/pdfService.js');
const { getDocumentPages } = await import('./uploadController.js');

const makeContext = ({ userId = 'user-1', params = {}, query = {}, env = {} } = {}) => ({
    env,
    get: (key) => (key === 'userId' ? userId : undefined),
    req: {
        param: (key) => params[key],
        query: (key) => query[key]
    },
    json: (body, status = 200) => ({ body, status })
});

describe('getDocumentPages', () => {
    it('returns extracted pages on a successful response', async () => {
        documentStore.getDocument.mockResolvedValue({ id: 'doc_1', metadata: { pageCount: 5 } });
        documentStore.getOwner.mockResolvedValue('user-1');
        documentStore.getBuffer.mockResolvedValue(new Uint8Array([1, 2, 3]));
        extractPageRange.mockResolvedValue({
            pages: [{ num: 1, text: 'real extracted text' }],
            total: 5
        });

        const result = await getDocumentPages(
            makeContext({ params: { id: 'doc_1' }, query: { first: '1', last: '1' } })
        );

        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            success: true,
            pages: [{ num: 1, text: 'real extracted text' }],
            total: 5
        });
    });

    // The bug this guards against: the frontend used to treat any non-2xx/failed
    // response identically to genuinely-empty text. This asserts the backend side of
    // the fix — the real parser error message reaches the response body instead of
    // being replaced by a generic string.
    it('surfaces the real parse-failure reason on a failed response, not a generic message', async () => {
        documentStore.getDocument.mockResolvedValue({ id: 'doc_1', metadata: { pageCount: 5 } });
        documentStore.getOwner.mockResolvedValue('user-1');
        documentStore.getBuffer.mockResolvedValue(new Uint8Array([1, 2, 3]));
        const parseError = new Error('Failed to extract the requested pages: Invalid PDF structure.');
        parseError.userFacing = true;
        extractPageRange.mockRejectedValue(parseError);

        const result = await getDocumentPages(
            makeContext({ params: { id: 'doc_1' }, query: { first: '1', last: '1' } })
        );

        expect(result.status).toBe(500);
        expect(result.body.success).toBe(false);
        expect(result.body.error).toBe('Failed to extract the requested pages: Invalid PDF structure.');
    });

    it('returns 404 for a document owned by a different user, without leaking existence', async () => {
        documentStore.getDocument.mockResolvedValue({ id: 'doc_1', metadata: { pageCount: 5 } });
        documentStore.getOwner.mockResolvedValue('someone-else');

        const result = await getDocumentPages(
            makeContext({ userId: 'user-1', params: { id: 'doc_1' }, query: { first: '1', last: '1' } })
        );

        expect(result.status).toBe(404);
        expect(result.body).toEqual({ success: false, error: 'File not found.' });
    });
});
