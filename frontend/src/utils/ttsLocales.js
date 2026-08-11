// Single authoritative language -> speech-synthesis configuration for every language
// ConceptBridge's translation system actually supports (see
// shared/supportedLanguages.json — the source of truth for the language list itself;
// this file only adds the speech-locale layer on top of it, and does not invent any
// language the app doesn't already support).
//
// fallbackLocales must only ever contain locale variants of the SAME language (e.g. a
// different regional tag) — never a different language. Falling back to an unrelated
// language's voice produces confidently-wrong pronunciation, which is worse than
// honestly saying voice playback isn't available.
export const TTS_LANGUAGE_CONFIG = {
    English: {
        code: 'en',
        preferredLocale: 'en-IN',
        fallbackLocales: ['en-US', 'en-GB', 'en-AU', 'en'],
        nativeTtsCommonlyAvailable: true
    },
    Hindi: {
        code: 'hi',
        preferredLocale: 'hi-IN',
        fallbackLocales: ['hi'],
        nativeTtsCommonlyAvailable: true
    },
    Telugu: {
        code: 'te',
        preferredLocale: 'te-IN',
        fallbackLocales: ['te'],
        nativeTtsCommonlyAvailable: false
    },
    Tamil: {
        code: 'ta',
        preferredLocale: 'ta-IN',
        fallbackLocales: ['ta-LK', 'ta'],
        nativeTtsCommonlyAvailable: false
    },
    Gujarati: {
        code: 'gu',
        preferredLocale: 'gu-IN',
        fallbackLocales: ['gu'],
        nativeTtsCommonlyAvailable: false
    },
    Marathi: {
        code: 'mr',
        preferredLocale: 'mr-IN',
        fallbackLocales: ['mr'],
        nativeTtsCommonlyAvailable: false
    },
    Bengali: {
        code: 'bn',
        preferredLocale: 'bn-IN',
        fallbackLocales: ['bn-BD', 'bn'],
        nativeTtsCommonlyAvailable: false
    }
};

const norm = (value) => (value || '').toLowerCase();

/**
 * Finds a voice genuinely compatible with the requested language from the browser's
 * actual voice list. Never returns a voice for a different language — an incompatible
 * voice is worse than no voice, since it produces confidently-wrong pronunciation.
 *
 * Algorithm: exact preferred-locale match -> bare-language-code match (any region
 * variant of the same language) -> approved same-language fallback locales -> null.
 *
 * @param {SpeechSynthesisVoice[]} voices
 * @param {{code: string, preferredLocale: string, fallbackLocales: string[]}} config
 * @returns {SpeechSynthesisVoice|null}
 */
export function findCompatibleVoice(voices, config) {
    if (!voices || voices.length === 0 || !config) return null;

    const preferred = norm(config.preferredLocale);
    const code = norm(config.code);
    const isSameLanguage = (voiceLang) => {
        const v = norm(voiceLang);
        return v === code || v.startsWith(`${code}-`);
    };

    // 1. Exact preferred locale (e.g. "mr-IN").
    let match = voices.find((v) => norm(v.lang) === preferred);
    if (match) return match;

    // 2. Any region variant of the same language (e.g. "mr" or "mr-XX").
    match = voices.find((v) => isSameLanguage(v.lang));
    if (match) return match;

    // 3. Explicitly approved fallback locales — still the same language, e.g.
    // Bengali's "bn-BD" when only that variant exists.
    for (const fallback of config.fallbackLocales || []) {
        const fb = norm(fallback);
        match = voices.find((v) => norm(v.lang) === fb || norm(v.lang).startsWith(`${fb}-`));
        if (match) return match;
    }

    // 4. No compatible voice — the caller must not speak, and must say so.
    return null;
}

/**
 * @param {string} language - a display name from shared/supportedLanguages.json
 * @returns {{code: string, preferredLocale: string, fallbackLocales: string[], nativeTtsCommonlyAvailable: boolean}}
 */
export function getTtsConfig(language) {
    return TTS_LANGUAGE_CONFIG[language] || TTS_LANGUAGE_CONFIG.English;
}
