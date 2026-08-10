const aiProvider = require('../ai/aiProvider');
const promptService = require('../ai/promptService');
const visualService = require('../visual/visualService');
const ExplanationParser = require('./explanationParser');
const ExplanationValidator = require('./explanationValidator');

// Trim/lowercase/collapse-whitespace so trivially different selections (casing,
// stray spaces) of the same term+context still hit the cache.
const normalize = (value) => (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

class ExplanationService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * @param {string} conceptName - The text the reader selected
     * @param {{contextBefore?: string, contextAfter?: string}} context
     * @param {string} language
     * @param {string} difficulty
     * @param {string} documentId
     * @returns {Promise<{explanation: Object, visual: Object}>}
     */
    async generateExplanation(conceptName, context = {}, language = 'English', difficulty = 'Beginner', documentId = 'unknown') {
        if (!conceptName) {
            throw new Error("Concept name is required to generate an explanation.");
        }

        // documentId is content-derived (see documentService.js), so this key also
        // naturally caches across re-uploads of the same PDF, not just re-selections
        // within one session — the same term+context+language never re-spends quota.
        const cacheKey = [
            documentId,
            normalize(conceptName),
            normalize(context.contextBefore),
            normalize(context.contextAfter),
            language,
            difficulty
        ].join('|');
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const prompt = promptService.formatExplanationPrompt(
            conceptName,
            context.contextBefore || '',
            context.contextAfter || '',
            language,
            difficulty
        );

        // A malformed/unparseable model response is rare but real (observed in
        // production as an intermittent 500) — one retry of the whole generate+parse
        // cycle before giving up, since a fresh generation often succeeds where the
        // first one didn't.
        let validExplanation;
        try {
            const rawResponse = await aiProvider.generateResponse(prompt);
            validExplanation = ExplanationValidator.validate(ExplanationParser.parse(rawResponse));
        } catch (error) {
            if (error.userFacing) throw error; // e.g. the rate-limit "busy" message — don't mask it with a retry
            const rawResponse = await aiProvider.generateResponse(prompt);
            validExplanation = ExplanationValidator.validate(ExplanationParser.parse(rawResponse));
        }

        const { visualSpec, ...explanation } = validExplanation;
        const result = {
            explanation,
            visual: visualService.generate(visualSpec)
        };

        this.cache.set(cacheKey, result);

        return result;
    }
}

module.exports = new ExplanationService();
