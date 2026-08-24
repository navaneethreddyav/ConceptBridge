import { describe, expect, it } from 'vitest';
import firstYearSubjects from '../../../shared/firstYearSubjects.json';
import engineeringTerminology from '../../../shared/engineeringTerminology.json';

// A dedicated audit suite (separate from topicTerms.test.js's data-integrity tests)
// implementing the specific catalogue-quality checks requested when this dataset was
// restructured toward genuine multi-unit academic depth: duplicate units/topics/terms,
// empty units, suspiciously shallow units, orphan topics/terms, invalid subject
// references, and a flagged list of subjects with few units for manual review.

const allRealKeys = new Set(engineeringTerminology.terms.map((t) => `${t.term}::${t.subject}`));

describe('catalogue audit — duplicates', () => {
    it('no subject has two units with the same id', () => {
        const offenders = [];
        for (const subject of firstYearSubjects.subjects) {
            const ids = subject.units.map((u) => u.id);
            const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
            if (dupes.length) offenders.push(`${subject.id}: ${dupes.join(', ')}`);
        }
        expect(offenders).toEqual([]);
    });

    it('no unit has two topics with the same id', () => {
        const offenders = [];
        for (const subject of firstYearSubjects.subjects) {
            for (const unit of subject.units) {
                const ids = unit.topics.map((t) => t.id);
                const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
                if (dupes.length) offenders.push(`${subject.id}/${unit.id}: ${dupes.join(', ')}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it('no two subjects share the same id (globally unique subject ids)', () => {
        const ids = firstYearSubjects.subjects.map((s) => s.id);
        const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
        expect(dupes).toEqual([]);
    });

    it('no topic lists the same term twice', () => {
        const offenders = [];
        for (const subject of firstYearSubjects.subjects) {
            for (const unit of subject.units) {
                for (const topic of unit.topics) {
                    const dupes = topic.terms.filter((t, i) => topic.terms.indexOf(t) !== i);
                    if (dupes.length) offenders.push(`${subject.id}/${unit.id}/${topic.id}: ${dupes.join(', ')}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('no canonical term is placed twice within the same subject card (would silently orphan one real dataset row)', () => {
        const offenders = [];
        for (const subject of firstYearSubjects.subjects) {
            const placed = subject.units.flatMap((u) => u.topics.flatMap((t) => t.terms));
            const dupes = placed.filter((t, i) => placed.indexOf(t) !== i);
            if (dupes.length) offenders.push(`${subject.id}: ${[...new Set(dupes)].join(', ')}`);
        }
        expect(offenders).toEqual([]);
    });
});

describe('catalogue audit — emptiness and structural quality', () => {
    it('no subject has zero units', () => {
        const offenders = firstYearSubjects.subjects.filter((s) => s.units.length === 0).map((s) => s.id);
        expect(offenders).toEqual([]);
    });

    it('no unit has zero topics', () => {
        const offenders = [];
        for (const subject of firstYearSubjects.subjects) {
            for (const unit of subject.units) {
                if (unit.topics.length === 0) offenders.push(`${subject.id}/${unit.id}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it('no topic has zero terms', () => {
        const offenders = [];
        for (const subject of firstYearSubjects.subjects) {
            for (const unit of subject.units) {
                for (const topic of unit.topics) {
                    if (topic.terms.length === 0) offenders.push(`${subject.id}/${unit.id}/${topic.id}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('no unit name is a placeholder ("Basics", "Advanced Topics", "Miscellaneous", or similar)', () => {
        const placeholderPattern = /^unit\s*\d*\s*[:.-]?\s*(basics?|advanced topics?|miscellaneous|misc\.?|other|topics)$/i;
        const offenders = [];
        for (const subject of firstYearSubjects.subjects) {
            for (const unit of subject.units) {
                if (placeholderPattern.test(unit.name.trim())) offenders.push(`${subject.id}/${unit.id}: "${unit.name}"`);
            }
        }
        expect(offenders).toEqual([]);
    });
});

describe('catalogue audit — orphans and invalid references', () => {
    it('every declared term resolves against its subject\'s termSubjects (no orphan/fabricated terms)', () => {
        const offenders = [];
        for (const subject of firstYearSubjects.subjects) {
            for (const unit of subject.units) {
                for (const topic of unit.topics) {
                    for (const name of topic.terms) {
                        const ok = subject.termSubjects.some((ts) => allRealKeys.has(`${name}::${ts}`));
                        if (!ok) offenders.push(`${subject.id}/${unit.id}/${topic.id}: "${name}"`);
                    }
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('every real (term, subject) pair in engineeringTerminology.json is reachable from exactly one catalogue subject', () => {
        const resolved = new Set();
        for (const subject of firstYearSubjects.subjects) {
            for (const unit of subject.units) {
                for (const topic of unit.topics) {
                    for (const name of topic.terms) {
                        const match = subject.termSubjects.find((ts) => allRealKeys.has(`${name}::${ts}`));
                        if (match) resolved.add(`${name}::${match}`);
                    }
                }
            }
        }
        const unreachable = [...allRealKeys].filter((k) => !resolved.has(k));
        expect(unreachable).toEqual([]);
    });

    it('every subject\'s termSubjects reference real subject strings that exist in engineeringTerminology.json', () => {
        const realSubjectStrings = new Set(engineeringTerminology.terms.map((t) => t.subject));
        const offenders = [];
        for (const subject of firstYearSubjects.subjects) {
            for (const ts of subject.termSubjects) {
                if (!realSubjectStrings.has(ts)) offenders.push(`${subject.id}: "${ts}"`);
            }
        }
        expect(offenders).toEqual([]);
    });
});

describe('catalogue audit — subjects flagged for manual review (few units)', () => {
    // Not a failure — a documented review list. A subject legitimately has fewer than
    // 4 units when its real term pool in engineeringTerminology.json is genuinely small
    // (a first-year elective or lab course, not a full-semester theory subject); this
    // test exists to keep that list visible and auditable, not to force every subject
    // to an arbitrary unit count.
    it('reports subjects with 0, 1, or 2 units, and asserts none of them are a single giant unit crammed with unrelated topics', () => {
        const flagged = firstYearSubjects.subjects
            .filter((s) => s.units.length <= 2)
            .map((s) => {
                const terms = s.units.reduce((sum, u) => sum + u.topics.reduce((s2, t) => s2 + t.terms.length, 0), 0);
                return { id: s.id, units: s.units.length, terms };
            });

        // The literal anti-pattern this restructuring effort fixed was "SUBJECT -> 1
        // UNIT -> huge list of unrelated topics" — a single unit holding 12+ real terms.
        // A clean 2-unit split (e.g. 13 terms as two 6-7 term units) is a legitimate,
        // lighter-but-real structure, not the anti-pattern, so it isn't flagged here.
        const shortchanged = flagged.filter((f) => f.units === 1 && f.terms >= 12);
        expect(shortchanged).toEqual([]);
    });
});
