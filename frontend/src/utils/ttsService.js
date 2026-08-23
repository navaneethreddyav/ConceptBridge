// Single authoritative TTS service for ConceptBridge's voice playback. VoicePlayer.jsx
// should never touch window.speechSynthesis / SpeechSynthesisUtterance / voiceschanged
// directly — everything browser-specific lives here.
//
// Language -> speech-synthesis configuration for every language ConceptBridge's
// translation system supports (see shared/supportedLanguages.json — the source of
// truth for the language list itself; this file only adds the speech-locale layer on
// top of it, and does not invent any language the app doesn't already support).
//
// fallbackLocales must only ever contain locale variants of the SAME language (e.g. a
// different regional tag) — never a different language. Falling back to an unrelated
// language's voice produces confidently-wrong pronunciation, which is worse than
// honestly saying voice playback isn't available.
export const TTS_LANGUAGE_CONFIG = {
    English: { code: 'en', preferredLocale: 'en-IN', fallbackLocales: ['en-US', 'en-GB', 'en-AU', 'en'] },
    Hindi: { code: 'hi', preferredLocale: 'hi-IN', fallbackLocales: ['hi'] },
    Telugu: { code: 'te', preferredLocale: 'te-IN', fallbackLocales: ['te'] },
    Tamil: { code: 'ta', preferredLocale: 'ta-IN', fallbackLocales: ['ta-LK', 'ta'] },
    Gujarati: { code: 'gu', preferredLocale: 'gu-IN', fallbackLocales: ['gu'] },
    Marathi: { code: 'mr', preferredLocale: 'mr-IN', fallbackLocales: ['mr'] },
    Bengali: { code: 'bn', preferredLocale: 'bn-IN', fallbackLocales: ['bn-BD', 'bn'] },
    Malayalam: { code: 'ml', preferredLocale: 'ml-IN', fallbackLocales: ['ml'] },
    Kannada: { code: 'kn', preferredLocale: 'kn-IN', fallbackLocales: ['kn'] }
};

const DEV = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

// Dev-only, and deliberately never passed the utterance text itself — only language
// metadata and voice names/langs (never document/explanation content, cookies, or
// tokens, none of which this module ever sees anyway).
const devLog = (...args) => {
    if (DEV) console.log('[TTS]', ...args);
};

const norm = (value) => (value || '').toLowerCase();

/**
 * @param {string} language - a display name from shared/supportedLanguages.json
 */
export function getTtsConfig(language) {
    return TTS_LANGUAGE_CONFIG[language] || TTS_LANGUAGE_CONFIG.English;
}

/**
 * Finds a voice genuinely compatible with the requested language from the browser's
 * actual voice list. Never returns a voice for a different language — an incompatible
 * voice is worse than no voice, since it produces confidently-wrong pronunciation.
 *
 * Algorithm: exact preferred-locale match -> bare-language-code match (any region
 * variant of the same language) -> approved same-language fallback locales -> null.
 *
 * A null return is NOT a verdict that the language is unsupported — Safari/WebKit is
 * known to under-report installed voices (especially downloaded/enhanced ones)
 * through getVoices(), so a missing enumeration entry doesn't mean the OS can't
 * actually speak it. Callers must still attempt playback (see TtsSession below) with
 * utterance.lang set to the requested locale and treat a genuine onerror/no-start
 * timeout, not an empty search, as the real signal of unavailability.
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

    return null;
}

/**
 * Waits for the browser's voice list to populate, via 'voiceschanged' plus a bounded
 * poll (some WebKit versions return an empty list on the first getVoices() call and
 * never reliably fire 'voiceschanged' afterwards) — and refreshes once more
 * immediately after 'voiceschanged' does fire, in case the event arrives mid-poll.
 * Always resolves (never rejects) with whatever list is available, including an empty
 * one — an empty/incomplete result is not itself a failure signal, see
 * findCompatibleVoice's note above.
 *
 * @param {SpeechSynthesis} synth
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
export function waitForVoices(synth, { pollMs = 250, maxAttempts = 12 } = {}) {
    return new Promise((resolve) => {
        let settled = false;
        let timer = null;

        const finish = (voices) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            synth.removeEventListener?.('voiceschanged', onVoicesChanged);
            resolve(voices);
        };

        const attempt = (n) => {
            const voices = synth.getVoices();
            if (voices.length > 0 || n >= maxAttempts) {
                finish(voices);
                return;
            }
            timer = setTimeout(() => attempt(n + 1), pollMs);
        };

        function onVoicesChanged() {
            if (settled) return;
            if (timer) clearTimeout(timer);
            finish(synth.getVoices());
        }

        synth.addEventListener?.('voiceschanged', onVoicesChanged);
        attempt(0);
    });
}

// iOS/macOS Safari has historically truncated or silently dropped very long single
// utterances. Chunking at sentence boundaries and queueing keeps each utterance short
// and lets playback continue automatically from one chunk to the next.
const MAX_CHUNK_CHARS = 200;
// If the FIRST chunk's utterance never fires onstart (and never fires onerror either)
// within this window, treat it as a real failure — some WebKit versions silently no-op
// speak() for a voice/lang combination they can't actually handle, firing neither
// event at all, which an error-only check would wait on forever.
const START_TIMEOUT_MS = 4000;

const chunkText = (text) => {
    // Split after sentence-ending punctuation (., !, ?, or the Devanagari danda used
    // in Hindi/Marathi/Bengali) followed by whitespace, keeping the punctuation.
    const sentences = text.split(/(?<=[.!?।])\s+/).filter(Boolean);
    const chunks = [];
    let current = '';

    const pushCurrent = () => {
        if (current) chunks.push(current);
        current = '';
    };

    for (const sentence of sentences) {
        if (sentence.length > MAX_CHUNK_CHARS) {
            // A single "sentence" longer than the cap (e.g. no punctuation at all) —
            // hard-split on whitespace so no chunk is ever too long.
            pushCurrent();
            let rest = sentence;
            while (rest.length > MAX_CHUNK_CHARS) {
                let cut = rest.lastIndexOf(' ', MAX_CHUNK_CHARS);
                if (cut <= 0) cut = MAX_CHUNK_CHARS;
                chunks.push(rest.slice(0, cut).trim());
                rest = rest.slice(cut).trim();
            }
            current = rest;
            continue;
        }

        const candidate = current ? `${current} ${sentence}` : sentence;
        if (candidate.length > MAX_CHUNK_CHARS && current) {
            pushCurrent();
            current = sentence;
        } else {
            current = candidate;
        }
    }
    pushCurrent();

    return chunks.length > 0 ? chunks : [text];
};

/**
 * Owns one browser speechSynthesis session: chunking, queueing, cancellation, and
 * genuine-failure detection. One instance per VoicePlayer mount.
 *
 * Playback is always attempted with utterance.lang set to the requested locale, voice
 * object included only when a genuinely same-language match was found — never a voice
 * from a different language, so a "best effort" attempt can never silently substitute
 * one language's speech for another's. What CAN happen, and is an inherent limitation
 * of the Web Speech API rather than something this module can detect or prevent: if
 * the OS has no compatible voice at all and the browser silently falls back to some
 * other default voice instead of raising an error, speech will play in the wrong
 * voice with no error event to catch. See VoicePlayer.jsx / the deployment notes for
 * the honest write-up of this residual limitation.
 */
