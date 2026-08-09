require('dotenv').config();

// Free-tier-eligible Gemini models to fall back through when the current one's
// free-tier daily quota is exhausted. Never includes a paid-only model — this list
// is a resilience mechanism for staying inside the free tier, not a way around it.
// Google can rename/retire models over time; override with GEMINI_MODEL_CANDIDATES
// (comma-separated) if this default list goes stale.
const DEFAULT_GEMINI_CANDIDATES = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3.6-flash'
];

class ModelManager {
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        this.currentModel = process.env.OLLAMA_MODEL || 'llama3';

        const configured = (process.env.GEMINI_MODEL || '').trim();
        const envCandidates = (process.env.GEMINI_MODEL_CANDIDATES || '')
            .split(',')
            .map((m) => m.trim())
            .filter(Boolean);
        const fallbacks = envCandidates.length > 0 ? envCandidates : DEFAULT_GEMINI_CANDIDATES;

        // An explicit GEMINI_MODEL is tried first, then the fallback list (minus
        // itself, to avoid retrying the same exhausted model twice).
        this.geminiCandidates = configured
            ? [configured, ...fallbacks.filter((m) => m !== configured)]
            : fallbacks;
        this.geminiModelIndex = 0;
    }

    getOllamaUrl() {
        return this.ollamaUrl;
    }

    getCurrentModel() {
        return this.currentModel;
    }

    getGeminiModel() {
        return this.geminiCandidates[this.geminiModelIndex] || this.geminiCandidates[0];
    }

    /**
     * Advances to the next free-tier candidate after the current model's quota is
     * exhausted. Returns the new model name, or null if every candidate for this
     * process has already been tried (caller should stop, not loop).
     * @returns {string|null}
     */
    advanceGeminiModel() {
        if (this.geminiModelIndex >= this.geminiCandidates.length - 1) return null;
        this.geminiModelIndex += 1;
        return this.getGeminiModel();
    }

    getGeminiApiKey() {
        return process.env.GEMINI_API_KEY || '';
    }
}

module.exports = new ModelManager();
