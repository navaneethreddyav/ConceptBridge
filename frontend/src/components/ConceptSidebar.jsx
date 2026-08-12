import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, AlertCircle, Zap, Layers, AlertTriangle, PlayCircle } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import VoicePlayer from './VoicePlayer';
import { API_BASE_URL } from '../config/api';
import { supportedLanguages } from '../../../shared/supportedLanguages.json';

const formatDuration = (totalSeconds) => {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const pad = (n) => String(n).padStart(2, '0');

    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
};

// Reuses the in-flight promise when the effect re-fires for identical inputs, so a
// duplicate request (StrictMode remount, rapid re-render) never hits the API twice.
const dedupe = (ref, key, start) => {
    if (ref.current.key !== key) {
        ref.current = { key, promise: start() };
    }
    return ref.current.promise;
};

const postJson = (path, body) =>
    fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
    })
        .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
        .catch((err) => ({ ok: false, data: { error: err.message } }));

const VideoSlot = ({ label, video }) => {
    if (!video) {
        return (
            <div className="border border-white/10 rounded-xl p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-text-muted mb-1">{label}</p>
                <p className="text-sm text-text-muted">No video found for this concept.</p>
            </div>
        );
    }

    return (
        <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block border border-white/10 rounded-xl overflow-hidden hover:border-primary/50 transition-colors group"
        >
            <div className="relative">
                {video.thumbnail ? (
                    <img src={video.thumbnail} alt={video.title} className="w-full h-36 object-cover" />
                ) : (
                    <div className="w-full h-36 bg-white/5" />
                )}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <PlayCircle className="w-10 h-10 text-primary" />
                </div>
                {formatDuration(video.duration) && (
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded font-mono">
                        {formatDuration(video.duration)}
                    </span>
                )}
            </div>
            <div className="p-3">
                <p className="text-[10px] uppercase tracking-wider text-primary mb-1">{label}</p>
                <h4 className="text-sm font-semibold text-text-main line-clamp-2">{video.title}</h4>
                {video.channelTitle && (
                    <p className="text-xs text-text-muted mt-1 truncate">{video.channelTitle}</p>
                )}
            </div>
        </a>
    );
};

