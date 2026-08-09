const axios = require('axios');
const modelManager = require('./modelManager');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Total time we are willing to spend sleeping on 429 backoff across one call.
const MAX_BACKOFF_BUDGET_MS = 10000;
const MAX_RETRIES = 2;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Reads the server-supplied retry delay from a RESOURCE_EXHAUSTED body,
 * which carries it as a google.rpc.RetryInfo detail like { retryDelay: "41s" }.
 * @returns {number|null} milliseconds
 */
function parseRetryDelayMs(responseData) {
    const details = responseData && responseData.error && responseData.error.details;
    if (!Array.isArray(details)) return null;

    const retryInfo = details.find(detail =>
        detail && typeof detail.retryDelay === 'string');
    if (!retryInfo) return null;

    const seconds = parseFloat(retryInfo.retryDelay);
    return Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : null;
}

/**
 * Service to interact with the Google Gemini Developer API.
 */
class GeminiService {
    /**
     * Whether a Gemini API key is configured. No network call.
     * @returns {boolean}
     */
    isAvailable() {
        return !!modelManager.getGeminiApiKey();
    }

    /**
     * Sends a prompt to Gemini, walking the free-tier model fallback list
     * (modelManager) if the current model's daily quota is exhausted. Never
     * selects a paid model — every candidate comes from the same free-tier list.
     * @param {string} prompt
     * @returns {Promise<string>}
     */
    async generateResponse(prompt) {
        const apiKey = modelManager.getGeminiApiKey();
        if (!apiKey) {
            throw new Error('Gemini API key is not configured.');
        }

        for (;;) {
            const model = modelManager.getGeminiModel();
            try {
                return await this._callModel(model, apiKey, prompt);
            } catch (error) {
                if (!error.isRateLimit) throw error;

                const nextModel = modelManager.advanceGeminiModel();
                if (!nextModel) throw error; // every free-tier candidate exhausted

                console.warn(`Gemini model "${model}" is out of free-tier quota today; switching to "${nextModel}".`);
            }
        }
    }

    /**
     * Single-model call with short in-budget 429 backoff (does not switch models).
     * @param {string} model
     * @param {string} apiKey
     * @param {string} prompt
     * @returns {Promise<string>}
     */
    async _callModel(model, apiKey, prompt) {
        const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const payload = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompt }]
                }
            ]
        };

        let response;
        let budgetMs = MAX_BACKOFF_BUDGET_MS;

        for (let attempt = 0; ; attempt++) {
            try {
                response = await axios.post(url, payload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 120000
                });
                break;
            } catch (error) {
                // Never surface the request URL: it carries the API key as a query param.
                const status = error.response ? error.response.status : null;
                const data = error.response && error.response.data;
                const apiMessage = data && data.error
                    ? data.error.message
                    : error.code || 'network error';

                if (status === 429 && attempt < MAX_RETRIES) {
                    const delayMs = parseRetryDelayMs(data);
                    // Only wait when the server's own delay fits the budget; a longer
                    // delay means the quota window will not reopen in time to be worth
                    // holding the request open.
                    if (delayMs !== null && delayMs <= budgetMs) {
                        console.warn(`Gemini rate limited; retrying in ${Math.round(delayMs / 1000)}s.`);
                        await sleep(delayMs);
                        budgetMs -= delayMs;
                        continue;
                    }
                }

                const failure = new Error(
                    `Gemini request failed${status ? ` (HTTP ${status})` : ''}: ${apiMessage}`);
                failure.isRateLimit = status === 429;
                throw failure;
            }
        }

        const candidate = response.data
            && Array.isArray(response.data.candidates)
            && response.data.candidates[0];
        const text = candidate
            && candidate.content
            && Array.isArray(candidate.content.parts)
            && candidate.content.parts.map(part => part.text || '').join('');

        if (!text || !text.trim()) {
            throw new Error('Unexpected response format from Gemini.');
        }

        return text.trim();
    }
}

module.exports = new GeminiService();
