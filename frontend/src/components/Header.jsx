import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

import { supportedLanguages } from '../../../shared/supportedLanguages.json';

const Header = ({ onHome }) => {
    const { settings, updateSettings } = useSettings();
    const [isOpen, setIsOpen] = useState(false);

    const languages = supportedLanguages;
    const difficulties = ['Beginner', 'Intermediate', 'Advanced'];

    return (
        <header className="w-full px-6 py-3 border-b border-white/10 bg-background flex justify-between items-center relative z-40">
            <button
                type="button"
                onClick={onHome}
                aria-label="Go to ConceptBridge home"
                className="flex items-center gap-3 min-w-0 cursor-pointer text-left rounded-md transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
                <img
                    src="/assets/branding/conceptbridge-logo.png"
                    alt="ConceptBridge logo"
                    className="h-10 w-10 object-contain rounded-md shrink-0"
                />
                <div className="flex flex-col justify-center leading-tight min-w-0">
                    <span className="text-lg font-bold text-text-main tracking-tight truncate">ConceptBridge</span>
                    <span className="text-[11px] text-text-muted truncate">AI-Powered Engineering Learning Assistant</span>
                </div>
            </button>

            <div className="relative">
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-text-main transition-colors flex items-center gap-2"
                >
                    <Settings className="w-5 h-5" />
                </button>

                {isOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white/5 border border-white/10 rounded-xl shadow-2xl p-4 animate-in slide-in-from-top-2">
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-text-muted mb-1">Language</label>
                            <select 
                                className="w-full bg-background border border-white/10 text-text-main rounded-lg p-2 focus:outline-none focus:border-primary"
                                value={settings.language}
                                onChange={(e) => updateSettings({ language: e.target.value })}
                            >
                                {languages.map(lang => (
                                    <option key={lang} value={lang}>{lang}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-1">Difficulty</label>
                            <select 
                                className="w-full bg-background border border-white/10 text-text-main rounded-lg p-2 focus:outline-none focus:border-primary"
                                value={settings.difficulty}
                                onChange={(e) => updateSettings({ difficulty: e.target.value })}
                            >
                                {difficulties.map(level => (
                                    <option key={level} value={level}>{level}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;
