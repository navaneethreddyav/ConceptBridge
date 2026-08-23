import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, Loader2, BookOpen } from 'lucide-react';
import TermDetailModal from './TermDetailModal';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Above this many unfiltered results, don't render the whole list — prompt the
// student to narrow it down instead. Keeps the DOM bounded even if the dataset
// grows well past its current size, without needing list virtualization for a
// dataset this size (a few hundred terms).
const MAX_UNPROMPTED_RESULTS = 120;

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

// The dataset (and this whole component) are loaded on demand via React.lazy +
// dynamic import — a student who never opens the glossary shouldn't pay for its
// JSON in their initial page load.
const loadDataset = () => import('../../../shared/engineeringTerminology.json');

const ALL_DISCIPLINES = 'All Disciplines';
const ALL_SUBJECTS = 'All Subjects';

const TechnicalTerms = ({ onClose }) => {
    const [terms, setTerms] = useState(null);
    const [disciplines, setDisciplines] = useState([]);
    const [error, setError] = useState(false);
    const [query, setQuery] = useState('');
    const [activeLetter, setActiveLetter] = useState(null);
    const [disciplineFilter, setDisciplineFilter] = useState(ALL_DISCIPLINES);
    const [subjectFilter, setSubjectFilter] = useState(ALL_SUBJECTS);
    const [selectedTerm, setSelectedTerm] = useState(null);

    useEffect(() => {
        let cancelled = false;
        loadDataset()
            .then((mod) => {
                if (!cancelled) {
                    setTerms(mod.default.terms);
                    setDisciplines(mod.default.disciplines || []);
                }
            })
            .catch(() => {
                if (!cancelled) setError(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // Subject options narrow to the selected discipline — with 170+ subjects across
    // 16 disciplines, an unscoped subject dropdown would be as unusable as the
    // original flat list this whole redesign replaces.
    const subjects = useMemo(() => {
        if (!terms) return [];
        const pool = disciplineFilter === ALL_DISCIPLINES ? terms : terms.filter((t) => t.discipline === disciplineFilter);
        return [...new Set(pool.map((t) => t.subject))].sort((a, b) => a.localeCompare(b));
    }, [terms, disciplineFilter]);

    // Switching discipline invalidates a subject filter that no longer applies.
    useEffect(() => {
        if (subjectFilter !== ALL_SUBJECTS && !subjects.includes(subjectFilter)) {
            setSubjectFilter(ALL_SUBJECTS);
        }
    }, [subjects, subjectFilter]);

    const availableLetters = useMemo(() => {
        if (!terms) return new Set();
        return new Set(terms.map((t) => t.term[0].toUpperCase()));
    }, [terms]);

    const termByName = useMemo(() => {
        if (!terms) return new Map();
        return new Map(terms.map((t) => [t.term, t]));
    }, [terms]);

    const filtered = useMemo(() => {
        if (!terms) return [];
        const q = normalize(query);
        return terms.filter((t) => {
            if (disciplineFilter !== ALL_DISCIPLINES && t.discipline !== disciplineFilter) return false;
            if (subjectFilter !== ALL_SUBJECTS && t.subject !== subjectFilter) return false;
            if (activeLetter && t.term[0].toUpperCase() !== activeLetter) return false;
            if (q && !t.normalizedTerm.includes(q) && !(t.aliases || []).some((a) => normalize(a).includes(q))) return false;
            return true;
        });
    }, [terms, query, activeLetter, disciplineFilter, subjectFilter]);

    const hasActiveNarrowing = query.trim() || activeLetter || disciplineFilter !== ALL_DISCIPLINES || subjectFilter !== ALL_SUBJECTS;
    const visible = hasActiveNarrowing ? filtered : filtered.slice(0, MAX_UNPROMPTED_RESULTS);
    const truncated = !hasActiveNarrowing && filtered.length > MAX_UNPROMPTED_RESULTS;

    const clearFilters = useCallback(() => {
        setQuery('');
        setActiveLetter(null);
        setDisciplineFilter(ALL_DISCIPLINES);
        setSubjectFilter(ALL_SUBJECTS);
    }, []);

    const openRelated = useCallback(
        (name) => {
            const match = termByName.get(name);
            if (match) setSelectedTerm(match);
        },
        [termByName]
    );

    return (
        <div className="flex flex-col h-full min-h-0 bg-black">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
                <button
                    onClick={onClose}
                    className="p-2 rounded-full border border-white/10 hover:border-primary/50 transition-colors shrink-0"
                    title="Back"
                >
                    <ChevronLeft className="w-4 h-4 text-text-muted" />
                </button>
                <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-primary">ConceptBridge</p>
                    <h1 className="text-base font-bold text-text-main flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-primary shrink-0" />
                        Technical Terms
                    </h1>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
                    <p className="text-xs text-text-muted">
                        A searchable engineering knowledge base spanning Computer Science and every major
                        engineering discipline — a second way to look things up alongside selecting words directly
                        in a PDF.
                    </p>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search technical terms..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={disciplineFilter}
                            onChange={(e) => setDisciplineFilter(e.target.value)}
                            className="bg-white/5 border border-white/10 text-text-main text-xs rounded-lg px-2.5 py-2 max-w-[60vw] sm:max-w-none focus:outline-none focus:border-primary"
                        >
                            <option value={ALL_DISCIPLINES}>{ALL_DISCIPLINES}</option>
                            {disciplines.map((d) => (
                                <option key={d} value={d}>
                                    {d}
                                </option>
                            ))}
                        </select>
                        <select
                            value={subjectFilter}
                            onChange={(e) => setSubjectFilter(e.target.value)}
                            className="bg-white/5 border border-white/10 text-text-main text-xs rounded-lg px-2.5 py-2 max-w-[60vw] sm:max-w-none focus:outline-none focus:border-primary"
                        >
                            <option value={ALL_SUBJECTS}>{ALL_SUBJECTS}</option>
                            {subjects.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                        {hasActiveNarrowing && (
                            <button
                                onClick={clearFilters}
                                className="text-xs text-primary hover:underline px-1"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    <div
                        className="flex flex-wrap gap-1 select-none"
                        role="navigation"
                        aria-label="Browse terms alphabetically"
                    >
                        {ALPHABET.map((letter) => {
                            const hasTerms = availableLetters.has(letter);
                            const isActive = activeLetter === letter;
                            return (
                                <button
                                    key={letter}
                                    disabled={!hasTerms}
                                    onClick={() => setActiveLetter(isActive ? null : letter)}
                                    className={`w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg text-xs font-semibold border transition-colors ${
                                        isActive
                                            ? 'bg-primary text-black border-primary'
                                            : hasTerms
                                            ? 'border-white/10 text-text-main hover:border-primary/50'
                                            : 'border-white/5 text-text-muted/30 cursor-not-allowed'
                                    }`}
                                >
                                    {letter}
                                </button>
                            );
                        })}
                    </div>

                    {!terms && !error && (
                        <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            Loading glossary...
                        </div>
                    )}

                    {error && (
                        <div className="py-16 text-center text-sm text-text-muted">
                            Couldn't load the glossary. Please try again.
                        </div>
                    )}

                    {terms && (
                        <>
                            <p className="text-xs text-text-muted">
                                {filtered.length} term{filtered.length === 1 ? '' : 's'}
                                {hasActiveNarrowing ? ' found' : ' total — search or pick a letter to browse'}
                            </p>

                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {visible.map((t) => (
                                    <li key={t.normalizedTerm + t.subject}>
                                        <button
                                            onClick={() => setSelectedTerm(t)}
                                            className="w-full text-left border border-white/10 rounded-xl px-3.5 py-2.5 hover:border-primary/50 transition-colors"
                                        >
                                            <p className="text-sm font-medium text-text-main truncate">{t.term}</p>
                                            <p className="text-[11px] text-text-muted truncate">
                                                {t.subject}
                                                {t.semester ? ` · Sem ${t.semester}` : ''}
                                            </p>
                                        </button>
                                    </li>
                                ))}
                            </ul>

                            {truncated && (
                                <p className="text-xs text-text-muted text-center pt-2">
                                    Showing the first {MAX_UNPROMPTED_RESULTS} of {filtered.length} terms — search or
                                    pick a letter above to narrow it down.
                                </p>
                            )}

                            {filtered.length === 0 && (
                                <p className="text-sm text-text-muted text-center py-10">
                                    No terms match your search.
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>

            <TermDetailModal term={selectedTerm} onClose={() => setSelectedTerm(null)} onSelectRelated={openRelated} />
        </div>
    );
};

export default TechnicalTerms;
