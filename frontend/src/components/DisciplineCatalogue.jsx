import React from 'react';
import { ChevronRight, Layers } from 'lucide-react';
import { getDisciplines, getSubjectsByDiscipline } from '../utils/topicTerms';

// Home-screen entry point into the catalogue: Discipline -> Subject -> Unit -> Topic.
// A discipline grouping keeps the home screen to a manageable number of cards even
// though the full catalogue spans 150+ subjects — entirely data-driven from
// shared/firstYearSubjects.json, no hardcoded discipline list.
const DisciplineCatalogue = ({ onSelectDiscipline }) => {
    const disciplines = getDisciplines();

    return (
        <div className="w-full max-w-5xl mx-auto text-left mb-8 md:mb-10">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 text-center">
                Browse by Discipline
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {disciplines.map((discipline) => {
                    const subjectCount = getSubjectsByDiscipline(discipline).length;
                    return (
                        <button
                            key={discipline}
                            type="button"
                            onClick={() => onSelectDiscipline(discipline)}
                            className="flex items-start gap-3 border border-white/10 rounded-xl p-4 text-left hover:border-primary/50 transition-colors group"
                        >
                            <Layers className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <div className="min-w-0">
                                <h4 className="text-sm font-bold text-text-main flex items-center gap-1">
                                    {discipline}
                                    <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-primary transition-colors shrink-0" />
                                </h4>
                                <p className="text-xs text-text-muted mt-1">
                                    {subjectCount} subject{subjectCount === 1 ? '' : 's'}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default DisciplineCatalogue;
