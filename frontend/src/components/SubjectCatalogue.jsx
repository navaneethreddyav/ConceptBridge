import React from 'react';
import { ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import { getSubjectsByDiscipline, getSubjectStats } from '../utils/topicTerms';

// Full-screen list of the subject cards within ONE discipline (reached from
// DisciplineCatalogue on the home screen) — driven entirely by
// shared/firstYearSubjects.json. Adding or editing a subject means editing that
// configuration file, never this component. See topicTerms.js for the
// anti-fabrication guarantee behind this data.
const SubjectCatalogue = ({ discipline, onBack, onSelectSubject }) => {
    const subjects = getSubjectsByDiscipline(discipline);

    return (
        <div className="flex flex-col h-full min-h-0 bg-black">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
                <button
                    type="button"
                    onClick={onBack}
                    className="p-2 rounded-full hover:bg-white/5 transition-colors shrink-0"
                    title="Back to home"
                >
                    <ChevronLeft className="w-5 h-5 text-text-muted" />
                </button>
                <div className="min-w-0">
                    <h2 className="text-base font-bold text-text-main truncate">{discipline}</h2>
                    <p className="text-xs text-text-muted truncate">
                        {subjects.length} subject{subjects.length === 1 ? '' : 's'}
                    </p>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 max-w-3xl mx-auto w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {subjects.map((subject) => {
                        const stats = getSubjectStats(subject.id);
                        return (
                            <button
                                key={subject.id}
                                type="button"
                                onClick={() => onSelectSubject(subject.id)}
                                className="flex items-start gap-3 border border-white/10 rounded-xl p-4 text-left hover:border-primary/50 transition-colors group"
                            >
                                <GraduationCap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                    <h4 className="text-sm font-bold text-text-main flex items-center gap-1">
                                        {subject.name}
                                        <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-primary transition-colors shrink-0" />
                                    </h4>
                                    <p className="text-xs text-text-muted mt-1 leading-relaxed line-clamp-2">
                                        {subject.shortDescription}
                                    </p>
                                    <p className="text-[11px] text-primary/80 mt-1.5 font-medium">
                                        {stats.units} Unit{stats.units === 1 ? '' : 's'} &middot; {stats.topics} Topic{stats.topics === 1 ? '' : 's'} &middot; {stats.terms} Term{stats.terms === 1 ? '' : 's'}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SubjectCatalogue;