const ConceptSidebar = ({ selection, documentId, onClose }) => {
    const { settings, updateSettings } = useSettings();
    const [explanation, setExplanation] = useState(null);
    const [visual, setVisual] = useState(null);
    const [explanationLoading, setExplanationLoading] = useState(true);
    const [explanationError, setExplanationError] = useState('');
    const [videos, setVideos] = useState(null);
    const [mediaLoading, setMediaLoading] = useState(true);
    const [mediaFailed, setMediaFailed] = useState(false);

    const explanationRequestRef = useRef({ key: null, promise: null });
    const mediaRequestRef = useRef({ key: null, promise: null });

    const concept = selection?.text || '';
    const contextBefore = selection?.contextBefore || '';
    const contextAfter = selection?.contextAfter || '';
    const { language, difficulty } = settings;

    useEffect(() => {
        if (!concept) return undefined;

        let cancelled = false;
        setExplanationLoading(true);
        setExplanationError('');
        setExplanation(null);
        setVisual(null);

        const key = JSON.stringify([documentId, concept, contextBefore, contextAfter, language, difficulty]);
        const request = dedupe(explanationRequestRef, key, () =>
            postJson('/api/explanation', {
                documentId,
                concept,
                contextBefore,
                contextAfter,
                language,
                difficulty
            })
        );

        request.then((result) => {
            if (cancelled) return;
            if (result.ok && result.data.explanation) {
                setExplanation(result.data.explanation);
                setVisual(result.data.visual || null);
            } else {
                setExplanationError(result.data.error || 'Failed to generate an explanation.');
            }
            setExplanationLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [concept, contextBefore, contextAfter, documentId, language, difficulty]);

    useEffect(() => {
        if (!concept) return undefined;

        let cancelled = false;
        setMediaLoading(true);
        setMediaFailed(false);
        setVideos(null);

        const request = dedupe(mediaRequestRef, concept, () => postJson('/api/media', { concept }));

        request.then((result) => {
            if (cancelled) return;
            if (result.ok && result.data.videos) {
                setVideos(result.data.videos);
            } else {
                setMediaFailed(true);
            }
            setMediaLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [concept]);

    if (!selection) return null;

    return (
        <aside className="fixed inset-0 z-50 bg-black flex flex-col md:static md:inset-auto md:z-auto md:w-[380px] md:shrink-0 md:border-l md:border-white/10 md:h-full">
            <div className="flex items-start justify-between gap-3 p-4 border-b border-white/10 shrink-0">
                <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-primary mb-1">ConceptBridge</p>
                    <h2 className="text-lg font-bold text-text-main break-words">
                        {explanation?.title || concept}
                    </h2>
                </div>
                <button
                    onClick={onClose}
                    className="p-3 md:p-2 rounded-full border border-white/10 hover:border-primary/50 transition-colors shrink-0 select-none"
                    title="Close and continue reading"
                >
                    <X className="w-4 h-4 text-text-muted" />
                </button>
            </div>

            <div className="px-4 py-3 border-b border-white/10 shrink-0">
                <label className="block text-[10px] uppercase tracking-wider text-text-muted mb-1">
                    Explain in
                </label>
                <select
                    value={settings.language}
                    onChange={(e) => updateSettings({ language: e.target.value })}
                    className="w-full bg-black border border-white/10 text-text-main rounded-lg p-2 text-sm focus:outline-none focus:border-primary"
                >
                    {supportedLanguages.map((lang) => (
                        <option key={lang} value={lang}>
                            {lang}
                        </option>
                    ))}
                </select>
            </div>

            <div className="@container flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
                {explanationLoading && (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        <p className="text-sm text-text-muted text-center">
                            Building your explanation in {settings.language}...
                        </p>
                    </div>
                )}

                {!explanationLoading && explanationError && (
                    <div className="flex flex-col items-center justify-center gap-3 border border-red-500/20 rounded-xl p-6 text-center">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                        <h3 className="font-bold text-red-400">Could not explain this</h3>
                        <p className="text-sm text-text-muted">{explanationError}</p>
                    </div>
                )}

                {!explanationLoading && !explanationError && explanation && (
                    <div className="space-y-6">
                        <div className="flex justify-end">
                            <VoicePlayer text={explanation.simpleExplanation} language={settings.language} />
                        </div>

                        {explanation.simpleExplanation && (
                            <section className="border border-white/10 rounded-xl p-4">
                                <h3 className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-2">
                                    Simply Put
                                </h3>
                                <p className="text-base text-text-main leading-relaxed">
                                    {explanation.simpleExplanation}
                                </p>
                            </section>
                        )}

                        {explanation.analogy && (
                            <section className="flex gap-3 border border-white/20 rounded-xl p-4">
                                <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="text-sm font-bold text-text-main mb-1">Think of it like this</h3>
                                    <p className="text-sm text-text-muted leading-relaxed">{explanation.analogy}</p>
                                </div>
                            </section>
                        )}

                        <div className="grid grid-cols-1 @md:grid-cols-2 gap-4">
                            {explanation.definition && (
                                <section>
                                    <h3 className="text-sm font-bold text-text-main mb-2">Formal Definition</h3>
                                    <p className="text-sm text-text-muted leading-relaxed">{explanation.definition}</p>
                                </section>
                            )}
                            {explanation.whyItMatters && (
                                <section>
                                    <h3 className="text-sm font-bold text-text-main mb-2">Why it Matters</h3>
                                    <p className="text-sm text-text-muted leading-relaxed">{explanation.whyItMatters}</p>
                                </section>
                            )}
                        </div>

                        {explanation.stepByStepExplanation?.length > 0 && (
                            <section>
                                <h3 className="text-sm font-bold text-text-main mb-3 flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-primary" />
                                    Step by Step
                                </h3>
                                <ol className="space-y-2">
                                    {explanation.stepByStepExplanation.map((step, i) => (
                                        <li key={i} className="flex gap-3 border border-white/10 rounded-lg p-3">
                                            <span className="font-bold text-primary text-sm">{i + 1}.</span>
                                            <span className="text-sm text-text-main">{step}</span>
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        )}

                        {explanation.keyPoints?.length > 0 && (
                            <section>
                                <h3 className="text-sm font-bold text-text-main mb-2">Key Points</h3>
                                <ul className="list-disc list-inside text-sm text-text-muted space-y-1">
                                    {explanation.keyPoints.map((point, i) => (
                                        <li key={i}>{point}</li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {explanation.realLifeExample && (
                            <section className="border border-white/10 rounded-xl p-4">
                                <h3 className="text-sm font-bold text-text-main mb-2">Real-Life Example</h3>
                                <p className="text-sm text-text-muted leading-relaxed">{explanation.realLifeExample}</p>
                            </section>
                        )}

                        {explanation.commonMistakes?.length > 0 && (
                            <section className="border border-white/20 rounded-xl p-4">
                                <h3 className="text-sm font-bold text-text-main mb-2 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-primary" />
                                    Common Mistakes
                                </h3>
                                <ul className="list-disc list-inside text-sm text-text-muted space-y-1">
                                    {explanation.commonMistakes.map((mistake, i) => (
                                        <li key={i}>{mistake}</li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        <section>
                            <h3 className="text-sm font-bold text-text-main mb-3">Visual</h3>
                            {visual?.svg && visual.type !== 'none' ? (
                                <div
                                    className="border border-white/10 rounded-xl p-3 overflow-x-auto [&_svg]:w-full [&_svg]:h-auto"
                                    dangerouslySetInnerHTML={{ __html: visual.svg }}
                                />
                            ) : (
                                <div className="border border-white/10 rounded-xl p-6 text-center">
                                    <p className="text-sm text-text-muted">No visual available for this concept.</p>
                                </div>
                            )}
                        </section>
                    </div>
                )}

                <section className="space-y-3">
                    <h3 className="text-sm font-bold text-text-main">Watch</h3>
                    {mediaLoading && (
                        <div className="border border-white/10 rounded-xl p-4 flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            <p className="text-sm text-text-muted">Finding videos...</p>
                        </div>
                    )}
                    {!mediaLoading && mediaFailed && (
                        <div className="border border-white/10 rounded-xl p-4 text-center">
                            <p className="text-sm text-text-muted">Videos are unavailable right now.</p>
                        </div>
                    )}
                    {!mediaLoading && !mediaFailed && (
                        <>
                            <VideoSlot label="Quick explainer" video={videos?.short} />
                            <VideoSlot label="Deep dive" video={videos?.long} />
                        </>
                    )}
                </section>
            </div>
        </aside>
    );
};

export default ConceptSidebar;
