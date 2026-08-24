import { describe, expect, it } from 'vitest';
import { matchTerms, ALL_TERMS } from './terminologyMatcher.js';

const findByName = (results, name) => results.find((r) => r.name.toLowerCase() === name.toLowerCase());

describe('terminologyMatcher dataset shape', () => {
    it('covers 1000+ terms across 100+ subjects (the expanded taxonomy)', () => {
        expect(ALL_TERMS.length).toBeGreaterThanOrEqual(1000);
        const subjects = new Set(ALL_TERMS.map((t) => t.subject));
        expect(subjects.size).toBeGreaterThanOrEqual(100);
    });

    it('has strong Computer Science coverage specifically', () => {
        const csTerms = ALL_TERMS.filter((t) => t.discipline === 'Computer Science');
        expect(csTerms.length).toBeGreaterThan(200);
    });

    it('covers disciplines beyond Computer Science', () => {
        const disciplines = new Set(ALL_TERMS.map((t) => t.discipline));
        for (const d of ['Mechanical Engineering', 'Civil Engineering', 'Electrical & Electronics Engineering', 'Aerospace Engineering', 'Biomedical Engineering']) {
            expect(disciplines.has(d)).toBe(true);
        }
    });
});

describe('matchTerms — the six required minimum cases', () => {
    it('"deadlock can occur when multiple processes wait" -> Deadlock, Operating Systems', () => {
        const results = matchTerms('A deadlock can occur when multiple processes wait indefinitely for resources.');
        const match = findByName(results, 'Deadlock');
        expect(match).toBeDefined();
        expect(match.section).toBe('Operating Systems');
    });

    it('"DBMS" -> Database Management System, Database Management Systems', () => {
        const results = matchTerms('A DBMS provides concurrent access and data integrity.');
        const match = findByName(results, 'Database Management System');
        expect(match).toBeDefined();
        expect(match.section).toBe('Database Management Systems');
    });

    it('"TCP uses congestion control" -> TCP, Congestion Control, Computer Networks', () => {
        const results = matchTerms('TCP uses congestion control to adjust its sending rate.');
        const tcp = findByName(results, 'TCP');
        const cc = findByName(results, 'Congestion Control');
        expect(tcp).toBeDefined();
        expect(tcp.section).toBe('Computer Networks');
        expect(cc).toBeDefined();
    });

    it('"gradient descent minimizes the loss function" -> Gradient Descent, Loss Function, Machine Learning', () => {
        const results = matchTerms('Gradient descent minimizes the loss function during training.');
        const gd = findByName(results, 'Gradient Descent');
        const lf = findByName(results, 'Loss Function');
        expect(gd).toBeDefined();
        expect(gd.section).toBe('Machine Learning');
        expect(lf).toBeDefined();
        expect(lf.section).toBe('Machine Learning');
    });

    it('"stress" -> Stress, Strength of Materials', () => {
        const results = matchTerms('The beam experiences significant stress under load.');
        const match = findByName(results, 'Stress');
        expect(match).toBeDefined();
        expect(match.section).toBe('Strength of Materials');
    });

    it('"PID controller" -> PID Controller, Control Systems', () => {
        const results = matchTerms('The system uses a PID controller to minimize error.');
        const match = findByName(results, 'PID Controller');
        expect(match).toBeDefined();
        expect(match.section).toBe('Control Systems');
    });
});

describe('matchTerms — aliases resolve to the canonical term', () => {
    it('"OS" resolves to the canonical term "Operating System"', () => {
        const results = matchTerms('The OS schedules processes on the CPU.');
        expect(findByName(results, 'Operating System')).toBeDefined();
        expect(findByName(results, 'OS')).toBeUndefined();
    });

    it('"OOP" resolves to the canonical term "Object-Oriented Programming"', () => {
        const results = matchTerms('OOP relies on encapsulation and inheritance.');
        expect(findByName(results, 'Object-Oriented Programming')).toBeDefined();
    });

    it('a term and its alias appearing together count as one concept, not two', () => {
        const results = matchTerms('The OS is an Operating System that manages hardware.');
        const matches = results.filter((r) => r.name === 'Operating System');
        expect(matches).toHaveLength(1);
        expect(matches[0].frequency).toBe(2);
    });
});

describe('matchTerms — multi-word technical phrases are preserved, not split into random words', () => {
    it('matches "load balancing algorithm" as one concept', () => {
        const results = matchTerms('A well designed load balancing algorithm reduces latency.');
        expect(findByName(results, 'Load Balancing')).toBeDefined();
    });

    it('matches "distributed consensus algorithm" style multi-word terms without over-splitting', () => {
        const results = matchTerms('Distributed consensus algorithm implementations must tolerate node failures.');
        expect(findByName(results, 'Distributed Consensus')).toBeDefined();
    });

    it('matches a multi-word term across irregular whitespace, as real pdf.js text extraction produces', () => {
        // Reproduced directly against a real production upload: pdf.js's extracted
        // text put three spaces between some adjacent words instead of one, which
        // silently broke multi-word term matching before this was fixed to use \s+
        // between a term's words instead of a literal space.
        const results = matchTerms('TCP   uses   congestion   control   to   avoid   overwhelming   the   network.');
        expect(findByName(results, 'Congestion Control')).toBeDefined();
        expect(findByName(results, 'TCP')).toBeDefined();
    });

    it('does not match a substring inside an unrelated longer word', () => {
        // "AI" (an alias of "Artificial Intelligence") must not match inside
        // "faith"/"maintain" style words — word-boundary guarded matching.
        const results = matchTerms('We must maintain faith in the process.');
        expect(findByName(results, 'Artificial Intelligence')).toBeUndefined();
    });
});

describe('matchTerms — case-insensitive, empty, and unknown input', () => {
    it('matches regardless of case', () => {
        const upper = matchTerms('DEADLOCK is a classic OS problem.');
        const lower = matchTerms('deadlock is a classic os problem.');
        expect(findByName(upper, 'Deadlock')).toBeDefined();
        expect(findByName(lower, 'Deadlock')).toBeDefined();
    });

    it('returns an empty array for empty/falsy input', () => {
        expect(matchTerms('')).toEqual([]);
        expect(matchTerms(null)).toEqual([]);
        expect(matchTerms(undefined)).toEqual([]);
    });

    it('returns an empty array for text with no recognizable technical terms', () => {
        const results = matchTerms('The cat sat quietly on the warm windowsill yesterday afternoon.');
        expect(results).toEqual([]);
    });
});

describe('matchTerms — additional real-world sentence detection', () => {
    it('"the transformer transfers electrical energy" -> Transformer', () => {
        const results = matchTerms('The transformer transfers electrical energy from one circuit to another.');
        const match = findByName(results, 'Transformer');
        expect(match).toBeDefined();
    });

    it('"TCP provides reliable transmission" -> TCP', () => {
        const results = matchTerms('TCP provides reliable transmission of data between hosts.');
        expect(findByName(results, 'TCP')).toBeDefined();
    });
});
