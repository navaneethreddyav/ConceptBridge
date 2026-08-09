const geminiService = require('./geminiService');
const ollamaService = require('./ollamaService');

const BUSY_MESSAGE = 'AI service is temporarily busy, please try again shortly.';

/**
 * Single swap point for AI text generation.
 * Gemini is the production path; Ollama remains a local development fallback.
 */
class AiProvider {
    /**
     * @param {string} prompt
     * @returns {Promise<string>}
     */
    async generateResponse(prompt) {
        let geminiError = null;

        if (geminiService.isAvailable()) {
            try {
                return await geminiService.generateResponse(prompt);
            } catch (error) {
                geminiError = error;
                console.error('Gemini generation failed, falling back to Ollama:', error.message);
            }
        }

        try {
            return await ollamaService.generateResponse(prompt);
        } catch (ollamaError) {
            if (geminiError && geminiError.isRateLimit) {
                const busy = new Error(BUSY_MESSAGE);
                busy.userFacing = true;
                busy.statusCode = 503;
                throw busy;
            }
            throw ollamaError;
        }
    }
}

module.exports = new AiProvider();
