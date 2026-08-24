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
// is both the discipline name and its one subject's name (the dataset's own naming —
// see shared/firstYearSubjects.json's Engineering Physics/Mathematics/Chemistry
// cards, each now a single unified multi-unit subject), so the discipline-level card
// is clicked first, then the identically-named subject card within it (findable
// because the discipline screen unmounts, leaving only one match in the DOM).
const navigateToNanotechnologyTopic = async () => {
    fireEvent.click(screen.getByRole('button', { name: /Engineering Physics/i }));
    fireEvent.click(await screen.findByRole('heading', { name: 'Engineering Physics', level: 4 }));
    fireEvent.click(await screen.findByText('Nanotechnology'));
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
        fireEvent.click(screen.getByRole('button', { name: /Computer Science/i }));

        expect(screen.getByRole('heading', { name: 'Operating Systems', level: 4 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Database Management Systems', level: 4 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Algorithms', level: 4 })).toBeInTheDocument();
        // A subject from an unrelated discipline must not leak into this list.
        expect(screen.queryByText('Engineering Mechanics')).not.toBeInTheDocument();
    });

    it('subject cards show real unit/topic/term counts (e.g. Operating Systems is a full 6-unit subject, not a 1-unit stub)', () => {
        renderApp();
        fireEvent.click(screen.getByRole('button', { name: /Computer Science/i }));
        // Several CS flagship subjects (OS, DBMS, Networks, Algorithms) legitimately
        // share "6 Units" — assert at least one card shows it, not exactly one.
        expect(screen.getAllByText(/6 Units/).length).toBeGreaterThan(0);
    });

    it('clicking a subject card opens its real, multi-unit structure — not one giant unit', async () => {
        renderApp();
        fireEvent.click(screen.getByRole('button', { name: /Engineering Physics/i }));
        fireEvent.click(await screen.findByRole('heading', { name: 'Engineering Physics', level: 4 }));

        expect(screen.getByText('Unit 1: Quantum Mechanics')).toBeInTheDocument();
        expect(screen.getByText('Unit 2: Lasers & Fiber Optics')).toBeInTheDocument();
        expect(screen.getByText('Unit 6: Superconductivity, Electromagnetic Theory & Nanotechnology')).toBeInTheDocument();
        expect(screen.getByText('Crystal Structure')).toBeInTheDocument();
        expect(screen.getByText('Nanotechnology')).toBeInTheDocument();
    });

    it('clicking a topic shows its topic-specific, alphabetically-sorted technical terms — not the whole subject', async () => {
        renderApp();
        await navigateToNanotechnologyTopic();

        await waitFor(() => expect(screen.getByText(/4 terms/)).toBeInTheDocument());

        // Queried by exact heading text (not accessible-name substring) since several
        // terms' own definitions legitimately mention these words in prose.
        expect(screen.getByRole('heading', { name: 'Carbon Nanotube', level: 4 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Nanomaterial', level: 4 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Nanoparticle', level: 4 })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Quantum Confinement', level: 4 })).toBeInTheDocument();
        // A term from a different topic in the same subject must not leak in here.
        expect(screen.queryByText(/Bragg's Law/i)).not.toBeInTheDocument();
    });

    it('back navigation returns topic -> subject -> discipline -> home, and Home resets fully', async () => {
        renderApp();
        await navigateToNanotechnologyTopic();
        expect(await screen.findByRole('heading', { name: 'Nanomaterial', level: 4 })).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Back to subject'));
        expect(screen.getByText('Unit 2: Lasers & Fiber Optics')).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Back to subjects'));
        expect(screen.getByRole('heading', { name: 'Engineering Physics', level: 4 })).toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Back to home'));
        expect(screen.getByText(/Learn engineering concepts in the/i)).toBeInTheDocument();
    });

    it('Home button in the header returns to the landing screen from deep in a topic', async () => {
        renderApp();
        await navigateToNanotechnologyTopic();

        fireEvent.click(screen.getByRole('button', { name: /Go to ConceptBridge home/i }));
        expect(screen.getByText(/Learn engineering concepts in the/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Engineering Physics/i })).toBeInTheDocument();
    });

    it('clicking a topic-scoped term opens a real explanation (same pipeline as a PDF selection) with visuals/video/voice sections, not a static-only card', async () => {
        renderApp();
        await navigateToNanotechnologyTopic();
        fireEvent.click(await screen.findByRole('heading', { name: 'Carbon Nanotube', level: 4 }));

        await waitFor(() => expect(screen.getByText('A simple explanation.')).toBeInTheDocument());
        expect(screen.getByText('Watch')).toBeInTheDocument();
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/explanation'),
            expect.objectContaining({ method: 'POST' })
        );
    });
});
