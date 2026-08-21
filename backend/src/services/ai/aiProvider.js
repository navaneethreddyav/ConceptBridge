import * as geminiService from './geminiService.js';
import * as ollamaService from './ollamaService.js';

const BUSY_MESSAGE = 'AI service is temporarily busy, please try again shortly.';

/**
 * Single swap point for AI text generation.
 * Gemini is the production path; Ollama remains a local development fallback.
 * @param {Object} env
 * @param {string} prompt
 * @returns {Promise<string>}
 */
const generateResponse = async (env, prompt) => {
    let geminiError = null;

    if (geminiService.isAvailable(env)) {
        try {
            return await geminiService.generateResponse(env, prompt);
        } catch (error) {
            geminiError = error;
            console.error('Gemini generation failed, falling back to Ollama:', error.message);
        }
    }

    try {
        return await ollamaService.generateResponse(env, prompt);
    } catch (ollamaError) {
        if (geminiError && geminiError.isRateLimit) {
            const busy = new Error(BUSY_MESSAGE);
            busy.userFacing = true;
            busy.statusCode = 503;
            throw busy;
        }
        throw ollamaError;
    }
};

export { generateResponse };
