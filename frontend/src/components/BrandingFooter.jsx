import React from 'react';

// Institutional attribution for the landing screen only — kept out of the reader/sidebar
// work screen so it never competes with or interrupts the read → highlight → understand flow.
//
// Three balanced columns on desktop (divided by a subtle border), stacked in the same
// DOM order on mobile so no responsive reordering is needed — each block is already an
// internally-centered logo-over-caption stack, so "row of blocks" vs. "column of blocks"
// is purely a change to the outer container's flex-direction.
//
// All three logos render in the same fixed box size + object-contain, so they read as
// visually equal-weight regardless of each source image's native aspect ratio — no
// stretching/distortion, just proportional scale-to-fit within an identical footprint.
const LOGO_BOX = 'h-8 w-8 md:h-14 md:w-14 object-contain';

const BrandingFooter = () => {
    return (
        <footer className="w-full border-t border-white/10 px-4 py-4 md:px-6 md:py-6 shrink-0">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-3 md:gap-0 md:divide-x md:divide-white/10">

                <div className="w-full md:flex-1 flex flex-col items-center justify-center text-center gap-2 md:px-6">
                    <img
                        src="/assets/branding/conceptbridge-logo.png"
                        alt="ConceptBridge logo"
                        className={`${LOGO_BOX} rounded-md`}
                    />
                    <div className="leading-tight">
                        <p className="text-sm font-semibold text-text-main">ConceptBridge</p>
                        <p className="text-xs text-text-muted">AI-Powered Engineering Learning Assistant</p>
                    </div>
                </div>

                <div className="w-full md:flex-1 flex flex-col items-center justify-center text-center gap-2 md:px-6">
                    <img
                        src="/assets/branding/otbi-logo.png"
                        alt="Osmania Technology Business Incubator — OU Idea Labs Foundation"
                        className={LOGO_BOX}
                    />
                    <div className="leading-tight">
                        <p className="text-xs text-text-muted">Osmania Technology Business Incubator</p>
                        <p className="text-xs text-text-muted">OU Idea Labs Foundation</p>
                    </div>
                </div>

                <div className="w-full md:flex-1 flex flex-col items-center justify-center text-center gap-2 md:px-6">
                    <img
                        src="/assets/branding/osmania-university-logo.png"
                        alt="Osmania University emblem"
                        className={`${LOGO_BOX} rounded-md`}
                    />
                    <div className="leading-tight">
                        <p className="text-xs text-text-muted">Developed under</p>
                        <p className="text-sm font-semibold text-text-main">Osmania University</p>
                    </div>
                </div>

            </div>
        </footer>
    );
};

export default BrandingFooter;
