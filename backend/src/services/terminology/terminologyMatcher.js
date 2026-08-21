// wrangler's esbuild-based bundler supports importing JSON as a default export
// natively, no import-attribute syntax needed (same as Vite on the frontend side).
import terminologyDataset from '../../../../shared/terminologyDataset.json';

const { domains } = terminologyDataset;

// Flattened once at module load — the dataset is small (a few hundred terms) and
// static for the process lifetime, so there's no reason to rebuild this per call.
const ALL_TERMS = Object.entries(domains).flatMap(([domainKey, domain]) =>
    domain.terms.map((entry) => ({ ...entry, domain: domainKey }))
);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Longest-first so "Reinforced Concrete Design" matches whole rather than stopping at
// the substring "Reinforced Cement Concrete" or similar shorter overlapping entries;
// word-boundary guards (Unicode-aware, same approach as the frontend highlighter in
// DocumentReader.jsx) keep "AI" from matching inside "faith" or "certain" from
// matching inside "uncertain".
const MATCH_REGEX = new RegExp(
    `(?<![\\p{L}\\p{N}])(${ALL_TERMS.map((t) => escapeRegExp(t.term)).sort((a, b) => b.length - a.length).join('|')})(?![\\p{L}\\p{N}])`,
    'giu'
);

// A handful of terms legitimately appear in more than one domain (e.g. "Stress" in
// both Mechanical and Civil). Building this map with a plain constructor would let
// whichever domain happens to iterate last silently win; picking the higher-importance
// entry instead is deterministic and doesn't depend on JSON key order.
const TERMS_BY_LOWER = new Map();
for (const t of ALL_TERMS) {
    const key = t.term.toLowerCase();
    const existing = TERMS_BY_LOWER.get(key);
    if (!existing || t.importance > existing.importance) {
        TERMS_BY_LOWER.set(key, t);
    }
}

/**
 * Matches known engineering terms from the local dataset against a text sample —
 * zero network calls, zero Gemini quota. Used as a fast pre-filter/supplement to
 * AI-based concept detection (see conceptDetectionService.js for how the two combine).
 * @param {string} text
 * @returns {Array} concept-shaped objects, ranked by importance desc.
 */
const matchTerms = (text) => {
    if (!text) return [];

    const seen = new Map();
    MATCH_REGEX.lastIndex = 0;
    let match = MATCH_REGEX.exec(text);
    while (match !== null) {
        const key = match[0].toLowerCase();
        const entry = TERMS_BY_LOWER.get(key);
        if (entry) {
            const existing = seen.get(key);
            if (existing) {
                existing.frequency += 1;
            } else {
                seen.set(key, {
                    id: `dataset_${key.replace(/[^a-z0-9]/g, '')}`,
                    name: entry.term,
                    summary: '',
                    importance: entry.importance,
                    confidence: 0.95,
                    page: null,
                    section: entry.subject,
                    keywords: [],
                    relatedConcepts: [],
                    prerequisites: [],
                    source: 'dataset',
                    domain: entry.domain,
                    frequency: 1
                });
            }
        }
        if (match[0].length === 0) MATCH_REGEX.lastIndex += 1;
        match = MATCH_REGEX.exec(text);
    }

    return Array.from(seen.values()).sort((a, b) => b.importance - a.importance || b.frequency - a.frequency);
};

export { matchTerms, ALL_TERMS };
