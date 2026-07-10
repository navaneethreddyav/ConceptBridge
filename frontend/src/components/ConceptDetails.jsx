import React, { useState, useEffect } from 'react';
import { BookOpen, Sparkles, Youtube, ExternalLink, GraduationCap, Volume2, VolumeX } from 'lucide-react';

export default function ConceptDetails({ concept, details, isLoading, error, selectedLanguage }) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Stop speaking when concept changes
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [concept]);

  // Clean up speech synthesis when component unmounts
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleListen = () => {
    if (!details || (!details.nativeExplanation && !details.teluguExplanation)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const speakText = details.nativeExplanation || details.teluguExplanation;
    
    window.speechSynthesis.cancel(); // Stop any current speaker

    const utterance = new SpeechSynthesisUtterance(speakText);
    const locale = selectedLanguage?.ttsLocale || 'te-IN';
    utterance.lang = locale;

    // Set voice matched to locale if available
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang.toLowerCase().startsWith(selectedLanguage?.code || 'te'));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  if (!concept) return null;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm space-y-6 animate-pulse">
        {/* Skeleton Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-5">
          <div className="space-y-2">
            <div className="h-7 w-48 bg-slate-200 rounded-lg"></div>
            <div className="h-5 w-32 bg-slate-200 rounded-md"></div>
          </div>
          <div className="h-8 w-28 bg-slate-200 rounded-full"></div>
        </div>

        {/* Skeleton Explanations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="h-4 w-24 bg-slate-200 rounded"></div>
            <div className="h-3 w-full bg-slate-200 rounded"></div>
            <div className="h-3 w-full bg-slate-200 rounded"></div>
            <div className="h-3 w-4/5 bg-slate-200 rounded"></div>
          </div>
          <div className="space-y-3">
            <div className="h-4 w-28 bg-slate-200 rounded"></div>
            <div className="h-3 w-full bg-slate-200 rounded"></div>
            <div className="h-3 w-full bg-slate-200 rounded"></div>
            <div className="h-3 w-3/4 bg-slate-200 rounded"></div>
          </div>
        </div>

        {/* Skeleton Example */}
        <div className="h-24 bg-slate-100 rounded-xl"></div>

        {/* Skeleton Videos */}
        <div className="space-y-3">
          <div className="h-5 w-40 bg-slate-200 rounded"></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="h-36 bg-slate-200 rounded-xl"></div>
            <div className="h-36 bg-slate-200 rounded-xl"></div>
            <div className="h-36 bg-slate-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 text-center animate-fade-in">
        <p className="text-sm font-semibold text-red-800">Explanation Error</p>
        <p className="mt-1 text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!details) return null;

  const nativeTranslation = details.nativeTranslation || details.teluguTranslation;
  const nativeExplanation = details.nativeExplanation || details.teluguExplanation;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-slide-in select-text">
      {/* Detail Panel Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-6 text-white md:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1 rounded bg-brand-500/20 px-2 py-0.5 text-xs font-semibold text-brand-300">
              Selected Topic
            </span>
            <h2 className="font-display text-2xl font-bold tracking-tight mt-1 sm:text-3xl">
              {details.concept}
            </h2>
            {nativeTranslation && (
              <p className="text-lg font-medium text-brand-200 mt-0.5">
                {nativeTranslation}
              </p>
            )}
          </div>
          
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur">
            <GraduationCap className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-8">
        {/* Bilingual Explanations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* English Panel */}
          <div className="space-y-3 p-5 rounded-2xl bg-slate-50/80 border border-slate-100">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-slate-500">
              <span className="inline-block h-2 w-2 rounded-full bg-brand-500"></span>
              Simple English Explanation
            </h3>
            <p className="text-slate-700 leading-relaxed text-sm md:text-base">
              {details.simpleExplanation}
            </p>
          </div>

          {/* Native Translation Panel with TTS */}
          <div className="space-y-3 p-5 rounded-2xl bg-brand-50/20 border border-brand-100/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2 gap-2">
                <h3 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-brand-600">
                  <span className="inline-block h-2 w-2 rounded-full bg-orange-400 animate-pulse"></span>
                  {selectedLanguage?.name || 'Translated'} Explanation
                </h3>
                <button
                  type="button"
                  onClick={handleListen}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all shadow-sm shrink-0 ${
                    isSpeaking 
                      ? 'bg-red-500 text-white hover:bg-red-600' 
                      : 'bg-brand-600 text-white hover:bg-brand-700'
                  }`}
                  title={isSpeaking ? "Stop listening" : "Listen in translated language"}
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX className="h-3.5 w-3.5" /> Stop
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3.5 w-3.5" /> Listen
                    </>
                  )}
                </button>
              </div>
              <p className="text-slate-800 leading-relaxed text-sm md:text-base font-medium">
                {nativeExplanation}
              </p>
            </div>
          </div>
        </div>

        {/* Key Takeaways Section */}
        {details.keyTakeaways && details.keyTakeaways.length > 0 && (
          <div className="rounded-2xl bg-indigo-50/50 border border-indigo-100 p-5 md:p-6 space-y-3">
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-indigo-900 uppercase tracking-wider">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-100 text-indigo-700 text-xs font-semibold">✓</span>
              Key Takeaways
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
              {details.keyTakeaways.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700 font-medium leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Real World Example Section */}
        {details.realWorldExample && (
          <div className="rounded-2xl bg-amber-50/60 border border-amber-200/60 p-5 md:p-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="font-display text-sm font-bold text-slate-800">
                Real-World Analogy
              </h3>
            </div>
            <p className="mt-3 text-slate-700 font-medium italic text-sm md:text-base leading-relaxed pl-10 border-l-2 border-amber-400">
              &ldquo;{details.realWorldExample}&rdquo;
            </p>
          </div>
        )}

        {/* YouTube Videos recommendations */}
        {details.youtubeVideos && details.youtubeVideos.length > 0 && (
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-slate-900">
              <Youtube className="h-5.5 w-5.5 text-red-600" />
              Recommended Video Lectures ({selectedLanguage?.name})
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {details.youtubeVideos.map((video, idx) => (
                <a
                  key={idx}
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-md transition-all duration-200 select-none"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow transform scale-90 group-hover:scale-100 opacity-80 group-hover:opacity-100 transition-all">
                        <Youtube className="h-5 w-5 fill-white" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-1 flex-col justify-between p-3.5">
                    <p className="line-clamp-2 text-xs font-semibold text-slate-800 leading-snug group-hover:text-brand-600 transition-colors">
                      {video.title}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between text-[10px] font-medium text-slate-400">
                      <span>YouTube Lesson</span>
                      <span className="flex items-center gap-0.5 text-slate-500 font-semibold">
                        Watch Video <ExternalLink className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
