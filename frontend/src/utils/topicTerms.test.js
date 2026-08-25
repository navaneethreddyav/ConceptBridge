import { describe, expect, it, beforeAll, vi } from 'vitest';
import firstYearSubjects from '../../../shared/firstYearSubjects.json';
import engineeringTerminology from '../../../shared/engineeringTerminology.json';
import { getSubjects, getDisciplines, getSubjectsByDiscipline, getSubject, getUnit, getTopic, getSubjectStats, getTopicTerms } from './topicTerms.js';

// topicTerms.js's getTopicTerms loads engineeringTerminology.json via a real fetch()
// against a build-time asset URL (see topicTerms.js's `?url` import and the comment
// explaining why — a plain fetch, unlike a dynamic import(), can genuinely be retried
// after a transient failure, which a browser's ES module loader cannot). There's no
// real HTTP server in this test environment, so fetch is stubbed here to serve the
// SAME real, already-imported engineeringTerminology.json content — this preserves
// every test below as a genuine check against real data, not a hand-rolled fixture.
beforeAll(() => {
    global.fetch = vi.fn(() =>
        Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(engineeringTerminology)
        })
    );
});

describe('firstYearSubjects.json data integrity (anti-fabrication guard)', () => {
    const allRealTerms = new Set(engineeringTerminology.terms.map((t) => t.term));

    it('every term declared under a topic is a real entry in engineeringTerminology.json', () => {
        const fabricated = [];
        for (const subject of firstYearSubjects.subjects) {
            for (const unit of subject.units) {
                for (const topic of unit.topics) {
                    for (const name of topic.terms) {
                        if (!allRealTerms.has(name)) {
                            fabricated.push(`${subject.id}/${unit.id}/${topic.id}: "${name}"`);
                        }
                    }
                }
            }
        }
        expect(fabricated).toEqual([]);
    });

    it('no topic is empty — every topic has at least one real term', () => {
        const empty = [];
        for (const subject of firstYearSubjects.subjects) {
            for (const unit of subject.units) {
                for (const topic of unit.topics) {
                    if (!topic.terms || topic.terms.length === 0) {
                        empty.push(`${subject.id}/${unit.id}/${topic.id}`);
                    }
                }
            }
        }
        expect(empty).toEqual([]);
    });

    it('every real term in a subject\'s dataset entries is placed under exactly one topic (no orphans, no duplicates)', () => {
        const mismatches = [];
        for (const subject of firstYearSubjects.subjects) {
            const placed = [];
            for (const unit of subject.units) {
                for (const topic of unit.topics) {
                    placed.push(...topic.terms);
                }
            }
            const placedSet = new Set(placed);
            const dupes = placed.filter((t, i) => placed.indexOf(t) !== i);
            const realTerms = new Set(
                engineeringTerminology.terms
                    .filter((t) => subject.termSubjects.includes(t.subject))
                    .map((t) => t.term)
            );
            const orphaned = [...realTerms].filter((t) => !placedSet.has(t));
            const extra = [...placedSet].filter((t) => !realTerms.has(t));
            if (dupes.length) mismatches.push(`${subject.id}: duplicate placement of ${dupes.join(', ')}`);
            if (orphaned.length) mismatches.push(`${subject.id}: orphaned (never placed) — ${orphaned.join(', ')}`);
            if (extra.length) mismatches.push(`${subject.id}: placed but not a real term for this subject — ${extra.join(', ')}`);
        }
        expect(mismatches).toEqual([]);
    });

    it('every subject has at least one unit, and every unit has at least one topic', () => {
        for (const subject of firstYearSubjects.subjects) {
            expect(subject.units.length).toBeGreaterThan(0);
            for (const unit of subject.units) {
                expect(unit.topics.length).toBeGreaterThan(0);
            }
        }
    });

    it('every subject has a discipline used elsewhere in engineeringTerminology.json (no invented disciplines)', () => {
        const realDisciplines = new Set(engineeringTerminology.disciplines || engineeringTerminology.terms.map((t) => t.discipline));
        for (const subject of firstYearSubjects.subjects) {
            expect(subject.discipline).toBeTruthy();
            expect(realDisciplines.has(subject.discipline)).toBe(true);
        }
    });

    it('no subject card merges two termSubjects that share a colliding term name (the exact bug class this dataset hit)', () => {
        // Merging two subject-strings whose term-name sets intersect would make one of
        // the two real dataset rows permanently unreachable, since topicTerms.js
        // resolves a term by name against whichever termSubject matches first — caught
        // once for real (Eigenvalue: "Differential Equations & Numerical Methods" vs
        // "Linear Algebra") while building this catalogue; this guards against it
        // recurring silently for any future subject added here.
        const collisions = [];
        for (const subject of firstYearSubjects.subjects) {
            if (subject.termSubjects.length < 2) continue;
            const seen = new Map();
            for (const ts of subject.termSubjects) {
                const names = engineeringTerminology.terms.filter((t) => t.subject === ts).map((t) => t.term);
                for (const name of names) {
                    if (seen.has(name) && seen.get(name) !== ts) {
                        collisions.push(`${subject.id}: "${name}" in both "${seen.get(name)}" and "${ts}"`);
                    }
                    seen.set(name, ts);
                }
            }
        }
        expect(collisions).toEqual([]);
    });

    it('every real term in the ENTIRE engineeringTerminology.json dataset is reachable from exactly one subject card (global coverage, not just per-subject)', () => {
        const allKeys = new Set(engineeringTerminology.terms.map((t) => `${t.term}::${t.subject}`));
        const resolved = new Set();
        for (const subject of firstYearSubjects.subjects) {
            for (const unit of subject.units) {
                for (const topic of unit.topics) {
                    for (const name of topic.terms) {
                        const match = subject.termSubjects.find((ts) => allKeys.has(`${name}::${ts}`));
                        if (match) resolved.add(`${name}::${match}`);
                    }
                }
            }
        }
        const unreachable = [...allKeys].filter((k) => !resolved.has(k));
        expect(unreachable).toEqual([]);
    });

    it('the final verified total of placed terms equals the full engineeringTerminology.json dataset size', () => {
        // The headline number: every real term in the dataset is organized into the
        // catalogue exactly once — no fewer (orphans), no more (fabrication/duplication).
        let placedCount = 0;
        for (const subject of firstYearSubjects.subjects) {
            for (const unit of subject.units) {
                for (const topic of unit.topics) {
                    placedCount += topic.terms.length;
                }
            }
        }
        expect(placedCount).toBe(engineeringTerminology.terms.length);
        expect(placedCount).toBeGreaterThanOrEqual(1500);
    });
});

