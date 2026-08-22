import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import DocumentReader from './DocumentReader.jsx';

// react-pdf's <Document>/<Page> need real PDF-worker/canvas machinery unsuitable for
// a unit test — mocked out, exposing the props DocumentReader passes so tests can
// call onLoadError/onSourceError directly, the same way pdf.js would.
const documentPropsRef = { current: null };

vi.mock('react-pdf', () => ({
    Document: (props) => {
        documentPropsRef.current = props;
        return props.children ?? null;
    },
    Page: () => null,
    pdfjs: { GlobalWorkerOptions: {} }
}));

const doc = { id: 'doc_1', filename: 'test.pdf', metadata: { pageCount: 1 } };

const setupFetch = (pagesResponse) => {
    global.fetch = vi.fn((url) => {
        if (String(url).includes('/api/concepts/detect')) {
            return Promise.resolve({ ok: true, json: async () => ({ success: true, concepts: [] }) });
        }
        if (String(url).includes('/pages')) {
            return Promise.resolve(pagesResponse);
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
};

const triggerRenderFailure = async () => {
    await waitFor(() => expect(documentPropsRef.current).not.toBeNull());
    act(() => documentPropsRef.current.onLoadError(new Error('Invalid PDF structure.')));
};

beforeEach(() => {
    documentPropsRef.current = null;
    vi.restoreAllMocks();
});

afterEach(cleanup);

describe('DocumentReader pdf.js render-failure logging', () => {
    it('logs [PDF_RENDER_ERROR] with the document id and pdf.js reason, never PDF contents', async () => {
        setupFetch({ ok: true, json: async () => ({ success: true, pages: [{ num: 1, text: 'irrelevant' }], total: 1 }) });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(<DocumentReader document={doc} onSelect={vi.fn()} />);
        await triggerRenderFailure();

        expect(errorSpy).toHaveBeenCalledWith('[PDF_RENDER_ERROR]', {
            documentId: 'doc_1',
            reason: 'Invalid PDF structure.'
        });
        await waitFor(() =>
            expect(screen.getByText(/Showing extracted text/i)).toBeInTheDocument()
        );
    });
});

describe('DocumentReader /pages fallback', () => {
    it('shows the real backend error on a failed response, not the generic empty-text message', async () => {
        setupFetch({
            ok: false,
            status: 500,
            json: async () => ({
                success: false,
                error: 'Failed to extract the requested pages: Invalid PDF structure.'
            })
        });

        render(<DocumentReader document={doc} onSelect={vi.fn()} />);
        await triggerRenderFailure();

        await waitFor(() =>
            expect(
                screen.getByText('Could not load page 1: Failed to extract the requested pages: Invalid PDF structure.')
            ).toBeInTheDocument()
        );
        expect(screen.queryByText(/No text could be extracted/i)).not.toBeInTheDocument();
    });

    it('shows "No text could be extracted" only for a genuinely successful-but-empty response', async () => {
        setupFetch({ ok: true, json: async () => ({ success: true, pages: [{ num: 1, text: '' }], total: 1 }) });

        render(<DocumentReader document={doc} onSelect={vi.fn()} />);
        await triggerRenderFailure();

        await waitFor(() =>
            expect(screen.getByText('No text could be extracted from page 1.')).toBeInTheDocument()
        );
        expect(screen.queryByText(/Could not load page/i)).not.toBeInTheDocument();
    });

    it('renders the real extracted text on a successful response', async () => {
        setupFetch({
            ok: true,
            json: async () => ({ success: true, pages: [{ num: 1, text: 'Ohm’s Law relates voltage and current.' }], total: 1 })
        });

        render(<DocumentReader document={doc} onSelect={vi.fn()} />);
        await triggerRenderFailure();

        await waitFor(() =>
            expect(screen.getByText(/Ohm.s Law relates voltage and current\./)).toBeInTheDocument()
        );
    });
});
