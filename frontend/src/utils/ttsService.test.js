import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    TTS_LANGUAGE_CONFIG,
    getTtsConfig,
    findCompatibleVoice,
    waitForVoices,
    TtsSession
} from './ttsService';

const makeVoice = (lang, name = lang) => ({ lang, name });

describe('getTtsConfig', () => {
    it.each([
        ['English', 'en-IN'],
        ['Hindi', 'hi-IN'],
        ['Telugu', 'te-IN'],
        ['Tamil', 'ta-IN'],
        ['Gujarati', 'gu-IN'],
        ['Marathi', 'mr-IN'],
        ['Bengali', 'bn-IN'],
        ['Malayalam', 'ml-IN'],
        ['Kannada', 'kn-IN'],
        ['Punjabi', 'pa-IN'],
        ['Odia', 'or-IN'],
        ['Assamese', 'as-IN'],
        ['Urdu', 'ur-IN']
    ])('%s maps to preferredLocale %s', (language, locale) => {
        expect(getTtsConfig(language).preferredLocale).toBe(locale);
    });

    it('falls back to the English config for an unrecognized language', () => {
        expect(getTtsConfig('Klingon')).toBe(TTS_LANGUAGE_CONFIG.English);
    });
});

describe('findCompatibleVoice', () => {
    it('prefers an exact locale match over a bare-language match', () => {
        const voices = [makeVoice('gu'), makeVoice('gu-IN'), makeVoice('en-US')];
        const match = findCompatibleVoice(voices, getTtsConfig('Gujarati'));
        expect(match.lang).toBe('gu-IN');
    });

    it('falls back to a same-language regional variant when no exact preferred locale exists', () => {
        const voices = [makeVoice('mr-XX'), makeVoice('en-US')];
        const match = findCompatibleVoice(voices, getTtsConfig('Marathi'));
        expect(match.lang).toBe('mr-XX');
    });

    it.each(['Malayalam', 'Kannada', 'Telugu', 'Tamil', 'Hindi', 'Gujarati', 'Marathi', 'Punjabi', 'Odia', 'Assamese', 'Urdu'])(
        '%s: never returns a voice for a different language',
        (language) => {
            const voices = [makeVoice('en-US'), makeVoice('fr-FR'), makeVoice('de-DE')];
            expect(findCompatibleVoice(voices, getTtsConfig(language))).toBeNull();
        }
    );

    it('returns null (not a wrong-language voice) when the voice list is empty', () => {
        expect(findCompatibleVoice([], getTtsConfig('Gujarati'))).toBeNull();
    });

    it('is case-insensitive on locale tags', () => {
        const voices = [makeVoice('ML-in')];
        expect(findCompatibleVoice(voices, getTtsConfig('Malayalam')).lang).toBe('ML-in');
    });

    it('falls back to the same-language ur-PK voice for Urdu when ur-IN is not installed', () => {
        const voices = [makeVoice('ur-PK'), makeVoice('en-US')];
        const match = findCompatibleVoice(voices, getTtsConfig('Urdu'));
        expect(match.lang).toBe('ur-PK');
    });

    it('falls back to the same-language pa-PK voice for Punjabi when pa-IN is not installed', () => {
        const voices = [makeVoice('pa-PK'), makeVoice('en-US')];
        const match = findCompatibleVoice(voices, getTtsConfig('Punjabi'));
        expect(match.lang).toBe('pa-PK');
    });
});

describe('waitForVoices', () => {
    it('resolves immediately when voices are already present', async () => {
        const synth = {
            getVoices: () => [makeVoice('en-US')],
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        };
        const voices = await waitForVoices(synth, { pollMs: 5, maxAttempts: 3 });
        expect(voices).toHaveLength(1);
    });

    it('resolves via voiceschanged when the initial list is empty (Safari-style late population)', async () => {
        let changedHandler;
        let callCount = 0;
        const synth = {
            getVoices: () => (callCount++ === 0 ? [] : [makeVoice('gu-IN')]),
            addEventListener: (evt, handler) => {
                if (evt === 'voiceschanged') changedHandler = handler;
            },
            removeEventListener: vi.fn()
        };
        const promise = waitForVoices(synth, { pollMs: 10, maxAttempts: 20 });
        setTimeout(() => changedHandler(), 15);
        const voices = await promise;
        expect(voices[0].lang).toBe('gu-IN');
    });

    it('gives up after maxAttempts and resolves with an empty list rather than hanging forever', async () => {
        const synth = { getVoices: () => [], addEventListener: vi.fn(), removeEventListener: vi.fn() };
        const voices = await waitForVoices(synth, { pollMs: 5, maxAttempts: 3 });
        expect(voices).toEqual([]);
    });
});

class FakeUtterance {
    constructor(text) {
        this.text = text;
        this.onstart = null;
        this.onend = null;
        this.onerror = null;
    }
}

const makeFakeSynth = () => ({
    utterances: [],
    speak(u) {
        this.utterances.push(u);
    },
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn()
});

