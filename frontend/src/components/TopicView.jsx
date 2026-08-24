import React, { useEffect, useState } from 'react';
import { ChevronLeft, FileText, Loader2, Sparkles } from 'lucide-react';
import { getTopic, getTopicTerms } from '../utils/topicTerms';
import { tagDocumentForTopic, getDocumentIdsForTopic } from '../utils/topicDocuments';
import { API_BASE_URL } from '../config/api';
import FileUpload from './FileUpload';
import ConceptSidebar from './ConceptSidebar';

const formatMB = (bytes) => (bytes / (1024 * 1024)).toFixed(1);

// A technical term clicked from this topic-scoped list reuses the exact same
// explanation pipeline as a PDF text selection (ConceptSidebar -> POST /api/explanation
// + /api/media) — documentId is intentionally omitted rather than faked, since
// explanationController.js already treats it as optional (see the "safety net for
// callers that send no selection context" branch there). This is the same mechanism
// that generates the deterministic SVG visual and fetches YouTube videos for a normal
// reading-flow selection, so a term explanation here gets real images/video/voice too,
// not a separate or lesser code path.
const termToSelection = (term) => ({
    text: term.term,
    contextBefore: term.simpleExplanation || term.simpleDefinition || '',
    contextAfter: ''
});

const TopicView = ({ subjectId, unitId, topicId, onBack, onOpenDocument }) => {
    const topic = getTopic(subjectId, unitId, topicId);
    const [documents, setDocuments] = useState([]);
    const [docsLoading, setDocsLoading] = useState(true);
    const [selectedTerm, setSelectedTerm] = useState(null);
    const [termEntries, setTermEntries] = useState([]);
    const [termsLoading, setTermsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setTermsLoading(true);
        getTopicTerms(subjectId, unitId, topicId).then((entries) => {
            if (!cancelled) {
                setTermEntries(entries);
                setTermsLoading(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [subjectId, unitId, topicId]);

    useEffect(() => {
        let cancelled = false;
        setDocsLoading(true);
        fetch(`${API_BASE_URL}/api/upload`, { credentials: 'include' })
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                if (data.success) setDocuments(data.documents || []);
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setDocsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [subjectId, unitId, topicId]);

    if (!topic) {
        return (
            <div className="flex flex-col h-full min-h-0 bg-black items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-text-muted">This topic could not be found.</p>
                <button type="button" onClick={onBack} className="text-sm text-primary hover:underline">
                    Back
                </button>
            </div>
        );
    }

    const taggedIds = new Set(getDocumentIdsForTopic(subjectId, unitId, topicId));
    const topicDocuments = documents.filter((doc) => taggedIds.has(doc.id));

    const handleUploadSuccess = (doc) => {
        tagDocumentForTopic(doc.id, subjectId, unitId, topicId);
        onOpenDocument(doc);
    };

    return (
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
            <div className="flex flex-col h-full min-h-0 flex-1 bg-black">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
                    <button
                        type="button"
                        onClick={onBack}
                        className="p-2 rounded-full hover:bg-white/5 transition-colors shrink-0"
                        title="Back to subject"
                    >
                        <ChevronLeft className="w-5 h-5 text-text-muted" />
                    </button>
                    <div className="min-w-0">
                        <h2 className="text-base font-bold text-text-main truncate">{topic.name}</h2>
                        <p className="text-xs text-text-muted truncate">{topic.description}</p>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-8 max-w-3xl mx-auto w-full">
                    <section>
                        <h3 className="text-sm font-bold text-text-main mb-3">Study Material</h3>

                        {docsLoading ? (
                            <div className="flex items-center gap-2 text-sm text-text-muted">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading your documents...
                            </div>
                        ) : topicDocuments.length > 0 ? (
                            <ul className="space-y-1.5 mb-4">
                                {topicDocuments.map((doc) => (
                                    <li
                                        key={doc.id}
                                        onClick={() => onOpenDocument(doc)}
                                        className="flex items-center justify-between gap-2 border border-white/10 rounded-lg px-3 py-2 hover:border-primary/40 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                                            <span className="text-xs text-text-main truncate">{doc.filename}</span>
                                        </div>
                                        <span className="text-[10px] text-text-muted shrink-0">
                                            {formatMB(doc.sizeBytes)} MB
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-text-muted mb-4">
                                No study material added for this topic yet. Upload a PDF below to start reading
                                and highlighting concepts from {topic.name.toLowerCase()}.
                            </p>
                        )}

                        <FileUpload onUploadSuccess={handleUploadSuccess} />
                    </section>

                    <section>
                        <h3 className="text-sm font-bold text-text-main mb-1 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-primary" />
                            Technical Terms in this Topic
                        </h3>
                        {termsLoading ? (
                            <div className="flex items-center gap-2 text-sm text-text-muted">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading terms...
                            </div>
                        ) : (
                            <>
                                <p className="text-xs text-text-muted mb-3">
                                    {termEntries.length} term{termEntries.length === 1 ? '' : 's'} &middot; A-Z
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {termEntries.map((entry) => (
                                        <button
                                            key={entry.term}
                                            type="button"
                                            onClick={() => setSelectedTerm(entry)}
                                            className="text-left border border-white/10 rounded-lg px-3 py-2.5 hover:border-primary/50 transition-colors"
                                        >
                                            <h4 className="text-sm font-semibold text-text-main">{entry.term}</h4>
                                            {entry.simpleDefinition && (
                                                <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                                                    {entry.simpleDefinition}
                                                </p>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </section>
                </div>
            </div>

            {selectedTerm && (
                <ConceptSidebar
                    selection={termToSelection(selectedTerm)}
                    documentId={null}
                    onClose={() => setSelectedTerm(null)}
                />
            )}
        </div>
    );
};

export default TopicView;
