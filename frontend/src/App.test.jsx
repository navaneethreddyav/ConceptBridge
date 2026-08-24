import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SettingsProvider } from './context/SettingsContext.jsx';
import App from './App.jsx';

// react-pdf's <Document>/<Page> need real PDF-worker/canvas machinery unsuitable for a
// unit test — App transitively renders ReaderLayout/DocumentReader once a document is
// opened, so this mirrors the same mock DocumentReader.test.jsx uses. vi.mock calls are
// hoisted above imports by Vite's transform, so this applies before App.jsx is loaded.
vi.mock('react-pdf', () => ({
    Document: (props) => props.children ?? null,
    Page: () => null,
    pdfjs: { GlobalWorkerOptions: {} }
}));

afterEach(cleanup);

const renderApp = () =>
    render(
        <SettingsProvider>
            <App />
        </SettingsProvider>
    );

const jsonResponse = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

beforeEach(() => {
    global.fetch = vi.fn((url) => {
        if (String(url).includes('/api/upload')) {
            return jsonResponse({ success: true, documents: [], usage: { usedBytes: 0, totalBytes: 1, remainingBytes: 1 } });
        }
        if (String(url).includes('/api/explanation')) {
            return jsonResponse({
                success: true,
                explanation: { title: 'Fiber Optics term', simpleExplanation: 'A simple explanation.' },
                visual: null
            });
        }
        if (String(url).includes('/api/media')) {
            return jsonResponse({ success: true, videos: { short: null, long: null } });
        }
        return jsonResponse({ success: true });
    });
});

// Catalogue browsing is Discipline -> Subject -> Unit -> Topic. "Engineering Physics"
// is both the discipline name and one subject's name within it (the dataset's own
// naming — see shared/firstYearSubjects.json's Engineering Physics/Mathematics/
// Chemistry cards), so the discipline-level card is clicked first, then the
// identically-named subject card within it (findable because the discipline screen
// unmounts, leaving only one match in the DOM).
const navigateToFiberOpticsTopic = async () => {
    fireEvent.click(screen.getByRole('button', { name: /Engineering Physics/i }));
    fireEvent.click(await screen.findByRole('heading', { name: 'Engineering Physics', level: 4 }));
    fireEvent.click(await screen.findByText('Fiber Optics'));
};

describe('App — discipline/subject/topic catalogue navigation', () => {
    it('renders the home screen with the tagline and discipline cards, not a fake/empty dashboard', () => {
        renderApp();
        expect(screen.getByText(/Learn engineering concepts in the/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Engineering Physics/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Computer Science/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Explore Technical Terms/i })).toBeInTheDocument();
    });

    it('clicking a discipline shows the real subjects within it, not a flat 150-subject wall', () => {
        renderApp();
        fireEvent.click(screen.getByRole('button', { name: /Engineering Physics/i }));

        expect(screen.getByRole('heading', { name: 'Engineering Physics', level: 4 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Optics', level: 4 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Quantum Mechanics', level: 4 })).toBeInTheDocument();
        // A subject from an unrelated discipline must not leak into this list.
        expect(screen.queryByText('Operating Systems')).not.toBeInTheDocument();
    });

    it('clicking a subject card opens its real units and topics', async () => {
        renderApp();
        fireEvent.click(screen.getByRole('button', { name: /Engineering Physics/i }));
        fireEvent.click(await screen.findByRole('heading', { name: 'Engineering Physics', level: 4 }));

        expect(screen.getByText('Unit 2: Lasers & Fiber Optics')).toBeInTheDocument();
        expect(screen.getByText('Fiber Optics')).toBeInTheDocument();
        expect(screen.getByText('Crystal Structure')).toBeInTheDocument();
    });

    it('clicking a topic shows its topic-specific, alphabetically-sorted technical terms — not the whole subject', async () => {
        renderApp();
        await navigateToFiberOpticsTopic();

        await waitFor(() => expect(screen.getByText(/3 terms/)).toBeInTheDocument());

        // Queried by exact heading text (not accessible-name substring) since several
        // terms' own definitions legitimately mention "optical fiber" in prose.
        expect(screen.getByRole('heading', { name: 'Acceptance Angle', level: 4 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Numerical Aperture', level: 4 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Optical Fiber', level: 4 })).toBeInTheDocument();
        // A term from a different topic in the same subject must not leak in here.
        expect(screen.queryByText(/Bragg's Law/i)).not.toBeInTheDocument();
    });

    it('back navigation returns topic -> subject -> discipline -> home, and Home resets fully', async () => {
        renderApp();
        await navigateToFiberOpticsTopic();
        expect(await screen.findByRole('heading', { name: 'Acceptance Angle', level: 4 })).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Back to subject'));
        expect(screen.getByText('Unit 2: Lasers & Fiber Optics')).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Back to subjects'));
        expect(screen.getByRole('heading', { name: 'Engineering Physics', level: 4 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Optics', level: 4 })).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Back to home'));
        expect(screen.getByText(/Learn engineering concepts in the/i)).toBeInTheDocument();
    });

    it('Home button in the header returns to the landing screen from deep in a topic', async () => {
        renderApp();
        await navigateToFiberOpticsTopic();

        fireEvent.click(screen.getByRole('button', { name: /Go to ConceptBridge home/i }));
        expect(screen.getByText(/Learn engineering concepts in the/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Engineering Physics/i })).toBeInTheDocument();
    });

    it('clicking a topic-scoped term opens a real explanation (same pipeline as a PDF selection) with visuals/video/voice sections, not a static-only card', async () => {
        renderApp();
        await navigateToFiberOpticsTopic();
        fireEvent.click(await screen.findByRole('heading', { name: 'Optical Fiber', level: 4 }));

        await waitFor(() => expect(screen.getByText('A simple explanation.')).toBeInTheDocument());
        expect(screen.getByText('Watch')).toBeInTheDocument();
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/explanation'),
            expect.objectContaining({ method: 'POST' })
        );
    });
});
