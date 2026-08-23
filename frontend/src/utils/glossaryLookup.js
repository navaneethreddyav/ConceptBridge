// Lightweight, lazily-loaded lookup into the engineering terminology glossary, used
// only to flag "Recognized engineering term" on a PDF selection. Cached at module
// scope so the dataset is fetched at most once per page session, and only the first
// time it's actually needed — never on initial app load.
let cachePromise = null;

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const loadIndex = () => {
    if (!cachePromise) {
        cachePromise = import('../../../shared/engineeringTerminology.json').then((mod) => {
            const map = new Map();
            // Index by canonical term AND every alias (normalized the same way) so a
            // selection of "OS" or "DBMS" still cross-references the full glossary
            // entry for "Operating System" / "Database Management System".
            mod.default.terms.forEach((t) => {
                map.set(t.normalizedTerm, t);
                (t.aliases || []).forEach((alias) => {
                    const key = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (!map.has(key)) map.set(key, t);
                });
            });
            return map;
        });
    }
    return cachePromise;
};

/**
 * @param {string} text - a selected/detected concept name
 * @returns {Promise<Object|null>} the matching glossary entry, or null
 */
export const lookupGlossaryTerm = async (text) => {
    if (!text) return null;
    const index = await loadIndex();
    return index.get(normalize(text)) || null;
};
