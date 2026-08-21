// Lightweight, lazily-loaded lookup into the first-year terminology glossary, used
// only to flag "Recognized first-year engineering term" on a PDF selection. Cached
// at module scope so the ~250KB dataset is fetched at most once per page session,
// and only the first time it's actually needed — never on initial app load.
let cachePromise = null;

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const loadIndex = () => {
    if (!cachePromise) {
        cachePromise = import('../../../shared/firstYearTerminology.json').then((mod) => {
            const map = new Map();
            mod.default.terms.forEach((t) => map.set(t.normalizedTerm, t));
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
