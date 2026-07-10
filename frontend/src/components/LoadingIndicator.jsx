import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingIndicator({ state }) {
  // Map internal loading state to user-friendly messages
  const getStatusDetails = () => {
    switch (state) {
      case 'uploading':
        return {
          title: 'Uploading PDF...',
          description: 'Sending the file to the server for processing.',
          progress: 25
        };
      case 'extracting':
        return {
          title: 'Extracting Text...',
          description: 'Parsing academic content and cleaning text.',
          progress: 55
        };
      case 'concepts':
        return {
          title: 'Identifying Concepts...',
          description: 'AI is analyzing text to pull out core technical terms.',
          progress: 85
        };
      default:
        return {
          title: 'Processing...',
          description: 'Preparing your concepts.',
          progress: 50
        };
    }
  };

  const details = getStatusDetails();

  return (
    <div className="mx-auto max-w-md w-full flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-slate-200/80 shadow-sm animate-fade-in">
      <div className="relative flex items-center justify-center">
        {/* Dynamic pulsing glow behind spinner */}
        <div className="absolute h-10 w-10 rounded-full bg-brand-500/10 blur-xl animate-pulse"></div>
        <Loader2 className="h-10 w-10 animate-spin text-brand-600 relative z-10" />
      </div>

      <h3 className="mt-5 font-display text-lg font-semibold text-slate-900">
        {details.title}
      </h3>
      <p className="mt-1 text-center text-sm text-slate-500 max-w-[280px]">
        {details.description}
      </p>

      {/* Modern thin loading progress bar */}
      <div className="mt-6 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-brand-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${details.progress}%` }}
        ></div>
      </div>
    </div>
  );
}
