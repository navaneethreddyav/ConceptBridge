const ollamaService = require('../ai/ollamaService');
const promptService = require('../ai/promptService');
const ExplanationParser = require('./explanationParser');
const ExplanationValidator = require('./explanationValidator');

class ExplanationService {
    constructor() {
        this.cache = new Map();
    }

    async generateExplanation(conceptName, contextText, language = 'English', difficulty = 'Beginner', documentId = 'unknown') {
        if (!conceptName) {
            throw new Error("Concept name is required to generate an explanation.");
        }

        // Cache key: documentId + concept + difficulty + language
        const cacheKey = `${documentId}_${conceptName}_${difficulty}_${language}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // 1. Format Prompt
        const prompt = promptService.formatExplanationPrompt(conceptName, contextText || "", language, difficulty);

        // 2. Call AI Service
        const rawResponse = await ollamaService.generateResponse(prompt);

        // 3. Parse JSON
        const parsedData = ExplanationParser.parse(rawResponse);

        // 4. Validate
        const validExplanation = ExplanationValidator.validate(parsedData);
        
        // Save to cache
        this.cache.set(cacheKey, validExplanation);

        return validExplanation;
    }
}

module.exports = new ExplanationService();
