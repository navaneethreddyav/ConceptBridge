// Hono/Workers port note: this used to be a stateful singleton (`new ModelManager()`)
// that read `process.env` once at module-load time via `require('dotenv').config()`.
// Neither survives the platform change: `dotenv` needs filesystem access Workers
// doesn't have (wrangler dev/deploy inject `.dev.vars`/secrets straight into `env`
// instead, no .env file read needed), and a module-level singleton can't hold
// request-scoped config since Worker env bindings only exist for the lifetime of a
// single fetch() call. Every function below is now a pure function of the `env` passed
// in by the caller (ultimately `c.env` from the Hono context) rather than closing over
// shared state — this also removes a latent cross-request race that the old
// `this.geminiModelIndex` mutable field had if two requests were ever in flight in the
// same process at once (see geminiService.js, which now keeps that walk-the-candidates
// index local to a single generateResponse() call instead of on this shared object).

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

// Dev-only Ollama fallback default — only ever reached if OLLAMA_URL is unset in env.
// Intentional per CLAUDE.md: Ollama stays a local development fallback, never the
// production path. Keep this gating exactly as-is.
const getOllamaUrl = (env) => (env && env.OLLAMA_URL) || 'http://localhost:11434';

const getCurrentModel = (env) => (env && env.OLLAMA_MODEL) || 'llama3';

const getGeminiApiKey = (env) => (env && env.GEMINI_API_KEY) || '';

/**
 * The ordered list of free-tier Gemini model candidates to try for one request. An
 * explicit GEMINI_MODEL is tried first, then the fallback list (minus itself, to avoid
 * retrying the same exhausted model twice).
 * @returns {string[]}
 */
const getGeminiCandidates = (env) => {
    const configured = ((env && env.GEMINI_MODEL) || '').trim();
    const envCandidates = ((env && env.GEMINI_MODEL_CANDIDATES) || '')
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);
    const fallbacks = envCandidates.length > 0 ? envCandidates : DEFAULT_GEMINI_CANDIDATES;

    return configured
        ? [configured, ...fallbacks.filter((m) => m !== configured)]
        : fallbacks;
};

export { getOllamaUrl, getCurrentModel, getGeminiApiKey, getGeminiCandidates };
