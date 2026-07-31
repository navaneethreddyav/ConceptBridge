import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, RotateCcw, Volume2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

const VoicePlayer = ({ text, language }) => {
    const { settings } = useSettings();
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [supported, setSupported] = useState(true);
    const [voice, setVoice] = useState(null);
    const synth = window.speechSynthesis;

    useEffect(() => {
        if (!synth) {
            setSupported(false);
            return;
        }

        const loadVoices = () => {
            const voices = synth.getVoices();
            // Map our application language to a reasonable locale prefix
            const langMap = {
                'English': 'en',
                'Telugu': 'te',
                'Hindi': 'hi',
                'Tamil': 'ta',
                'Kannada': 'kn',
                'Malayalam': 'ml'
            };
            const prefix = langMap[language] || 'en';
            
            // Find a matching voice
            const matchingVoice = voices.find(v => v.lang.startsWith(prefix));
            setVoice(matchingVoice || voices[0]);
        };

        loadVoices();
        if (synth.onvoiceschanged !== undefined) {
            synth.onvoiceschanged = loadVoices;
        }

        return () => {
            synth.cancel();
        };
    }, [language, synth]);

    useEffect(() => {
        if (settings.autoPlayVoice && text && voice) {
            handlePlay();
        }
    }, [text, voice, settings.autoPlayVoice]);

    const handlePlay = () => {
        if (isPaused) {
            synth.resume();
            setIsPaused(false);
            setIsPlaying(true);
        } else {
            synth.cancel(); // Stop any current speech
            const utterance = new SpeechSynthesisUtterance(text);
            if (voice) utterance.voice = voice;
            
            utterance.onend = () => {
                setIsPlaying(false);
                setIsPaused(false);
            };

            synth.speak(utterance);
            setIsPlaying(true);
            setIsPaused(false);
        }
    };

    const handlePause = () => {
        synth.pause();
        setIsPaused(true);
        setIsPlaying(false);
    };

    const handleStop = () => {
        synth.cancel();
        setIsPlaying(false);
        setIsPaused(false);
    };

    const handleReplay = () => {
        handleStop();
        setTimeout(handlePlay, 100);
    };

    if (!supported || !text) return null;

    return (
        <div className="flex items-center gap-2 bg-surface/50 p-2 rounded-xl border border-surface">
            <Volume2 className="w-5 h-5 text-text-muted ml-2" />
            <span className="text-sm font-medium text-text-muted mr-4 border-r border-surface/50 pr-4">AI Teacher</span>
            
            <div className="flex gap-2">
                {!isPlaying ? (
                    <button onClick={handlePlay} className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors" title="Play">
                        <Play className="w-4 h-4 fill-current" />
                    </button>
                ) : (
                    <button onClick={handlePause} className="p-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors" title="Pause">
                        <Pause className="w-4 h-4 fill-current" />
                    </button>
                )}
                
                <button onClick={handleStop} disabled={!isPlaying && !isPaused} className="p-2 bg-background border border-surface text-text-main rounded-lg hover:bg-surface disabled:opacity-50 transition-colors" title="Stop">
                    <Square className="w-4 h-4 fill-current" />
                </button>
                
                <button onClick={handleReplay} className="p-2 bg-background border border-surface text-text-main rounded-lg hover:bg-surface transition-colors" title="Replay">
                    <RotateCcw className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default VoicePlayer;
