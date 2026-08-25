import firstYearSubjects from '../../../shared/firstYearSubjects.json';

const getSubjects = () => firstYearSubjects.subjects;

// 157 subject cards is far too many to show flat on a home screen, so browsing is
// Discipline -> Subject -> Unit -> Topic. Disciplines are derived from the subjects
// themselves (not a separate config list) so a new subject's discipline is always
// consistent with what's actually in the data.
const getDisciplines = () => [...new Set(firstYearSubjects.subjects.map((s) => s.discipline))].sort();

const getSubjectsByDiscipline = (discipline) =>
    firstYearSubjects.subjects.filter((s) => s.discipline === discipline);

const getSubject = (subjectId) => firstYearSubjects.subjects.find((s) => s.id === subjectId) || null;

const getUnit = (subjectId, unitId) =>
    getSubject(subjectId)?.units.find((u) => u.id === unitId) || null;

const getTopic = (subjectId, unitId, topicId) =>
    getUnit(subjectId, unitId)?.topics.find((t) => t.id === topicId) || null;

/**
 * Unit/topic/term counts for a subject card, e.g. "6 Units, 8 Topics, 47 Terms" — a
 * topic's `terms` array in firstYearSubjects.json already holds the exact term names,
 * so this is a synchronous count over that data alone, no need to await the large
 * engineeringTerminology.json just to show a number on a card.
 * @returns {{units: number, topics: number, terms: number}}
 */
const getSubjectStats = (subjectId) => {
    const subject = getSubject(subjectId);
    if (!subject) return { units: 0, topics: 0, terms: 0 };
    const units = subject.units.length;
    const topics = subject.units.reduce((sum, u) => sum + u.topics.length, 0);
    const terms = subject.units.reduce(
        (sum, u) => sum + u.topics.reduce((s, t) => s + t.terms.length, 0),
        0
    );
    return { units, topics, terms };
};

// engineeringTerminology.json is ~700KB uncompressed and, like the glossary itself (see
// glossaryLookup.js), must stay out of the initial bundle — a student browsing the home
// screen's subject cards (getSubjects/getSubject/getUnit/getTopic above, all backed only
// by the small firstYearSubjects.json) should never pay for it. Only getTopicTerms below,
// reached exclusively from inside a topic, actually needs it, so it's the only thing
// lazily imported and cached here.
let termsIndexPromise = null;

const loadTermsIndex = () => {
    if (!termsIndexPromise) {
        termsIndexPromise = import('../../../shared/engineeringTerminology.json').then((mod) => {
            // Keyed by "term::subject" rather than just the term name.
            // engineeringTerminology.json has ~66 cases of the identical term string
            // appearing under two different `subject` values for genuinely different
            // course contexts (e.g. "Resistor" exists under both "Basic Electrical
            // Engineering" and "Circuit Theory"; "Laplace Transform" under both
            // "Differential Equations & Numerical Methods" and "Signals & Systems") — a
            // name-only index would silently resolve to whichever one happens to appear
            // last in the JSON array, which is not necessarily the first-year subject's
            // own version of that term.
            const byNameAndSubject = new Map(mod.default.terms.map((t) => [`${t.term}::${t.subject}`, t]));
            return byNameAndSubject;
        });
        // A transient failure (a single dropped chunk request, a cold-start CDN blip)
        // must not permanently poison every future topic view for the rest of the page
        // session — without this, one bad network moment left EVERY subsequent topic,
        // including perfectly valid ones, stuck on "Loading terms..." forever, since
        // the next call would just get handed back the same already-rejected promise.
        // Clearing the cache here lets the next call genuinely retry the import.
        termsIndexPromise.catch(() => {
            termsIndexPromise = null;
        });
    }
    return termsIndexPromise;
};

/**
 * Resolves a topic's declared term names into full glossary entries — topic-specific,
 * alphabetically sorted, never the whole subject's term list. firstYearSubjects.json's
 * "terms" arrays are a closed, hand-verified list of real names that exist in
 * engineeringTerminology.json (see that file's "_provenance" note); a name that fails
 * to resolve here means the two datasets have drifted out of sync, which is loud in
 * dev rather than silently dropping content.
 * @returns {Promise<Array>} full term entries from engineeringTerminology.json, A-Z by term name
 */
const getTopicTerms = async (subjectId, unitId, topicId) => {
    const subject = getSubject(subjectId);
    const topic = getTopic(subjectId, unitId, topicId);
    if (!subject || !topic) return [];

    const index = await loadTermsIndex();

    return topic.terms
        .map((name) => {
            // A term name is only ever looked up against this subject's own
            // termSubjects — never a same-named entry from an unrelated subject.
            const entry = subject.termSubjects
                .map((termSubject) => index.get(`${name}::${termSubject}`))
                .find(Boolean);
            if (!entry && import.meta.env.DEV) {
                console.error(
                    `topicTerms: "${name}" declared under ${subjectId}/${unitId}/${topicId} `
                    + 'was not found in engineeringTerminology.json under this subject\'s termSubjects — datasets have drifted out of sync.'
                );
            }
            return entry;
        })
        .filter(Boolean)
        .sort((a, b) => a.term.localeCompare(b.term));
};

export { getSubjects, getDisciplines, getSubjectsByDiscipline, getSubject, getUnit, getTopic, getSubjectStats, getTopicTerms };