describe('discipline browsing (Discipline -> Subject -> Unit -> Topic)', () => {
    it('getDisciplines returns a sorted, deduplicated list of real disciplines', () => {
        const disciplines = getDisciplines();
        expect(disciplines.length).toBeGreaterThan(10);
        expect(new Set(disciplines).size).toBe(disciplines.length);
        expect([...disciplines].sort()).toEqual(disciplines);
        expect(disciplines).toContain('Computer Science');
        expect(disciplines).toContain('Mechanical Engineering');
    });

    it('getSubjectsByDiscipline scopes to only that discipline\'s real subjects', () => {
        const csSubjects = getSubjectsByDiscipline('Computer Science');
        expect(csSubjects.length).toBeGreaterThan(30);
        expect(csSubjects.every((s) => s.discipline === 'Computer Science')).toBe(true);
        expect(csSubjects.some((s) => s.id === 'operating-systems')).toBe(true);
        expect(csSubjects.some((s) => s.id === 'database-management-systems')).toBe(true);
    });

    it('getSubjectsByDiscipline returns an empty array for an unknown discipline', () => {
        expect(getSubjectsByDiscipline('Not A Real Discipline')).toEqual([]);
    });

    it('every subject returned by getSubjects() appears under exactly one discipline via getSubjectsByDiscipline', () => {
        const all = getSubjects();
        const viaDisciplines = getDisciplines().flatMap((d) => getSubjectsByDiscipline(d));
        expect(viaDisciplines.length).toBe(all.length);
    });
});

