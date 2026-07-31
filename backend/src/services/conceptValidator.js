/**
 * Validates the structure of the concept objects.
 */
class ConceptValidator {
    /**
     * Validates an array of concept objects.
     * @param {Array} concepts - The parsed concepts array
     * @returns {Array} - The filtered, valid concepts
     */
    static validate(concepts) {
        if (!Array.isArray(concepts)) {
            throw new Error("Expected an array of concepts.");
        }

        return concepts.filter(concept => {
            const hasName = typeof concept.name === 'string' && concept.name.trim().length > 0;
            const hasSummary = typeof concept.summary === 'string' && concept.summary.trim().length > 0;
            return hasName && hasSummary;
        }).map(concept => ({
            id: concept.id || `concept_${Math.random().toString(36).substring(2, 9)}`,
            name: concept.name.trim(),
            summary: concept.summary.trim(),
            importance: typeof concept.importance === 'number' ? concept.importance : 5,
            confidence: typeof concept.confidence === 'number' ? concept.confidence : 0.8,
            page: typeof concept.page === 'number' ? concept.page : null,
            section: typeof concept.section === 'string' ? concept.section.trim() : "General",
            keywords: Array.isArray(concept.keywords) ? concept.keywords : [],
            relatedConcepts: Array.isArray(concept.relatedConcepts) ? concept.relatedConcepts : [],
            prerequisites: Array.isArray(concept.prerequisites) ? concept.prerequisites : []
        }));
    }
}

module.exports = ConceptValidator;
