import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, RotateCcw, Volume2, Loader2, VolumeX } from 'lucide-react';
import { getTtsConfig, findCompatibleVoice } from '../utils/ttsLocales';

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

// idle       - ready, compatible voice confirmed, nothing playing
// resolving  - checking whether a compatible voice exists for this language
// speaking   - actively playing
// paused     - paused mid-playback
// error      - a genuine runtime failure occurred while trying to play
// unavailable- no voice compatible with this language exists on this device/browser
const VoicePlayer = ({ text, language }) => {
    const [status, setStatus] = useState('resolving');
    const [errorMessage, setErrorMessage] = useState('');

    const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
    const mountedRef = useRef(true);
    const busyRef = useRef(false);
    const resolvedVoiceRef = useRef(null);
    const queueRef = useRef([]);
    const activeVoiceRef = useRef(null);
    const activeLangRef = useRef('en');
    // Per-language cache of the resolution outcome, so repeated language switches
    // (e.g. English -> Marathi -> English) don't re-poll a language already known —
    // only ever caches a DEFINITIVE result (a real, non-empty voice list was seen),
    // never an empty-voice-list timeout, per "don't permanently cache an empty list".
    const voiceCacheRef = useRef(new Map());
    // A strong reference to the in-flight utterance — WebKit is known to garbage
    // collect an utterance that's only referenced by a local variable, silently
    // killing speech mid-playback. Holding it here keeps it alive for its lifetime.
    const currentUtteranceRef = useRef(null);

    const synth = synthRef.current;

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

    // Resolves a voice for the current language whenever text or language changes.
    // A new selection always invalidates in-flight speech first. Text-only changes
    // (a new explanation, same language) reuse the cached resolution instantly
    // instead of re-polling — the voice list for a given language doesn't change
    // just because the text did.
    useEffect(() => {
        synth?.cancel();
        queueRef.current = [];
        currentUtteranceRef.current = null;
        setErrorMessage('');

        if (!synth) {
            setStatus('unavailable');
            setErrorMessage("Voice playback isn't available in this browser.");
            return undefined;
        }

        const cached = voiceCacheRef.current.get(language);
        if (cached) {
            resolvedVoiceRef.current = cached.voice;
            setStatus(cached.voice ? 'idle' : 'unavailable');
            if (!cached.voice) {
                setErrorMessage(`Voice playback for ${language} isn't available on this device/browser.`);
            }
            return undefined;
        }

        setStatus('resolving');
        const config = getTtsConfig(language);
        let pollTimer = null;
        let attempts = 0;
        let settled = false;

        const settle = (voices, definitive) => {
            if (settled) return;
            settled = true;

            const match = findCompatibleVoice(voices, config);
            resolvedVoiceRef.current = match;
            // Only cache a real, examined voice list's outcome — never the "gave up
            // waiting" case, so a later attempt (e.g. re-selecting this language)
            // gets a fresh chance if voices load slowly.
            if (definitive) {
                voiceCacheRef.current.set(language, { voice: match });
            }

            if (!mountedRef.current) return;
            if (match) {
                setStatus('idle');
            } else {
                setStatus('unavailable');
                setErrorMessage(`Voice playback for ${language} isn't available on this device/browser.`);
            }
        };

        const attempt = () => {
            const voices = synth.getVoices();
            if (voices.length > 0) {
                settle(voices, true);
                return;
            }
            attempts += 1;
            if (attempts >= MAX_VOICE_POLL_ATTEMPTS) {
                settle([], false);
                return;
            }
            pollTimer = setTimeout(attempt, VOICE_POLL_MS);
        };

        attempt();

        const onVoicesChanged = () => {
            if (settled) return;
            if (pollTimer) clearTimeout(pollTimer);
            attempt();
        };
        synth.addEventListener?.('voiceschanged', onVoicesChanged);
        const previousHandler = synth.onvoiceschanged;
        synth.onvoiceschanged = onVoicesChanged;

        return () => {
            if (pollTimer) clearTimeout(pollTimer);
            synth.removeEventListener?.('voiceschanged', onVoicesChanged);
            synth.onvoiceschanged = previousHandler || null;
        };
    }, [text, language, synth]);

    const speakChunk = useCallback(
        (index) => {
            const chunks = queueRef.current;
            if (index >= chunks.length) {
                if (mountedRef.current) setStatus('idle');
                currentUtteranceRef.current = null;
                return;
            }

            const utterance = new SpeechSynthesisUtterance(chunks[index]);
            // Both set from the SAME resolved voice for every chunk — lang mirrors
            // voice.lang exactly rather than our config's approximate locale, so the
            // two can never disagree with each other mid-explanation.
            utterance.voice = activeVoiceRef.current;
            utterance.lang = activeVoiceRef.current?.lang || activeLangRef.current;

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
        // No compatible voice for this language — never speak with a mismatched
        // one. Status should already be 'unavailable' in this case (button
        // disabled), this is a defensive second check.
        if (!resolvedVoiceRef.current) return;
        if (busyRef.current) return;
        busyRef.current = true;

        // Cancel synchronously, in the same tick as the tap that triggered this —
        // no setTimeout/await before speak() below, so the call stays inside the
        // original user gesture, which iOS Safari requires to allow audio to start.
        synth.cancel();
        setStatus('loading');
        setErrorMessage('');

        activeVoiceRef.current = resolvedVoiceRef.current;
        activeLangRef.current = getTtsConfig(language).preferredLocale;
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

    if (status === 'unavailable' || (!synth && status !== 'resolving')) {
        return (
            <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl border border-white/10 text-xs text-text-muted">
                <VolumeX className="w-4 h-4 shrink-0" />
                <span>{errorMessage || `Voice playback for ${language} isn't available on this device/browser.`}</span>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl border border-white/10 text-xs text-text-muted">
                <VolumeX className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
            </div>
        );
    }

    const isBusy = status === 'loading' || status === 'resolving';

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
                        title={status === 'paused' ? 'Resume' : status === 'resolving' ? 'Initializing voice...' : 'Play'}
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
                    disabled={status === 'idle' || status === 'resolving'}
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
