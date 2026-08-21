import * as aiProvider from '../ai/aiProvider.js';
import promptService from '../ai/promptService.js';
import visualService from '../visual/visualService.js';
import ExplanationParser from './explanationParser.js';
import ExplanationValidator from './explanationValidator.js';

// Trim/lowercase/collapse-whitespace so trivially different selections (casing,
// stray spaces) of the same term+context still hit the cache.
const normalize = (value) => (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Explanations for a given documentId+concept+context+language+difficulty are stable
// content (the same selection always deserves the same answer), so a long TTL just
// avoids re-spending Gemini free-tier quota on a repeat read, not a staleness risk.
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * KV keys are capped at 512 bytes (Workers KV limit), but the cache-key components
 * below can include up to ~8000 characters of surrounding document context (see
 * promptService's CONTEXT_CHAR_LIMIT) — so the composite key is hashed with Web Crypto
 * SHA-256 (the same Workers-compatible replacement for Node's `crypto` module used
 * elsewhere in this migration, e.g. userIdentity.js) rather than used verbatim. Hashing
 * preserves the exact same keying/discrimination logic (identical inputs -> identical
 * key, any differing input -> a different key); it only bounds the stored key's length.
 * @returns {Promise<string>} lowercase hex digest
 */
const sha256Hex = async (text) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Mirrors the original in-memory Map's cache key exactly: documentId (so the same
 * term+context+language never re-spends quota, even across re-uploads of the same PDF,
 * since documentId is content-derived) + normalized concept name + normalized
 * before/after context + language + difficulty.
 */
const buildCacheKey = async (documentId, conceptName, context, language, difficulty) => {
    const raw = [
        documentId,
        normalize(conceptName),
        normalize(context.contextBefore),
        normalize(context.contextAfter),
        language,
        difficulty
    ].join('|');
    return `explanation:${await sha256Hex(raw)}`;
};

/**
 * @param {Object} env
 * @param {string} conceptName - The text the reader selected
 * @param {{contextBefore?: string, contextAfter?: string}} context
 * @param {string} language
 * @param {string} difficulty
 * @param {string} documentId
 * @returns {Promise<{explanation: Object, visual: Object}>}
 */
const generateExplanation = async (env, conceptName, context = {}, language = 'English', difficulty = 'Beginner', documentId = 'unknown') => {
    if (!conceptName) {
        throw new Error("Concept name is required to generate an explanation.");
    }

    const cacheKey = await buildCacheKey(documentId, conceptName, context, language, difficulty);

    const cached = await env.CACHE_KV.get(cacheKey, 'json');
    if (cached) {
        return cached;
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
        const rawResponse = await aiProvider.generateResponse(env, prompt);
        validExplanation = ExplanationValidator.validate(ExplanationParser.parse(rawResponse));
    } catch (error) {
        if (error.userFacing) throw error; // e.g. the rate-limit "busy" message — don't mask it with a retry
        const rawResponse = await aiProvider.generateResponse(env, prompt);
        validExplanation = ExplanationValidator.validate(ExplanationParser.parse(rawResponse));
    }

    const { visualSpec, ...explanation } = validExplanation;
    const result = {
        explanation,
        visual: visualService.generate(visualSpec)
    };

    await env.CACHE_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL_SECONDS });

    return result;
};

export { generateExplanation };