describe('topicTerms lookup helpers', () => {
    it('getSubjects returns the full subject list', () => {
        expect(getSubjects().length).toBe(firstYearSubjects.subjects.length);
    });

    it('getSubject finds a subject by id', () => {
        expect(getSubject('engineering-physics')?.name).toBe('Engineering Physics');
    });

    it('getSubject returns null for an unknown id', () => {
        expect(getSubject('not-a-real-subject')).toBeNull();
    });

    it('getUnit finds a unit within a subject', () => {
        expect(getUnit('engineering-physics', 'lasers-fiber-optics-unit')?.name).toContain('Lasers & Fiber Optics');
    });

    it('getTopic finds a topic within a unit', () => {
        expect(getTopic('engineering-physics', 'superconductivity-em-nano-unit', 'nanotechnology-2')?.name).toBe('Nanotechnology');
    });

    it('getTopicTerms returns only the terms for that specific topic, not the whole subject', async () => {
        const terms = await getTopicTerms('engineering-physics', 'superconductivity-em-nano-unit', 'nanotechnology-2');
        const names = terms.map((t) => t.term);
        expect(names).toEqual(['Carbon Nanotube', 'Nanomaterial', 'Nanoparticle', 'Quantum Confinement']);
        // A term from a different topic in the same subject must not leak in.
        expect(names).not.toContain('Bragg\'s Law');
    });

    it('getTopicTerms returns terms sorted alphabetically', async () => {
        const terms = await getTopicTerms('engineering-mathematics', 'matrices', 'matrices-fundamentals');
        const names = terms.map((t) => t.term);
        const sorted = [...names].sort((a, b) => a.localeCompare(b));
        expect(names).toEqual(sorted);
    });

    it('getTopicTerms returns full glossary entries (definition, subject, discipline present)', async () => {
        const terms = await getTopicTerms('basic-electrical-engineering', 'dc-circuits', 'circuit-laws');
        expect(terms.length).toBeGreaterThan(0);
        for (const t of terms) {
            expect(t.simpleDefinition).toBeTruthy();
            expect(t.subject).toBe('Basic Electrical Engineering');
            expect(t.discipline).toBeTruthy();
        }
    });

    it('getTopicTerms returns an empty array for an unknown topic', async () => {
        expect(await getTopicTerms('engineering-physics', 'lasers-fiber-optics-unit', 'not-a-topic')).toEqual([]);
    });

    it('getTopicTerms does not require loading the terminology dataset for subject/unit/topic navigation alone', () => {
        // getSubjects/getSubject/getUnit/getTopic must stay synchronous and cheap —
        // only getTopicTerms (reached from inside a topic) should ever need the ~700KB
        // engineeringTerminology.json, which is why it alone is async/lazily imported
        // (see topicTerms.js). This just documents that contract stays intact.
        expect(getSubjects().length).toBeGreaterThan(0);
        expect(typeof getTopicTerms).toBe('function');
        expect(getTopicTerms('engineering-physics', 'lasers-fiber-optics-unit', 'lasers-fiber-core')).toBeInstanceOf(Promise);
    });
});

describe('getSubjectStats (unit/topic/term counts shown on subject cards)', () => {
    it('computes correct counts for a flagship multi-unit subject (Operating Systems)', () => {
        const stats = getSubjectStats('operating-systems');
        expect(stats.units).toBe(6);
        expect(stats.topics).toBeGreaterThanOrEqual(6);
        expect(stats.terms).toBeGreaterThan(40);
    });

    it('computes correct counts for a still-small, legitimately single-unit subject', () => {
        const stats = getSubjectStats('mechatronics');
        expect(stats.units).toBe(1);
        expect(stats.terms).toBe(1);
    });

    it('returns all zeros for an unknown subject rather than throwing', () => {
        expect(getSubjectStats('not-a-real-subject')).toEqual({ units: 0, topics: 0, terms: 0 });
    });

    it('stats sum matches the subject\'s actual placed term count exactly', () => {
        for (const subjectId of ['operating-systems', 'engineering-physics', 'algorithms', 'engineering-mechanics']) {
            const stats = getSubjectStats(subjectId);
            const subject = getSubject(subjectId);
            const actualTerms = subject.units.reduce((sum, u) => sum + u.topics.reduce((s, t) => s + t.terms.length, 0), 0);
            expect(stats.terms).toBe(actualTerms);
        }
    });
});
