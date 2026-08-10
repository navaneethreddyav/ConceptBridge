import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, RotateCcw, Volume2, Loader2 } from 'lucide-react';
import { languageLocaleMap } from '../../../shared/supportedLanguages.json';

// iOS Safari has historically truncated or silently dropped very long single
// utterances. Chunking at sentence boundaries and queueing keeps each utterance
// short and lets playback continue automatically from one chunk to the next.
const MAX_CHUNK_CHARS = 200;
// Bounded polling for getVoices(): some WebKit versions return an empty list on
// the first call and never reliably fire 'voiceschanged' afterwards.
const VOICE_POLL_MS = 250;
const MAX_VOICE_POLL_ATTEMPTS = 12;

const chunkText = (text) => {
    // Split after sentence-ending punctuation (., !, ?, or the Devanagari danda
    // used in Hindi/Marathi) followed by whitespace, keeping the punctuation.
    const sentences = text.split(/(?<=[.!?।])\s+/).filter(Boolean);
    const chunks = [];
    let current = '';

    const pushCurrent = () => {
        if (current) chunks.push(current);
        current = '';
    };

    for (const sentence of sentences) {
        if (sentence.length > MAX_CHUNK_CHARS) {
            // A single "sentence" longer than the cap (e.g. no punctuation at
            // all) — hard-split on whitespace so no chunk is ever too long.
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

const VoicePlayer = ({ text, language }) => {
    const [status, setStatus] = useState('idle'); // idle | loading | speaking | paused | error
    const [errorMessage, setErrorMessage] = useState('');

    const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
    const mountedRef = useRef(true);
    const busyRef = useRef(false);
    const resolvedVoiceRef = useRef(null);
    const queueRef = useRef([]);
    const activeVoiceRef = useRef(null);
    const activeLangRef = useRef('en');
    // A strong reference to the in-flight utterance — WebKit is known to garbage
    // collect an utterance that's only referenced by a local variable, silently
    // killing speech mid-playback. Holding it here keeps it alive for its lifetime.
    const currentUtteranceRef = useRef(null);

    const synth = synthRef.current;

    // Resolve and (re-)poll for a voice matching the selected language whenever the
    // language changes. Never treated as fatal if no exact match exists — the
    // browser's default voice is used instead, per utterance.lang below.
    useEffect(() => {
        if (!synth) return undefined;

        let pollTimer = null;
        let attempts = 0;

        const resolveVoice = () => {
            const voices = synth.getVoices();
            if (voices.length === 0) return false;

            const prefix = (languageLocaleMap[language] || 'en').toLowerCase();
            const exact = voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
            // No English fallback here on purpose: forcing an English voice onto,
            // say, Gujarati or Marathi text guarantees a wrong-script mispronunciation
            // (English voice, foreign phonemes). Leaving voice unset when no real
            // match exists still lets the browser pick its own default for
            // utterance.lang below — not guaranteed better, but never guaranteed
            // wrong the way forcing an unrelated voice is.
            resolvedVoiceRef.current = exact || null;
            return true;
        };

        const tryResolve = () => {
            const found = resolveVoice();
            if (found || attempts >= MAX_VOICE_POLL_ATTEMPTS) return;
            attempts += 1;
            pollTimer = setTimeout(tryResolve, VOICE_POLL_MS);
        };

        tryResolve();

        const onVoicesChanged = () => resolveVoice();
        synth.addEventListener?.('voiceschanged', onVoicesChanged);
        const previousHandler = synth.onvoiceschanged;
        synth.onvoiceschanged = onVoicesChanged;

        return () => {
            if (pollTimer) clearTimeout(pollTimer);
            synth.removeEventListener?.('voiceschanged', onVoicesChanged);
            synth.onvoiceschanged = previousHandler || null;
        };
    }, [language, synth]);

    // A new explanation (different text/language) makes any in-flight speech
    // stale — stop it and reset the control state rather than leaving a button
    // that claims to be "speaking" something the user can no longer see.
    useEffect(() => {
        synth?.cancel();
        queueRef.current = [];
        currentUtteranceRef.current = null;
        setStatus('idle');
        setErrorMessage('');
    }, [text, language, synth]);

    useEffect(() => {
        // Runs on every mount, including the mount that follows StrictMode's
        // deliberate dev-only mount->unmount->remount cycle — without this, the
        // ref set false by the cleanup below would stay false forever after that
        // cycle, permanently disabling onstart/onend/onerror in development.
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            synth?.cancel();
        };
    }, [synth]);

    const speakChunk = useCallback(
        (index) => {
            const chunks = queueRef.current;
            if (index >= chunks.length) {
                if (mountedRef.current) setStatus('idle');
                currentUtteranceRef.current = null;
                return;
            }

            const utterance = new SpeechSynthesisUtterance(chunks[index]);
            utterance.lang = activeLangRef.current;
            if (activeVoiceRef.current) utterance.voice = activeVoiceRef.current;

            // If cancel() replaced this utterance with a newer one before this one's
            // events arrive (possible when two speak() calls land in the same JS
            // task), its late onend/onerror must not touch state that now belongs
            // to the newer utterance.
            const isCurrent = () => currentUtteranceRef.current === utterance;

            utterance.onstart = () => {
                if (mountedRef.current && isCurrent()) setStatus('speaking');
            };
            utterance.onend = () => {
                if (!mountedRef.current || !isCurrent()) return;
                speakChunk(index + 1);
            };
            utterance.onerror = (event) => {
                if (!mountedRef.current || !isCurrent()) return;
                // These fire whenever WE call cancel() to stop or replace speech —
                // expected, not a real failure, so don't surface an error for them.
                if (event.error === 'canceled' || event.error === 'interrupted') {
                    setStatus('idle');
                    return;
                }
                console.warn('Speech synthesis error:', event.error);
                setStatus('error');
                setErrorMessage("Voice playback isn't available right now.");
            };

            // Keep a strong reference for the duration of this utterance (see the
            // GC note on currentUtteranceRef above).
            currentUtteranceRef.current = utterance;
            synth.speak(utterance);
        },
        [synth]
    );

    const startFromBeginning = useCallback(() => {
        if (busyRef.current) return;
        busyRef.current = true;

        // Cancel synchronously, in the same tick as the tap that triggered this —
        // no setTimeout/await before speak() below, so the call stays inside the
        // original user gesture, which iOS Safari requires to allow audio to start.
        synth.cancel();
        setStatus('loading');
        setErrorMessage('');

        activeVoiceRef.current = resolvedVoiceRef.current;
        activeLangRef.current = languageLocaleMap[language] || 'en';
        queueRef.current = chunkText(text);
        speakChunk(0);

        // Deferred to a microtask rather than cleared immediately: two calls to
        // this function landing in the same synchronous task (only reachable
        // programmatically, not from real taps — a click handler can't run twice
        // before the event loop yields) would otherwise both call cancel()+speak()
        // before either finishes, which can wedge Chrome's speech engine for the
        // rest of the page session with no start/end/error ever firing. A
        // microtask still resolves before any subsequent real click is processed,
        // so this adds no perceptible delay to normal use.
        Promise.resolve().then(() => {
            busyRef.current = false;
        });
    }, [language, synth, speakChunk, text]);

    const handlePlay = useCallback(() => {
        if (busyRef.current) return;

        if (status === 'paused') {
            busyRef.current = true;
            synth.resume();
            setStatus('speaking');
            busyRef.current = false;
            return;
        }

        startFromBeginning();
    }, [status, synth, startFromBeginning]);

    const handlePause = useCallback(() => {
        if (status !== 'speaking') return;
        synth.pause();
        setStatus('paused');
    }, [status, synth]);

    const handleStop = useCallback(() => {
        synth.cancel();
        queueRef.current = [];
        currentUtteranceRef.current = null;
        setStatus('idle');
    }, [synth]);

    const handleReplay = useCallback(() => {
        // Always restarts from the first chunk, regardless of paused/speaking
        // state — distinct from Play, which resumes in place when paused.
        startFromBeginning();
    }, [startFromBeginning]);

    if (!text) return null;

    if (!synth || status === 'error') {
        return (
            <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl border border-white/10 text-xs text-text-muted">
                <Volume2 className="w-4 h-4 shrink-0" />
                <span>{errorMessage || "Voice playback isn't available in this browser."}</span>
            </div>
        );
    }

    const isBusy = status === 'loading';

    return (
        <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
            <Volume2 className="w-5 h-5 text-text-muted ml-2" />
            <span className="text-sm font-medium text-text-muted mr-4 border-r border-white/10 pr-4">AI Teacher</span>

            <div className="flex gap-2">
                {status !== 'speaking' ? (
                    <button
                        onClick={handlePlay}
                        disabled={isBusy}
                        className="p-2 bg-primary text-black rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        title={status === 'paused' ? 'Resume' : 'Play'}
                    >
                        {isBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Play className="w-4 h-4 fill-current" />
                        )}
                    </button>
                ) : (
                    <button
                        onClick={handlePause}
                        className="p-2 bg-primary text-black rounded-lg hover:bg-primary/90 transition-colors"
                        title="Pause"
                    >
                        <Pause className="w-4 h-4 fill-current" />
                    </button>
                )}

                <button
                    onClick={handleStop}
                    disabled={status === 'idle'}
                    className="p-2 bg-background border border-white/10 text-text-main rounded-lg hover:bg-white/10 disabled:opacity-50 transition-colors"
                    title="Stop"
                >
                    <Square className="w-4 h-4 fill-current" />
                </button>

                <button
                    onClick={handleReplay}
                    disabled={isBusy}
                    className="p-2 bg-background border border-white/10 text-text-main rounded-lg hover:bg-white/10 disabled:opacity-50 transition-colors"
                    title="Replay"
                >
                    <RotateCcw className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default VoicePlayer;
