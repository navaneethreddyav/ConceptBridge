import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, RotateCcw, Volume2, Loader2, VolumeX } from 'lucide-react';
import { getTtsConfig, findCompatibleVoice, waitForVoices, TtsSession, devLog } from '../utils/ttsService';

// unsupported - window.speechSynthesis doesn't exist in this browser at all
// resolving  - loading the voice list, deciding what to attempt with
// idle       - ready; nothing playing yet (a compatible voice may or may not exist —
//              that's not decided until an actual play attempt is made)
// loading    - play attempted, waiting for it to genuinely start
// speaking   - actively playing (confirmed by a real onstart)
// paused     - paused mid-playback
// error      - a genuine failure after speech had already started successfully once
// unavailable- an actual play attempt failed (error or no-start timeout) for this
//              language on this device — not merely "no voice was enumerated"
const VoicePlayer = ({ text, language }) => {
    const [status, setStatus] = useState('resolving');
    const [errorMessage, setErrorMessage] = useState('');

    const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
    const sessionRef = useRef(null);
    const mountedRef = useRef(true);
    const busyRef = useRef(false);
    // {voice: SpeechSynthesisVoice|null, locale: string} for the language currently
    // resolved — locale is always set (even with voice: null) so playback can still be
    // attempted with utterance.lang carrying the requested locale on its own. Per-
    // language cache avoids re-polling getVoices() on every language switch; only ever
    // caches a real, examined voice list's outcome, never the "gave up waiting" case.
    const resolvedRef = useRef({ voice: null, locale: 'en-IN' });
    const voiceCacheRef = useRef(new Map());

    const synth = synthRef.current;

    useEffect(() => {
        mountedRef.current = true;
        if (!sessionRef.current && synth) sessionRef.current = new TtsSession(synth);
        return () => {
            mountedRef.current = false;
            sessionRef.current?.destroy();
            // React 19 StrictMode (see main.jsx) mounts every effect twice in dev:
            // mount -> cleanup -> mount. Without clearing the ref here, the destroyed
            // session from the first mount survives into the second mount's
            // `!sessionRef.current` check (still non-null), so a fresh session is never
            // created and every future speak() call silently no-ops forever (TtsSession
            // returns early on `this.destroyed`) — reproduced as permanently-stuck
            // "loading" state with no error, in dev only (StrictMode doesn't
            // double-invoke in production builds).
            sessionRef.current = null;
        };
    }, [synth]);

    // Resolves which voice/locale to attempt for the current language whenever text or
    // language changes. This ONLY decides what to attempt with — it never concludes
    // "unavailable" from an empty or non-matching voice list, since Safari/WebKit is
    // known to under-report installed voices through getVoices(). Real availability is
    // only known once an actual play attempt genuinely fails (see handlePlay).
    useEffect(() => {
        sessionRef.current?.stop();
        setErrorMessage('');

        if (!synth) {
            setStatus('unsupported');
            setErrorMessage("Voice playback isn't supported by this browser.");
            return undefined;
        }

        const config = getTtsConfig(language);
        devLog('requested language', { language, locale: config.preferredLocale });

        const cached = voiceCacheRef.current.get(language);
        if (cached) {
            resolvedRef.current = cached;
            devLog('selected voice (cached)', cached.voice ? { name: cached.voice.name, lang: cached.voice.lang } : 'none — will attempt via lang only');
            setStatus('idle');
            return undefined;
        }

        let cancelled = false;
        setStatus('resolving');

        waitForVoices(synth).then((voices) => {
            if (cancelled) return;
            devLog('available voices', voices.map((v) => v.lang));
            const voice = findCompatibleVoice(voices, config);
            const resolved = { voice, locale: config.preferredLocale };
            resolvedRef.current = resolved;
            voiceCacheRef.current.set(language, resolved);
            devLog('selected voice', voice ? { name: voice.name, lang: voice.lang } : 'none — will attempt via lang only');
            if (!mountedRef.current) return;
            setStatus('idle');
        });

        return () => {
            cancelled = true;
        };
    }, [text, language, synth]);

    const startFromBeginning = useCallback(() => {
        if (busyRef.current) return;
        if (!sessionRef.current) return;
        busyRef.current = true;

        // Attempt synchronously, in the same tick as the tap that triggered this — no
        // setTimeout/await before speak() below, so the call stays inside the original
        // user gesture, which iOS Safari requires to allow audio to start.
        setStatus('loading');
        setErrorMessage('');

        sessionRef.current.speak(text, resolvedRef.current, {
            onStart: () => {
                if (mountedRef.current) setStatus('speaking');
            },
            onEnd: () => {
                if (mountedRef.current) setStatus('idle');
            },
            onCanceled: () => {
                if (mountedRef.current) setStatus('idle');
            },
            onFailure: (reason, { isFirstChunk }) => {
                if (!mountedRef.current) return;
                if (isFirstChunk) {
                    // The actual attempt failed — THIS is what genuinely means
                    // unavailable, not the earlier voice search.
                    setStatus('unavailable');
                    setErrorMessage(`Voice playback for ${language} is unavailable on this device.`);
                } else {
                    setStatus('error');
                    setErrorMessage("Voice playback isn't available right now.");
                }
            }
        });

        // Deferred to a microtask rather than cleared immediately: two calls to this
        // function landing in the same synchronous task (only reachable
        // programmatically, not from real taps) would otherwise both call speak()
        // before either finishes, which can wedge Chrome's speech engine for the rest
        // of the page session with no start/end/error ever firing. A microtask still
        // resolves before any subsequent real click is processed, so this adds no
        // perceptible delay to normal use.
        Promise.resolve().then(() => {
            busyRef.current = false;
        });
    }, [text, language]);

    const handlePlay = useCallback(() => {
        if (busyRef.current) return;

        if (status === 'paused') {
            busyRef.current = true;
            sessionRef.current?.resume();
            setStatus('speaking');
            busyRef.current = false;
            return;
        }

        startFromBeginning();
    }, [status, startFromBeginning]);

    const handlePause = useCallback(() => {
        if (status !== 'speaking') return;
        sessionRef.current?.pause();
        setStatus('paused');
    }, [status]);

    const handleStop = useCallback(() => {
        sessionRef.current?.stop();
        setStatus('idle');
    }, []);

    const handleReplay = useCallback(() => {
        // Always restarts from the first chunk, regardless of paused/speaking state —
        // distinct from Play, which resumes in place when paused.
        startFromBeginning();
    }, [startFromBeginning]);

    if (!text) return null;

    if (status === 'unsupported' || status === 'unavailable' || status === 'error') {
        return (
            <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl border border-white/10 text-xs text-text-muted">
                <VolumeX className="w-4 h-4 shrink-0" />
                <span>{errorMessage || `Voice playback for ${language} is unavailable on this device.`}</span>
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
