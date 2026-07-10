import React from 'react';
import { Compass, Sparkles } from 'lucide-react';

export default function ConceptsSection({ concepts, selectedConcept, onConceptClick }) {
  if (!concepts || concepts.length === 0) return null;

  return (
    <div className="w-full space-y-6 animate-slide-in">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Compass className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Key Academic Concepts
            </h2>
            <p className="text-xs text-slate-500">
              Select a card to view explanation, Telugu translation, and video resources.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          <Sparkles className="h-3.5 w-3.5 text-brand-500" />
          {concepts.length} Identified
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {concepts.map((concept, index) => {
          const isSelected = selectedConcept === concept;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onConceptClick(concept)}
              className={`group relative flex items-center justify-between overflow-hidden rounded-xl border p-4.5 text-left transition-all duration-200 ${
                isSelected
                  ? 'border-brand-500 bg-brand-50/70 shadow-sm ring-1 ring-brand-500'
                  : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-sm'
              }`}
            >
              {/* Highlight bar for selected state */}
              <div 
                className={`absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-200 ${
                  isSelected ? 'bg-brand-600' : 'bg-transparent group-hover:bg-slate-300'
                }`}
              />
              
              <div className="pl-2.5 pr-2 truncate">
                <span className={`block truncate font-display text-base font-semibold transition-colors duration-150 ${
                  isSelected ? 'text-brand-900' : 'text-slate-800 group-hover:text-slate-900'
                }`}>
                  {concept}
                </span>
                <span className="mt-0.5 block text-xs text-slate-400 group-hover:text-slate-500">
                  Concept #{index + 1}
                </span>
              </div>
              
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold transition-all duration-200 ${
                isSelected 
                  ? 'border-brand-200 bg-brand-100 text-brand-700' 
                  : 'border-slate-100 bg-slate-50 text-slate-400 group-hover:border-slate-200 group-hover:bg-slate-100 group-hover:text-slate-600'
              }`}>
                &rarr;
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