describe('TtsSession', () => {
    let synth;
    let session;

    beforeEach(() => {
        global.SpeechSynthesisUtterance = FakeUtterance;
        synth = makeFakeSynth();
        session = new TtsSession(synth);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('sets utterance.lang to the requested locale even when no voice object matched (Gujarati)', () => {
        session.speak('ટૂંકું લખાણ', { voice: null, locale: 'gu-IN' }, {});
        expect(synth.utterances[0].lang).toBe('gu-IN');
        expect(synth.utterances[0].voice).toBeUndefined();
    });

    it('sets utterance.lang to the requested locale even when no voice object matched (Marathi)', () => {
        session.speak('संक्षिप्त मजकूर', { voice: null, locale: 'mr-IN' }, {});
        expect(synth.utterances[0].lang).toBe('mr-IN');
    });

    it.each([
        ['Malayalam', 'ml-IN'],
        ['Kannada', 'kn-IN'],
        ['Telugu', 'te-IN'],
        ['Tamil', 'ta-IN'],
        ['Hindi', 'hi-IN'],
        ['English', 'en-IN']
    ])('%s: attempts playback via lang alone when unmatched, never substituting another language', (_, locale) => {
        session.speak('short text', { voice: null, locale }, {});
        expect(synth.utterances[0].lang).toBe(locale);
        expect(synth.utterances[0].voice).toBeUndefined();
    });

    it('uses the resolved voice object and mirrors its own lang when a voice was matched', () => {
        const voice = makeVoice('mr-IN', 'Lekha');
        session.speak('short text', { voice, locale: 'mr-IN' }, {});
        expect(synth.utterances[0].voice).toBe(voice);
        expect(synth.utterances[0].lang).toBe('mr-IN');
    });

    it('calls onStart then onEnd for a single short chunk that plays successfully', () => {
        const onStart = vi.fn();
        const onEnd = vi.fn();
        session.speak('one short sentence.', { voice: null, locale: 'gu-IN' }, { onStart, onEnd });

        synth.utterances[0].onstart();
        expect(onStart).toHaveBeenCalledTimes(1);
        expect(onEnd).not.toHaveBeenCalled();

        synth.utterances[0].onend();
        expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('treats a genuine synthesis error as a real failure', () => {
        const onFailure = vi.fn();
        session.speak('text', { voice: null, locale: 'gu-IN' }, { onFailure });

        synth.utterances[0].onerror({ error: 'synthesis-failed' });
        expect(onFailure).toHaveBeenCalledWith('synthesis-failed', { isFirstChunk: true });
    });

    it('does not treat our own cancel/interrupt as a failure', () => {
        const onFailure = vi.fn();
        const onCanceled = vi.fn();
        session.speak('text', { voice: null, locale: 'gu-IN' }, { onFailure, onCanceled });

        synth.utterances[0].onerror({ error: 'canceled' });
        expect(onFailure).not.toHaveBeenCalled();
        expect(onCanceled).toHaveBeenCalledTimes(1);
    });

    it('treats a first-chunk that never fires onstart or onerror as a failure after the timeout (Safari silent no-op)', () => {
        vi.useFakeTimers();
        const onFailure = vi.fn();
        const onStart = vi.fn();
        session.speak('text', { voice: null, locale: 'gu-IN' }, { onFailure, onStart });

        vi.advanceTimersByTime(4001);

        expect(onStart).not.toHaveBeenCalled();
        expect(onFailure).toHaveBeenCalledWith('timeout', { isFirstChunk: true });
        expect(synth.cancel).toHaveBeenCalled();
    });

    it('does not fire the start-timeout once onstart has already fired', () => {
        vi.useFakeTimers();
        const onFailure = vi.fn();
        session.speak('text', { voice: null, locale: 'gu-IN' }, { onFailure });

        synth.utterances[0].onstart();
        vi.advanceTimersByTime(4001);

        expect(onFailure).not.toHaveBeenCalled();
    });

    it('chunks long text into multiple utterances and speaks them sequentially', () => {
        const long = `${'A'.repeat(150)}. ${'B'.repeat(150)}. ${'C'.repeat(150)}.`;
        const onEnd = vi.fn();
        session.speak(long, { voice: null, locale: 'en-IN' }, { onEnd });

        expect(synth.utterances).toHaveLength(1);
        synth.utterances[0].onstart();
        synth.utterances[0].onend();
        expect(synth.utterances).toHaveLength(2);
        expect(onEnd).not.toHaveBeenCalled();

        synth.utterances[1].onend();
        expect(synth.utterances).toHaveLength(3);

        synth.utterances[2].onend();
        expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('chunks on the Urdu Arabic full stop (۔), not just Latin/Devanagari sentence punctuation', () => {
        const long = `${'ا'.repeat(150)}۔ ${'ب'.repeat(150)}۔`;
        const onEnd = vi.fn();
        session.speak(long, { voice: null, locale: 'ur-IN' }, { onEnd });

        expect(synth.utterances).toHaveLength(1);
        synth.utterances[0].onstart();
        synth.utterances[0].onend();
        expect(synth.utterances).toHaveLength(2);
        synth.utterances[1].onend();
        expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('stop() cancels synthesis and a stale utterance from before stop() has no further effect', () => {
        const onEnd = vi.fn();
        session.speak('text one. text two.', { voice: null, locale: 'en-IN' }, { onEnd });
        const staleUtterance = synth.utterances[0];

        session.stop();
        expect(synth.cancel).toHaveBeenCalled();

        // A late event from the utterance that was in flight when stop() was called
        // must not resume the queue or report completion.
        staleUtterance.onend();
        expect(onEnd).not.toHaveBeenCalled();
    });

    it('a new speak() call supersedes a prior in-flight one — late events from the old utterance are ignored', () => {
        const onStartFirst = vi.fn();
        const onStartSecond = vi.fn();
        session.speak('first', { voice: null, locale: 'en-IN' }, { onStart: onStartFirst });
        const firstUtterance = synth.utterances[0];

        session.speak('second', { voice: null, locale: 'gu-IN' }, { onStart: onStartSecond });
        expect(synth.utterances).toHaveLength(2);

        firstUtterance.onstart();
        expect(onStartFirst).not.toHaveBeenCalled();

        synth.utterances[1].onstart();
        expect(onStartSecond).toHaveBeenCalledTimes(1);
    });
});
