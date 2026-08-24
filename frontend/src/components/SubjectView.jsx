import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getSubject, getSubjectStats } from '../utils/topicTerms';

const SubjectView = ({ subjectId, onBack, onSelectTopic }) => {
    const subject = getSubject(subjectId);
    const stats = getSubjectStats(subjectId);

    if (!subject) {
        return (
            <div className="flex flex-col h-full min-h-0 bg-black items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-text-muted">This subject could not be found.</p>
                <button type="button" onClick={onBack} className="text-sm text-primary hover:underline">
                    Back to subjects
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0 bg-black">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-2 rounded-full hover:bg-white/5 transition-colors shrink-0"
                    title="Back to subjects"
                >
                    <ChevronLeft className="w-5 h-5 text-text-muted" />
                </button>
                <div className="min-w-0">
                    <h2 className="text-base font-bold text-text-main truncate">{subject.name}</h2>
                    <p className="text-xs text-text-muted truncate">{subject.shortDescription}</p>
                    <p className="text-[11px] text-primary/80 font-medium mt-0.5">
                        {stats.units} Unit{stats.units === 1 ? '' : 's'} &middot; {stats.topics} Topic{stats.topics === 1 ? '' : 's'} &middot; {stats.terms} Term{stats.terms === 1 ? '' : 's'}
                    </p>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-8 max-w-3xl mx-auto w-full">
                {subject.units.map((unit) => (
                    <section key={unit.id}>
                        <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-3 flex items-center justify-between gap-2">
                            <span>{unit.name}</span>
                            <span className="text-[10px] text-text-muted normal-case tracking-normal font-normal shrink-0">
                                {unit.topics.length} topic{unit.topics.length === 1 ? '' : 's'}
                            </span>
                        </h3>
                        <div className="space-y-2">
                            {unit.topics.map((topic) => (
                                <button
                                    key={topic.id}
                                    type="button"
                                    onClick={() => onSelectTopic(unit.id, topic.id)}
                                    className="w-full flex items-center justify-between gap-3 border border-white/10 rounded-xl px-4 py-3 text-left hover:border-primary/50 transition-colors group"
                                >
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-semibold text-text-main">{topic.name}</h4>
                                        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                                            {topic.description}
                                        </p>
                                        <p className="text-[10px] text-primary/70 mt-1">
                                            {topic.terms.length} term{topic.terms.length === 1 ? '' : 's'}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors shrink-0" />
                                </button>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
};

export default SubjectView;
