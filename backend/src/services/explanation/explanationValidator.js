/**
 * Validates the structure of the explanation JSON.
 */
class ExplanationValidator {
    /**
     * Validates and sanitizes the explanation object.
     * @param {Object} data 
     * @returns {Object}
     */
    static validate(data) {
        if (!data || typeof data !== 'object') {
            throw new Error("Expected an explanation object.");
        }

        return {
            title: data.title || "Untitled Concept",
            definition: data.definition || "",
            simpleExplanation: data.simpleExplanation || "",
            whyItMatters: data.whyItMatters || "",
            stepByStepExplanation: Array.isArray(data.stepByStepExplanation) ? data.stepByStepExplanation : [],
            realLifeExample: data.realLifeExample || "",
            analogy: data.analogy || "",
            keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : [],
            commonMistakes: Array.isArray(data.commonMistakes) ? data.commonMistakes : [],
            relatedConcepts: Array.isArray(data.relatedConcepts) ? data.relatedConcepts : [],
            difficulty: data.difficulty || "Beginner"
        };
    }
}

module.exports = ExplanationValidator;
