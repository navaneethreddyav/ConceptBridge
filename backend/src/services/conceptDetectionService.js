const ollamaService = require('./ai/ollamaService');
const promptService = require('./ai/promptService');
const ConceptParser = require('./conceptParser');
const ConceptValidator = require('./conceptValidator');
const ConceptNormalizationService = require('./conceptNormalizationService');

/**
 * Orchestrates the concept detection pipeline.
 */
class ConceptDetectionService {
    
    /**
     * Splits text into overlapping chunks.
     * @param {string} text 
     * @param {number} maxTokens roughly estimated by characters (e.g. 15000 chars)
     * @returns {Array<string>}
     */
    chunkText(text, maxChars = 15000, overlap = 1000) {
        const chunks = [];
        let i = 0;
        while (i < text.length) {
            chunks.push(text.slice(i, i + maxChars));
            i += maxChars - overlap;
        }
        return chunks;
    }

    /**
     * Analyzes document text and returns a validated, normalized list of concepts.
     * @param {string} text - The extracted document text
     * @returns {Promise<Array>} - List of valid concepts
     */
    async detectConcepts(text) {
        if (!text || text.trim().length === 0) {
            throw new Error("Document text is empty.");
        }

        const chunks = this.chunkText(text);
        let allConcepts = [];

        for (const chunk of chunks) {
            try {
                // 1. Generate Prompt
                const prompt = promptService.formatConceptExtractionPrompt(chunk);

                // 2. Call AI Service (Ollama)
                const rawResponse = await ollamaService.generateResponse(prompt);

                // 3. Parse JSON robustly
                const parsedData = ConceptParser.parse(rawResponse);
                
                if (parsedData && parsedData.concepts) {
                    // 4. Validate and sanitize concept objects
                    const validConcepts = ConceptValidator.validate(parsedData.concepts);
                    allConcepts.push(...validConcepts);
                }
            } catch (error) {
                console.warn("Failed to process a chunk, skipping...", error.message);
                // Continue with other chunks
            }
        }

        if (allConcepts.length === 0) {
            throw new Error("No valid concepts could be extracted from any part of the document.");
        }

        // 5. Normalize, deduplicate, and rank
        const unifiedConcepts = ConceptNormalizationService.process(allConcepts);

        return unifiedConcepts;
    }
}

module.exports = new ConceptDetectionService();
