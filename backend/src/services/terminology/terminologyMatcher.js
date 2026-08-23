// wrangler's esbuild-based bundler supports importing JSON as a default export
// natively, no import-attribute syntax needed (same as Vite on the frontend side).
import engineeringTerminology from '../../../../shared/engineeringTerminology.json';

// Flattened once at module load — the dataset is a little over a thousand terms and
// static for the process lifetime, so there's no reason to rebuild this per call.
// This unified dataset is also the single source used by the frontend glossary — see
// frontend/src/utils/glossaryLookup.js and TechnicalTerms.jsx.
const ALL_TERMS = engineeringTerminology.terms;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// pdf.js's real extracted text can put irregular whitespace between words that are
// visually adjacent in the source PDF (confirmed directly: a real upload produced
// "congestion   control" with three spaces, not one) — a multi-word term's pattern
// must match one-or-more whitespace between its words, not the literal single space
// from the term's own text, or real-world multi-word terms silently never match.
// Same approach already used by the frontend highlighter (DocumentReader.jsx's
// buildTermRegex).
const escapeTermForRegex = (value) => escapeRegExp(value).replace(/ /g, '\\s+');

// Every string a term can be recognized by: its canonical name plus any aliases (e.g.
// "OS"/"Operating Systems" both resolve to the canonical term "Operating System",
// "DBMS" resolves to "Database Management System"). Longest-first (by original text
// length, before whitespace normalization) in the compiled regex so "Reinforced
// Concrete Design" matches whole rather than stopping at a shorter overlapping entry;
// word-boundary guards (Unicode-aware, same approach as the frontend highlighter)
// keep "AI" from matching inside "faith" or "certain" from matching inside
// "uncertain".
const MATCH_STRINGS = [];
for (const t of ALL_TERMS) {
    MATCH_STRINGS.push({ text: t.term, canonical: t });
    for (const alias of t.aliases || []) {
        MATCH_STRINGS.push({ text: alias, canonical: t });
    }
}
MATCH_STRINGS.sort((a, b) => b.text.length - a.text.length);

const MATCH_REGEX = new RegExp(
    `(?<![\\p{L}\\p{N}])(${MATCH_STRINGS.map((m) => escapeTermForRegex(m.text)).join('|')})(?![\\p{L}\\p{N}])`,
    'giu'
);

// Keyed by the matched term/alias text with internal whitespace COLLAPSED to a single
// space (not the raw matched substring, which may contain the same irregular
// whitespace the regex above just tolerated) so "congestion   control" (from the PDF)
// and "congestion control" (the dictionary key) resolve to the same entry. A handful
// of terms/aliases legitimately collide across subjects (e.g. "Stress" in both
// Mechanical and Civil) — picking the higher-importance entry is deterministic and
// doesn't depend on JSON iteration order.
const CANONICAL_BY_MATCH_TEXT = new Map();
for (const { text, canonical } of MATCH_STRINGS) {
    const key = text.toLowerCase();
    const existing = CANONICAL_BY_MATCH_TEXT.get(key);
    if (!existing || canonical.importance > existing.importance) {
        CANONICAL_BY_MATCH_TEXT.set(key, canonical);
    }
}

const normalizeMatchedText = (raw) => raw.toLowerCase().replace(/\s+/g, ' ');

/**
 * Matches known engineering terms (and their aliases) from the local dataset against
 * a text sample — zero network calls, zero Gemini quota. Used as a fast pre-filter/
 * supplement to AI-based concept detection (see conceptDetectionService.js for how
 * the two combine). A match on an alias (e.g. "TCP") is reported under its canonical
 * term name (e.g. "TCP" itself, or "Operating System" for a match on "OS").
 * @param {string} text
 * @returns {Array} concept-shaped objects, ranked by importance desc.
 */
const matchTerms = (text) => {
    if (!text) return [];

    // Keyed by canonical term id here (not matched text) so "OS" and "Operating
    // System" appearing in the same document count as one concept, not two.
    const seen = new Map();
    MATCH_REGEX.lastIndex = 0;
    let match = MATCH_REGEX.exec(text);
    while (match !== null) {
        const matchKey = normalizeMatchedText(match[0]);
        const entry = CANONICAL_BY_MATCH_TEXT.get(matchKey);
        if (entry) {
            const canonicalKey = entry.term.toLowerCase();
            const existing = seen.get(canonicalKey);
            if (existing) {
                existing.frequency += 1;
            } else {
                seen.set(canonicalKey, {
                    id: `dataset_${canonicalKey.replace(/[^a-z0-9]/g, '')}`,
                    name: entry.term,
                    summary: entry.simpleDefinition || '',
                    importance: entry.importance,
                    confidence: 0.95,
                    page: null,
                    section: entry.subject,
                    keywords: [],
                    relatedConcepts: [],
                    prerequisites: [],
                    source: 'dataset',
                    domain: entry.discipline,
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
