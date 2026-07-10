import React from 'react';
import { BookOpen, Globe } from 'lucide-react';

export const LANGUAGES = [
  { code: 'te', label: 'Telugu (తెలుగు)', name: 'Telugu', ttsLocale: 'te-IN' },
  { code: 'hi', label: 'Hindi (हिन्दी)', name: 'Hindi', ttsLocale: 'hi-IN' },
  { code: 'ta', label: 'Tamil (தமிழ்)', name: 'Tamil', ttsLocale: 'ta-IN' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)', name: 'Kannada', ttsLocale: 'kn-IN' },
  { code: 'ml', label: 'Malayalam (മലയാളം)', name: 'Malayalam', ttsLocale: 'ml-IN' },
  { code: 'mr', label: 'Marathi (मराठी)', name: 'Marathi', ttsLocale: 'mr-IN' },
  { code: 'es', label: 'Spanish (Español)', name: 'Spanish', ttsLocale: 'es-ES' },
  { code: 'fr', label: 'French (Français)', name: 'French', ttsLocale: 'fr-FR' }
];

export default function Header({ selectedLanguage, onLanguageChange }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/75 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-md shadow-brand-500/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Concept<span className="bg-gradient-to-r from-brand-600 to-indigo-600 bg-clip-text text-transparent">Bridge</span>
              </h1>
              <p className="hidden text-xs font-medium text-slate-500 sm:block">
                Academic Language Equalizer
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Language Selector Dropdown */}
            <div className="relative flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm focus-within:ring-1 focus-within:ring-brand-500 focus-within:border-brand-500 transition-all">
              <Globe className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={selectedLanguage?.code || 'te'}
                onChange={(e) => {
                  const lang = LANGUAGES.find(l => l.code === e.target.value);
                  if (lang && onLanguageChange) onLanguageChange(lang);
                }}
                className="bg-transparent text-xs font-semibold text-slate-700 outline-none border-none cursor-pointer pr-1 focus:ring-0"
                title="Select Target Translation Language"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            
            <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 md:inline-block">
              Multilingual Edition
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
