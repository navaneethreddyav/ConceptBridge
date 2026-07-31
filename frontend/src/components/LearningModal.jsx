import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, BookOpen, Zap, Layers, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useSettings } from '../context/SettingsContext';
import VoicePlayer from './VoicePlayer';

const LearningModal = React.memo(({ concept, documentId, onClose }) => {
    const { settings } = useSettings();
    const [explanation, setExplanation] = useState(null);
    const [media, setMedia] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError('');
            try {
                const [expResponse, mediaResponse] = await Promise.all([
                    fetch('http://localhost:5000/api/explanation', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            documentId,
                            concept: concept.name,
                            context: concept.summary,
                            language: settings.language,
                            difficulty: settings.difficulty
                        })
                    }),
                    fetch('http://localhost:5000/api/media', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            concept: concept.name,
                            keywords: concept.keywords,
                            relatedConcepts: concept.relatedConcepts
                        })
                    })
                ]);

                const expData = await expResponse.json();
                const mediaData = await mediaResponse.json();

                if (!expResponse.ok) {
                    throw new Error(expData.error || 'Failed to generate explanation.');
                }

                setExplanation(expData.explanation);
                
                if (mediaResponse.ok && mediaData.success) {
                    setMedia(mediaData.media);
                } else {
                    // Fallback to empty media if it fails so the modal doesn't crash
                    setMedia({ images: [], videos: [] });
                }
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (concept) {
            fetchData();
        }
    }, [concept, documentId, settings.language, settings.difficulty]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'auto'; };
    }, []);

    if (!concept) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-4xl bg-surface border border-surface/50 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-background">
                    <div>
                        <h2 className="text-3xl font-bold text-text-main flex items-center gap-2">
                            <BookOpen className="text-primary w-8 h-8" />
                            {concept.name}
                        </h2>
                        {explanation?.difficulty && (
                            <span className="inline-block mt-2 px-3 py-1 bg-background text-xs rounded-full border border-surface">
                                Difficulty: {explanation.difficulty}
                            </span>
                        )}
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-background transition-colors"
                    >
                        <X className="w-6 h-6 text-text-muted hover:text-text-main" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    {loading && (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <Loader2 className="w-12 h-12 text-primary animate-spin" />
                            <p className="text-lg text-text-muted">The AI Teacher is preparing your lesson...</p>
                        </div>
                    )}

                    {error && (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4 bg-red-500/5 rounded-xl border border-red-500/20 p-6 text-center">
                            <AlertCircle className="w-12 h-12 text-red-500" />
                            <h3 className="text-xl font-bold text-red-400">Oops, something went wrong.</h3>
                            <p className="text-text-muted max-w-md">{error}</p>
                        </div>
                    )}

                    {!loading && !error && explanation && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            
                            {/* Voice Player */}
                            <div className="flex justify-end">
                                <VoicePlayer 
                                    text={explanation.simpleExplanation} 
                                    language={settings.language} 
                                />
                            </div>

                            {/* Simple Explanation */}
                            <section className="bg-background/50 p-6 rounded-xl border border-surface">
                                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Simply Put</h3>
                                <p className="text-xl text-text-main leading-relaxed font-medium">
                                    {explanation.simpleExplanation}
                                </p>
                            </section>

                            {/* Analogy */}
                            {explanation.analogy && (
                                <section className="flex gap-4 p-6 bg-secondary/10 rounded-xl border border-secondary/20">
                                    <div className="flex-shrink-0">
                                        <Zap className="w-8 h-8 text-secondary" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-secondary mb-2">Think of it like this...</h3>
                                        <p className="text-text-main leading-relaxed">{explanation.analogy}</p>
                                    </div>
                                </section>
                            )}

                            {/* Definition & Why it matters */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {explanation.definition && (
                                    <section>
                                        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                                            Formal Definition
                                        </h3>
                                        <p className="text-text-muted leading-relaxed bg-background p-4 rounded-lg">
                                            {explanation.definition}
                                        </p>
                                    </section>
                                )}
                                {explanation.whyItMatters && (
                                    <section>
                                        <h3 className="text-lg font-bold mb-3">Why it Matters</h3>
                                        <p className="text-text-muted leading-relaxed bg-background p-4 rounded-lg">
                                            {explanation.whyItMatters}
                                        </p>
                                    </section>
                                )}
                            </div>

                            {/* Step by Step */}
                            {explanation.stepByStepExplanation && explanation.stepByStepExplanation.length > 0 && (
                                <section>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <Layers className="text-primary w-6 h-6" />
                                        Step-by-Step Breakdown
                                    </h3>
                                    <ul className="space-y-3">
                                        {explanation.stepByStepExplanation.map((step, i) => (
                                            <li key={i} className="flex gap-4 bg-background p-4 rounded-lg border border-surface">
                                                <span className="font-bold text-primary text-lg">{i + 1}.</span>
                                                <span className="text-text-main">{step}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                            {/* Real Life Example & Common Mistakes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {explanation.realLifeExample && (
                                    <section className="bg-background p-6 rounded-xl">
                                        <h3 className="text-lg font-bold mb-3">Real-Life Example</h3>
                                        <p className="text-text-muted">{explanation.realLifeExample}</p>
                                    </section>
                                )}
                                
                                {explanation.commonMistakes && explanation.commonMistakes.length > 0 && (
                                    <section className="bg-red-500/5 p-6 rounded-xl border border-red-500/10">
                                        <h3 className="text-lg font-bold mb-3 text-red-400 flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5" />
                                            Common Mistakes
                                        </h3>
                                        <ul className="list-disc list-inside text-text-muted space-y-1">
                                            {explanation.commonMistakes.map((mistake, i) => (
                                                <li key={i}>{mistake}</li>
                                            ))}
                                        </ul>
                                    </section>
                                )}
                            </div>

                            {/* Images Section */}
                            {media?.images && media.images.length > 0 ? (
                                <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {media.images.map((img, i) => (
                                        <div key={i} className="bg-background rounded-xl overflow-hidden border border-surface group relative">
                                            <img src={img.url} alt={img.title} className="w-full h-48 object-cover transition-transform group-hover:scale-105" />
                                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                                                <p className="text-white text-xs font-medium truncate">{img.title}</p>
                                            </div>
                                        </div>
                                    ))}
                                </section>
                            ) : (
                                <section className="bg-surface/30 rounded-xl border border-surface/50 p-8 text-center">
                                    <p className="text-text-muted">No specific educational images found for this concept. Try looking up visualizations for a deeper understanding!</p>
                                </section>
                            )}

                            {/* Videos Section */}
                            {media?.videos && media.videos.length > 0 ? (
                                <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                                    {media.videos.map((vid, i) => (
                                        <a key={i} href={vid.url} target="_blank" rel="noopener noreferrer" className="block bg-background rounded-xl overflow-hidden border border-surface hover:border-primary/50 transition-colors group">
                                            <div className="relative h-48">
                                                <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                    <div className="w-12 h-12 bg-primary/90 rounded-full flex items-center justify-center pl-1 shadow-lg group-hover:scale-110 transition-transform">
                                                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                    </div>
                                                </div>
                                                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded font-mono">
                                                    {vid.duration}
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <h4 className="font-bold text-text-main line-clamp-2">{vid.title}</h4>
                                                <p className="text-xs text-text-muted mt-2">{vid.source}</p>
                                            </div>
                                        </a>
                                    ))}
                                </section>
                            ) : (
                                <section className="bg-surface/30 rounded-xl border border-surface/50 p-6 text-center mt-8">
                                    <p className="text-text-muted">No short educational videos found for this concept.</p>
                                </section>
                            )}

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export default LearningModal;
