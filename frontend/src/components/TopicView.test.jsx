import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TopicView from './TopicView.jsx';

// Regression test for a real production bug: "Technical Terms in this Topic" got
// stuck on "Loading terms..." forever after the lazy-loaded engineeringTerminology.json
// chunk failed to load once (e.g. a dropped network request). Root cause was two-layered
// (see topicTerms.js's loadTermsIndex and this file's own history):
//   1. topicTerms.js cached the REJECTED promise at module scope, so every later call —
//      for any topic, valid or not — was handed back the same dead promise forever.
//   2. TopicView.jsx's `getTopicTerms(...).then(...)` had no `.catch()`, so a rejection
//      never reached `setTermsLoading(false)` — the UI never left the loading state.
// This test mocks topicTerms.js directly (simpler and more robust than trying to
// simulate a failed dynamic JSON import) to verify TopicView itself correctly
// transitions loading -> error -> (retry) -> loaded, and never hangs.

vi.mock('../utils/topicTerms', () => ({
    getTopic: vi.fn(() => ({
        id: 'mock-topic', name: 'Mock Topic', description: 'A test topic.', terms: ['Mock Term']
    })),
    getTopicTerms: vi.fn()
}));

vi.mock('../utils/topicDocuments', () => ({
    tagDocumentForTopic: vi.fn(),
    getDocumentIdsForTopic: vi.fn(() => [])
}));

vi.mock('./FileUpload', () => ({ default: () => <div data-testid="file-upload-stub" /> }));
vi.mock('./ConceptSidebar', () => ({ default: () => <div data-testid="concept-sidebar-stub" /> }));

import { getTopic, getTopicTerms } from '../utils/topicTerms';
import { getDocumentIdsForTopic } from '../utils/topicDocuments';

afterEach(cleanup);

beforeEach(() => {
    vi.resetAllMocks();
    getTopic.mockReturnValue({
        id: 'mock-topic', name: 'Mock Topic', description: 'A test topic.', terms: ['Mock Term']
    });
    getDocumentIdsForTopic.mockReturnValue([]);
    global.fetch = vi.fn(() =>
        Promise.resolve({ json: () => Promise.resolve({ success: true, documents: [] }) })
    );
});

const renderTopicView = () =>
    render(
        <TopicView subjectId="mock-subject" unitId="mock-unit" topicId="mock-topic" onBack={() => {}} onOpenDocument={() => {}} />
    );

describe('TopicView — technical terms never get stuck on "Loading terms..." forever', () => {
    it('shows "Loading terms..." while the promise is pending', () => {
        getTopicTerms.mockReturnValue(new Promise(() => {})); // never resolves, simulating mid-flight
        renderTopicView();
        expect(screen.getByText('Loading terms...')).toBeInTheDocument();
    });

    it('shows real terms once getTopicTerms resolves', async () => {
        getTopicTerms.mockResolvedValue([
            { term: 'Reynolds Number', simpleDefinition: 'A dimensionless flow ratio.' }
        ]);
        renderTopicView();
        await waitFor(() => expect(screen.getByText('Reynolds Number')).toBeInTheDocument());
        expect(screen.queryByText('Loading terms...')).not.toBeInTheDocument();
    });

    it('shows "No technical terms found for this topic." for a topic that genuinely has none', async () => {
        getTopicTerms.mockResolvedValue([]);
        renderTopicView();
        await waitFor(() => expect(screen.getByText('No technical terms found for this topic.')).toBeInTheDocument());
    });

    it('THE BUG: when getTopicTerms rejects, the UI must show a real error, not stay on "Loading terms..." forever', async () => {
        getTopicTerms.mockRejectedValue(new Error('Simulated chunk load failure'));
        renderTopicView();

        await waitFor(() => expect(screen.getByText('Could not load technical terms.')).toBeInTheDocument());
        // The specific regression: loading text must be GONE, not still present alongside/instead of the error.
        expect(screen.queryByText('Loading terms...')).not.toBeInTheDocument();
    });

    it('retry button re-invokes getTopicTerms and recovers into the loaded state', async () => {
        getTopicTerms
            .mockRejectedValueOnce(new Error('Simulated chunk load failure'))
            .mockResolvedValueOnce([{ term: 'Entropy', simpleDefinition: 'A measure of disorder.' }]);

        renderTopicView();
        await waitFor(() => expect(screen.getByText('Could not load technical terms.')).toBeInTheDocument());

        fireEvent.click(screen.getByText('Retry'));

        await waitFor(() => expect(screen.getByText('Entropy')).toBeInTheDocument());
        expect(screen.queryByText('Could not load technical terms.')).not.toBeInTheDocument();
        expect(getTopicTerms).toHaveBeenCalledTimes(2);
    });
});
