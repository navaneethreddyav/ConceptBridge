const aiProvider = require('./ai/aiProvider');
const promptService = require('./ai/promptService');
const ConceptParser = require('./conceptParser');
const ConceptValidator = require('./conceptValidator');
const ConceptNormalizationService = require('./conceptNormalizationService');
const terminologyMatcher = require('./terminology/terminologyMatcher');

// Below this many dataset-matched terms, the sample isn't considered well covered by
// the local dataset (shared/terminologyDataset.json) and Gemini detection still runs,
// with dataset matches merged into its result afterward. At or above it, local
// coverage is treated as good enough on its own and the Gemini call — and the
// free-tier quota it costs — is skipped entirely for this document.
const MIN_DATASET_TERMS_TO_SKIP_GEMINI = 6;

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

        // Zero-quota local pass first. If it alone covers the document well enough,
        // skip Gemini entirely — this is the main free-tier-quota saving this service
        // provides. Otherwise fall through to Gemini as before and merge these in.
        const datasetMatches = terminologyMatcher.matchTerms(text);
        if (datasetMatches.length >= MIN_DATASET_TERMS_TO_SKIP_GEMINI) {
            return datasetMatches;
        }

        // Callers are expected to already pass a bounded sample (see
        // documentService.SAMPLE_PAGES), not a whole book — this cap is defense in
        // depth, not the primary control: it guarantees detection can never spend more
        // than a handful of Gemini calls regardless of what text it's actually given.
        const MAX_CHUNKS = 3;
        const chunks = this.chunkText(text).slice(0, MAX_CHUNKS);
        let allConcepts = [];
        let rateLimitError = null;
        let otherChunkFailed = false;

        for (const chunk of chunks) {
            try {
                // 1. Generate Prompt
                const prompt = promptService.formatConceptExtractionPrompt(chunk);

                // 2. Call AI Service
                const rawResponse = await aiProvider.generateResponse(prompt);

                // 3. Parse JSON robustly
                const parsedData = ConceptParser.parse(rawResponse);
                
                if (parsedData && parsedData.concepts) {
                    // 4. Validate and sanitize concept objects
                    const validConcepts = ConceptValidator.validate(parsedData.concepts);
                    allConcepts.push(...validConcepts);
                }
            } catch (error) {
                if (error.isRateLimit || error.statusCode === 503) {
                    rateLimitError = error;
                } else {
                    otherChunkFailed = true;
                }
                console.warn("Failed to process a chunk, skipping...", error.message);
                // Continue with other chunks
            }
        }

        if (allConcepts.length === 0 && datasetMatches.length === 0) {
            // A total failure caused purely by AI rate limiting keeps its 503/userFacing
            // tagging so the client sees the same "busy" message as the explanation path.
            if (rateLimitError && !otherChunkFailed) {
                throw rateLimitError;
            }
            throw new Error("No valid concepts could be extracted from any part of the document.");
        }

        // 5. Merge in the below-threshold dataset matches from above, then
        // normalize, deduplicate, and rank the combined set.
        const unifiedConcepts = ConceptNormalizationService.process([...allConcepts, ...datasetMatches]);

        return unifiedConcepts;
    }
}

module.exports = new ConceptDetectionService();