export class TtsSession {
    constructor(synth) {
        this.synth = synth;
        this.queue = [];
        this.currentUtterance = null;
        this.startTimer = null;
        this.destroyed = false;
    }

    _clearStartTimer() {
        if (this.startTimer) {
            clearTimeout(this.startTimer);
            this.startTimer = null;
        }
    }

    /** Stops any in-progress speech and clears pending chunks/timers. */
    stop() {
        this._clearStartTimer();
        this.synth.cancel();
        this.queue = [];
        this.currentUtterance = null;
    }

    pause() {
        this.synth.pause();
    }

    resume() {
        this.synth.resume();
    }

    destroy() {
        this.destroyed = true;
        this.stop();
    }

    /**
     * @param {string} text
     * @param {{voice: SpeechSynthesisVoice|null, locale: string}} voiceInfo
     * @param {{
     *   onStart?: () => void,       // first chunk genuinely started speaking
     *   onEnd?: () => void,         // all chunks finished
     *   onCanceled?: () => void,    // stopped by us (stop()/a newer speak()), not a failure
     *   onFailure?: (reason: string, info: {isFirstChunk: boolean}) => void
     * }} callbacks
     */
    speak(text, voiceInfo, callbacks = {}) {
        this.stop();
        devLog('speak requested', { locale: voiceInfo.locale, hasVoiceMatch: Boolean(voiceInfo.voice) });
        this.queue = chunkText(text);
        this._speakChunk(0, voiceInfo, callbacks);
    }

    _speakChunk(index, voiceInfo, callbacks) {
        if (this.destroyed) return;
        if (index >= this.queue.length) {
            this.currentUtterance = null;
            callbacks.onEnd?.();
            return;
        }

        const isFirstChunk = index === 0;
        const utterance = new SpeechSynthesisUtterance(this.queue[index]);
        // Both set from the SAME resolved voice — lang mirrors voice.lang exactly when
        // a voice was matched, so the two can never disagree with each other
        // mid-explanation; when no voice matched, lang alone still carries the
        // requested locale to the platform's synthesis engine.
        if (voiceInfo.voice) utterance.voice = voiceInfo.voice;
        utterance.lang = voiceInfo.voice?.lang || voiceInfo.locale;

        // If cancel() replaced this utterance with a newer one before this one's
        // events arrive, its late onstart/onend/onerror must not touch state that now
        // belongs to the newer utterance.
        const isCurrent = () => this.currentUtterance === utterance;

        if (isFirstChunk) {
            this.startTimer = setTimeout(() => {
                if (this.destroyed || !isCurrent()) return;
                devLog('speech error', 'no onstart/onerror within timeout — treating as unavailable');
                this.synth.cancel();
                callbacks.onFailure?.('timeout', { isFirstChunk: true });
            }, START_TIMEOUT_MS);
        }

        utterance.onstart = () => {
            if (this.destroyed || !isCurrent()) return;
            if (isFirstChunk) {
                this._clearStartTimer();
                callbacks.onStart?.();
            }
        };
        utterance.onend = () => {
            if (this.destroyed || !isCurrent()) return;
            this._speakChunk(index + 1, voiceInfo, callbacks);
        };
        utterance.onerror = (event) => {
            if (this.destroyed || !isCurrent()) return;
            if (isFirstChunk) this._clearStartTimer();
            // These fire whenever WE call cancel() to stop or replace speech —
            // expected, not a real failure.
            if (event.error === 'canceled' || event.error === 'interrupted') {
                callbacks.onCanceled?.();
                return;
            }
            devLog('speech error', event.error);
            callbacks.onFailure?.(event.error, { isFirstChunk });
        };

        // Keep a strong reference for the duration of this utterance — WebKit is
        // known to garbage collect an utterance only referenced by a local variable,
        // silently killing speech mid-playback.
        this.currentUtterance = utterance;
        this.synth.speak(utterance);
    }
}

export { devLog };
