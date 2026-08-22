import { describe, expect, it, vi } from 'vitest';

const fakePage = (text) => ({
    getTextContent: async () => ({ items: text === null ? [] : [{ str: text }] })
});

const fakePdf = ({ numPages, pageText, failOnGetPage = false }) => ({
    numPages,
    getPage: async (n) => {
        if (failOnGetPage) throw new Error('Invalid PDF structure.');
        return fakePage(pageText(n));
    },
    cleanup: async () => {}
});

vi.mock('unpdf', () => ({
    getDocumentProxy: vi.fn(),
    getMeta: vi.fn(async () => ({ info: { Title: 'Test' } }))
}));

const { getDocumentProxy } = await import('unpdf');
const { extractPdfData, extractPageRange } = await import('./pdfService.js');

describe('pdfService', () => {
    it('extractPageRange returns real text for a well-formed PDF', async () => {
        getDocumentProxy.mockResolvedValue(
            fakePdf({ numPages: 3, pageText: (n) => `page ${n} text` })
        );

        const result = await extractPageRange(new Uint8Array([1]), 1, 2);

        expect(result.total).toBe(3);
        expect(result.pages).toEqual([
            { num: 1, text: 'page 1 text' },
            { num: 2, text: 'page 2 text' }
        ]);
    });

    // "Empty extracted text" is a genuine, non-error outcome (e.g. a page with no
    // text layer) — it must NOT be conflated with a parser failure.
    it('extractPageRange returns an empty string for a page with no text, without throwing', async () => {
        getDocumentProxy.mockResolvedValue(
            fakePdf({ numPages: 1, pageText: () => null })
        );

        const result = await extractPageRange(new Uint8Array([1]), 1, 1);

        expect(result.pages).toEqual([{ num: 1, text: '' }]);
    });

    it('extractPageRange wraps a genuine parse failure as a safe, userFacing error', async () => {
        getDocumentProxy.mockResolvedValue(
            fakePdf({ numPages: 1, pageText: () => '', failOnGetPage: true })
        );

        await expect(extractPageRange(new Uint8Array([1]), 1, 1)).rejects.toMatchObject({
            userFacing: true,
            message: expect.stringContaining('Invalid PDF structure.')
        });
    });

    it('extractPdfData wraps a genuine parse failure as a safe, userFacing error', async () => {
        getDocumentProxy.mockRejectedValue(new Error('PasswordException: No password given'));

        await expect(extractPdfData(new Uint8Array([1]))).rejects.toMatchObject({
            userFacing: true,
            message: expect.stringContaining('PasswordException: No password given')
        });
    });

    it('extractPdfData succeeds and returns joined text for a well-formed PDF', async () => {
        getDocumentProxy.mockResolvedValue(
            fakePdf({ numPages: 2, pageText: (n) => `p${n}` })
        );

        const result = await extractPdfData(new Uint8Array([1]));

        expect(result.pageCount).toBe(2);
        expect(result.text).toBe('p1\n\np2');
    });
});
