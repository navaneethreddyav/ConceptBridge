import React, { useEffect } from 'react';
import { X } from 'lucide-react';

// Bottom-sheet on mobile (items-end + rounded only on top), centered card on sm+ —
// the same responsive pattern used nowhere else yet in this app, but it's the
// standard mobile-safe way to keep a modal fully reachable under a phone's thumb
// without the awkward centered-tiny-box look small screens get otherwise.
const TermDetailModal = ({ term, onClose, onSelectRelated }) => {
    useEffect(() => {
        if (!term) return undefined;
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [term, onClose]);

    if (!term) return null;

    return (
        <div
            className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center"
            onClick={onClose}
        >
            <div
                className="w-full sm:max-w-lg bg-background border border-white/10 rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={term.term}
            >
                <div className="sticky top-0 bg-background border-b border-white/10 px-5 py-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-primary mb-1">Technical Term</p>
                        <h2 className="text-xl font-bold text-text-main break-words">{term.term}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full border border-white/10 hover:border-primary/50 transition-colors shrink-0"
                        title="Close"
                    >
                        <X className="w-4 h-4 text-text-muted" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    <div className="flex flex-wrap gap-2 text-xs">
                        {term.discipline && (
                            <span className="px-2.5 py-1 rounded-full border border-primary/30 text-primary">
                                {term.discipline}
                            </span>
                        )}
                        <span className="px-2.5 py-1 rounded-full border border-white/10 text-text-muted">
                            Subject: {term.subject}
                        </span>
                        {term.semester && (
                            <span className="px-2.5 py-1 rounded-full border border-white/10 text-text-muted">
                                Semester {term.semester}
                            </span>
                        )}
                    </div>

                    {term.aliases?.length > 0 && (
                        <p className="text-xs text-text-muted">
                            Also known as: {term.aliases.join(', ')}
                        </p>
                    )}

                    <section>
                        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1.5">
                            Simple Definition
                        </h3>
                        <p className="text-sm text-text-main leading-relaxed">{term.simpleDefinition}</p>
                    </section>

                    <section>
                        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1.5">
                            Simple Explanation
                        </h3>
                        <p className="text-sm text-text-muted leading-relaxed">{term.simpleExplanation}</p>
                    </section>

                    {term.relatedTerms?.length > 0 && (
                        <section>
                            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">
                                Related Terms
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {term.relatedTerms.map((rt) => (
                                    <button
                                        key={rt}
                                        onClick={() => onSelectRelated(rt)}
                                        className="text-xs px-3 py-1.5 rounded-full border border-white/10 hover:border-primary/50 text-text-main transition-colors"
                                    >
                                        {rt}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    <section>
                        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1.5">
                            Source / Reference
                        </h3>
                        <p className="text-xs text-text-muted leading-relaxed">{term.source}</p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default TermDetailModal;
