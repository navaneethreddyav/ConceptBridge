/**
 * Normalizes, deduplicates, and ranks concepts.
 */
class ConceptNormalizationService {
    /**
     * Normalizes a concept name to a standard format for comparison.
     * @param {string} name
     * @returns {string}
     */
    static normalizeName(name) {
        return name.toLowerCase()
            .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric (spaces, hyphens, brackets)
            .trim();
    }

    /**
     * Merges and ranks an array of concepts (which may contain duplicates from chunking).
     * @param {Array} allConcepts - Array of all detected concepts from all chunks
     * @returns {Array} - Unified, deduplicated, and ranked concepts
     */
    static process(allConcepts) {
        const conceptMap = new Map();

        for (const concept of allConcepts) {
            const normalizedKey = this.normalizeName(concept.name);

            if (conceptMap.has(normalizedKey)) {
                // Merge duplicate: boost importance/confidence and merge arrays
                const existing = conceptMap.get(normalizedKey);

                // Frequency boost
                existing.frequency = (existing.frequency || 1) + 1;

                // Pick the longest summary
                if (concept.summary && concept.summary.length > existing.summary.length) {
                    existing.summary = concept.summary;
                }

                // Prefer the capitalized/longer name for display (e.g., "Artificial Intelligence (AI)" over "AI")
                if (concept.name.length > existing.name.length) {
                    existing.name = concept.name;
                }

                // Average confidence and importance
                existing.confidence = (existing.confidence + concept.confidence) / 2;
                existing.importance = Math.min(10, existing.importance + 1); // Boost importance if mentioned multiple times

                // Merge arrays
                existing.keywords = [...new Set([...(existing.keywords || []), ...(concept.keywords || [])])];
                existing.relatedConcepts = [...new Set([...(existing.relatedConcepts || []), ...(concept.relatedConcepts || [])])];
                existing.prerequisites = [...new Set([...(existing.prerequisites || []), ...(concept.prerequisites || [])])];

                conceptMap.set(normalizedKey, existing);
            } else {
                // New concept
                concept.frequency = 1;
                concept.keywords = concept.keywords || [];
                concept.relatedConcepts = concept.relatedConcepts || [];
                concept.prerequisites = concept.prerequisites || [];
                conceptMap.set(normalizedKey, concept);
            }
        }

        // Convert back to array
        const mergedConcepts = Array.from(conceptMap.values());

        // Rank concepts: Sort primarily by importance, then by frequency, then by confidence
        mergedConcepts.sort((a, b) => {
            if (b.importance !== a.importance) {
                return b.importance - a.importance;
            }
            if (b.frequency !== a.frequency) {
                return b.frequency - a.frequency;
            }
            return b.confidence - a.confidence;
        });

        return mergedConcepts;
    }
}

export default ConceptNormalizationService;
