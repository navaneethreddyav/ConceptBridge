import React from 'react';

// Institutional attribution for the landing screen only — kept out of the reader/sidebar
// work screen so it never competes with or interrupts the read → highlight → understand flow.
//
// Desktop (md:) is unchanged from before: three columns in a row, divided by a subtle
// border, each an internally-centered logo-over-caption stack. Mobile is its own
// compact single row (not a tall vertical stack) driven entirely by the unprefixed
// base classes below — every visual change here is mobile-only; every md: class is
// untouched, so desktop renders identically to before.
//
// All three logos render in the same fixed box size + object-contain, so they read as
// visually equal-weight regardless of each source image's native aspect ratio — no
// stretching/distortion, just proportional scale-to-fit within an identical footprint.
const LOGO_BOX = 'h-6 w-6 md:h-14 md:w-14 object-contain shrink-0';

const BrandingFooter = () => {
    return (
        <footer className="w-full border-t border-white/10 px-3 py-3 md:px-6 md:py-6 shrink-0">
            {/* Outer element owns the scroll/centering; inner owns the flex row itself.
                justify-center directly on a scrollable flex container splits overflow
                across both edges, and the leading edge becomes unreachable (scrollLeft
                can't go negative) — centering via mx-auto on a w-max inner element
                avoids that: when content fits it's centered as before, and when it
                doesn't, the browser's own margin:auto-collapses-to-0 behavior means
                scrollLeft 0 always shows the true start of the content. */}
            <div className="max-w-4xl mx-auto overflow-x-auto">
                <div className="w-max mx-auto flex flex-row flex-nowrap items-center gap-3 md:w-full md:items-stretch md:gap-0 md:divide-x md:divide-white/10">

                    <div className="shrink-0 flex flex-row items-center gap-1.5 md:w-full md:flex-1 md:flex-col md:justify-center md:text-center md:gap-2 md:px-6">
                        <img
                            src="/assets/branding/conceptbridge-logo.png"
                            alt="ConceptBridge logo"
                            className={`${LOGO_BOX} rounded-md`}
                        />
                        <div className="leading-tight">
                            <p className="text-[10px] md:text-sm font-semibold text-text-main whitespace-nowrap md:whitespace-normal">
                                ConceptBridge
                            </p>
                            <p className="hidden md:block text-xs text-text-muted">AI-Powered Engineering Learning Assistant</p>
                        </div>
                    </div>

                    <div className="shrink-0 flex flex-row items-center gap-1.5 md:w-full md:flex-1 md:flex-col md:justify-center md:text-center md:gap-2 md:px-6">
                        <img
                            src="/assets/branding/otbi-logo.png"
                            alt="Osmania Technology Business Incubator (OTBI)"
                            className={LOGO_BOX}
                        />
                        <div className="leading-tight">
                            <p className="text-[10px] md:hidden font-semibold text-text-main whitespace-nowrap">OTBI</p>
                            <p className="hidden md:block text-xs text-text-muted">Osmania Technology Business Incubator</p>
                            <p className="hidden md:block text-xs text-text-muted">OTBI</p>
                        </div>
                    </div>

                    <div className="shrink-0 flex flex-row items-center gap-1.5 md:w-full md:flex-1 md:flex-col md:justify-center md:text-center md:gap-2 md:px-6">
                        <img
                            src="/assets/branding/osmania-university-logo.png"
                            alt="Osmania University emblem"
                            className={`${LOGO_BOX} rounded-md`}
                        />
                        <div className="leading-tight">
                            <p className="text-[10px] md:hidden font-semibold text-text-main whitespace-nowrap">Osmania University</p>
                            <p className="hidden md:block text-xs text-text-muted">Developed under</p>
                            <p className="hidden md:block text-sm font-semibold text-text-main">Osmania University</p>
                        </div>
                    </div>

                </div>
            </div>
        </footer>
    );
};

export default BrandingFooter;
