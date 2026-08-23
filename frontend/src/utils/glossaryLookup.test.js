import { describe, expect, it } from 'vitest';
import { lookupGlossaryTerm } from './glossaryLookup.js';

describe('lookupGlossaryTerm', () => {
    it('finds a term by its exact canonical name', async () => {
        const result = await lookupGlossaryTerm('Deadlock');
        expect(result).not.toBeNull();
        expect(result.term).toBe('Deadlock');
        expect(result.subject).toBe('Operating Systems');
        expect(result.discipline).toBe('Computer Science');
    });

    it('resolves an alias to its full glossary entry', async () => {
        const result = await lookupGlossaryTerm('DBMS');
        expect(result).not.toBeNull();
        expect(result.term).toBe('Database Management System');
    });

    it('resolves the OOP alias', async () => {
        const result = await lookupGlossaryTerm('OOP');
        expect(result).not.toBeNull();
        expect(result.term).toBe('Object-Oriented Programming');
    });

    it('is case-insensitive', async () => {
        const upper = await lookupGlossaryTerm('DEADLOCK');
        const lower = await lookupGlossaryTerm('deadlock');
        expect(upper?.term).toBe('Deadlock');
        expect(lower?.term).toBe('Deadlock');
    });

    it('ignores punctuation/whitespace differences the same way normalization does', async () => {
        const result = await lookupGlossaryTerm('Object Oriented Programming');
        expect(result?.term).toBe('Object-Oriented Programming');
    });

    it('returns null for an unrecognized term', async () => {
        const result = await lookupGlossaryTerm('Not A Real Engineering Term Xyz');
        expect(result).toBeNull();
    });

    it('returns null for empty input without throwing', async () => {
        expect(await lookupGlossaryTerm('')).toBeNull();
        expect(await lookupGlossaryTerm(null)).toBeNull();
    });

    it('finds terms from newly-added disciplines beyond the original first-year subjects', async () => {
        const mech = await lookupGlossaryTerm('Torque');
        const aero = await lookupGlossaryTerm('Lift');
        const bio = await lookupGlossaryTerm('CRISPR');
        expect(mech?.discipline).toBe('Mechanical Engineering');
        expect(aero?.discipline).toBe('Aerospace Engineering');
        expect(bio?.discipline).toBe('Biotechnology');
    });
});
