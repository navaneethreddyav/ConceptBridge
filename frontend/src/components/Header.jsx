import React, { useState } from 'react';
import { Settings, Globe } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

import { supportedLanguages } from '../../../shared/supportedLanguages';

const Header = () => {
    const { settings, updateSettings } = useSettings();
    const [isOpen, setIsOpen] = useState(false);

    const languages = supportedLanguages;
    const difficulties = ['Beginner', 'Intermediate', 'Advanced'];

    return (
        <header className="w-full p-4 border-b border-surface bg-background flex justify-between items-center relative z-40">
            <div className="flex items-center gap-2">
                <Globe className="w-6 h-6 text-primary" />
                <h1 className="text-xl font-bold text-text-main">ConceptBridge</h1>
            </div>
            
            <div className="relative">
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-2 rounded-full bg-surface/50 hover:bg-surface text-text-main transition-colors flex items-center gap-2"
                >
                    <Settings className="w-5 h-5" />
                </button>

                {isOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-surface border border-surface/80 rounded-xl shadow-2xl p-4 animate-in slide-in-from-top-2">
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-text-muted mb-1">Language</label>
                            <select 
                                className="w-full bg-background border border-surface/50 text-text-main rounded-lg p-2 focus:outline-none focus:border-primary"
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
                                className="w-full bg-background border border-surface/50 text-text-main rounded-lg p-2 focus:outline-none focus:border-primary"
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
