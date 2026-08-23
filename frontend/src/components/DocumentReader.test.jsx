import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

// Selection is exercised via fallback mode (data-context-root) rather than a real
// react-pdf text layer — CONTEXT_ROOT_SELECTOR and every selection helper
// (refineRange/captureSelection/emitSelection) treat both roots identically, and
// fallback mode doesn't require mocking react-pdf's internal DOM structure.
const selectTextInNode = (textNode, startOffset, endOffset) => {
    const range = document.createRange();
    range.setStart(textNode, startOffset);
    range.setEnd(textNode, endOffset);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return selection;
};

const getContextRoot = () => document.querySelector('[data-context-root]');

describe('DocumentReader text selection', () => {
    const setupWithPageText = async (text, concepts = []) => {
        setupFetch({ ok: true, json: async () => ({ success: true, pages: [{ num: 1, text }], total: 1 }) });
        global.fetch = vi.fn((url, opts) => {
            if (String(url).includes('/api/concepts/detect')) {
                return Promise.resolve({ ok: true, json: async () => ({ success: true, concepts }) });
            }
            if (String(url).includes('/pages')) {
                return Promise.resolve({ ok: true, json: async () => ({ success: true, pages: [{ num: 1, text }], total: 1 }) });
            }
            return Promise.reject(new Error(`unexpected fetch: ${url} ${opts?.method || ''}`));
        });

        const onSelect = vi.fn();
        render(<DocumentReader document={doc} onSelect={onSelect} />);
        await triggerRenderFailure();
        await waitFor(() => expect(getContextRoot()).not.toBeNull());
        await waitFor(() => expect(getContextRoot().textContent).toBe(text));
        return onSelect;
    };

    it('selecting one word returns only that word', async () => {
        const text = 'Tution Point school details';
        const onSelect = await setupWithPageText(text);
        const root = getContextRoot();
        const wordStart = text.indexOf('Point');
        selectTextInNode(root.firstChild, wordStart, wordStart + 'Point'.length);

        fireEvent.mouseUp(root);

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({ text: 'Point' })
        );
    });

    it('selecting a multi-word phrase returns only that phrase', async () => {
        const text = 'The private school fees increased this year.';
        const onSelect = await setupWithPageText(text);
        const root = getContextRoot();
        const phrase = 'private school fees';
        const start = text.indexOf(phrase);
        selectTextInNode(root.firstChild, start, start + phrase.length);

        fireEvent.mouseUp(root);

        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({ text: phrase })
        );
    });

    it('an empty/collapsed selection does not open ConceptBridge', async () => {
        const text = 'Some plain page text with no selection made.';
        const onSelect = await setupWithPageText(text);
        const root = getContextRoot();
        // Collapsed range: start === end, i.e. no text actually selected.
        selectTextInNode(root.firstChild, 4, 4);

        fireEvent.mouseUp(root);

        expect(onSelect).not.toHaveBeenCalled();
    });

    it('rejects and clears an implausibly long selection instead of capturing the whole page', async () => {
        const text = `Distributed systems notes. ${'Load balancing algorithm design reduces latency significantly across many replicated nodes. '.repeat(6)}`;
        const onSelect = await setupWithPageText(text);
        const root = getContextRoot();
        // Simulates the reproduced bug: the native Selection API ends up spanning
        // almost the entire page (well over MAX_SELECTION_CHARS), e.g. via the
        // browser's own auto-scroll-while-dragging near a scrollable edge.
        selectTextInNode(root.firstChild, 0, text.length);

        fireEvent.mouseUp(root);

        expect(onSelect).not.toHaveBeenCalled();
        expect(window.getSelection().toString()).toBe('');
    });

    it('captures a selection that spans multiple text nodes (a highlighted term boundary)', async () => {
        const text = 'Load balancing algorithm reduces latency significantly.';
        const onSelect = await setupWithPageText(text, [{ name: 'balancing algorithm', importance: 9 }]);
        const root = getContextRoot();

        await waitFor(() => expect(root.querySelector('mark[data-cb-term]')).not.toBeNull());

        // Three text nodes now: "Load ", "balancing algorithm" (inside <mark>), and
        // " reduces latency significantly." — select from inside the first node
        // through partway into the marked node, genuinely spanning a node boundary.
        const beforeNode = root.firstChild;
        const markNode = root.querySelector('mark[data-cb-term]').firstChild;
        const range = document.createRange();
        range.setStart(beforeNode, 'Load '.indexOf('L'));
        range.setEnd(markNode, 'balancing'.length);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        fireEvent.mouseUp(root);

        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({ text: 'Load balancing' })
        );
    });
});
