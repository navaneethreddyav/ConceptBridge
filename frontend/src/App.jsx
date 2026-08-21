import React, { Suspense, lazy, useState } from 'react';
import FileUpload from './components/FileUpload';
import ReaderLayout from './components/ReaderLayout';
import Header from './components/Header';
import BrandingFooter from './components/BrandingFooter';
import StorageQuota from './components/StorageQuota';
import { Loader2 } from 'lucide-react';

// Lazy-loaded: the glossary's ~250KB term dataset and its own JS should never be
// part of the initial bundle a student pays for just to upload and read a PDF.
const TechnicalTerms = lazy(() => import('./components/TechnicalTerms'));

function App() {
  const [document, setDocument] = useState(null);
  const [storageRefreshKey, setStorageRefreshKey] = useState(0);
  const [showGlossary, setShowGlossary] = useState(false);

  return (
    <div className="h-dvh bg-background text-text-main font-sans flex flex-col overflow-hidden">
      <Header
        onHome={() => {
          setDocument(null);
          setShowGlossary(false);
        }}
        onOpenGlossary={() => setShowGlossary(true)}
      />

      {showGlossary ? (
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center gap-2 text-sm text-text-muted">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              Loading glossary...
            </div>
          }
        >
          <TechnicalTerms onClose={() => setShowGlossary(false)} />
        </Suspense>
      ) : !document ? (
        // Hero and footer share one scroll region so the footer isn't a permanently
        // reserved slice of the viewport — on short mobile screens it flows below the
        // upload area instead of squeezing it.
        <div className="flex-1 flex flex-col overflow-y-auto">
          <main className="flex-1 flex flex-col items-center justify-center-safe p-4 md:p-6 text-center">
            <img
              src="/assets/branding/conceptbridge-logo.png"
              alt="ConceptBridge logo"
              className="h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 object-contain rounded-2xl shadow-md mb-3 md:mb-6"
            />
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-3 md:mb-6 tracking-tight">
              Understand any concept, <br />
              <span className="text-primary">instantly.</span>
            </h2>
            {/* max-w/max-h (not fixed w) so a short viewport can shrink the image
                proportionally via the height cap without distorting it — a fixed
                width would force max-height to squash it instead of scaling it. The
                34vh cap only binds on short desktop windows (e.g. 1366x768, where
                the image was otherwise pushing the upload dropzone almost entirely
                off-screen); it's above the image's natural height on any viewport
                tall enough not to need it (e.g. 1440x900), so nothing changes there. */}
            <img
              src="/assets/branding/conceptbridge-hero.jpeg"
              alt="ConceptBridge engineering learning illustration"
              className="w-auto h-auto max-w-56 sm:max-w-72 md:max-w-[420px] lg:max-w-[480px] lg:max-h-[34vh] rounded-2xl border border-white/10 shadow-lg mb-4 md:mb-6"
            />
            <p className="text-base sm:text-lg md:text-xl text-text-muted max-w-2xl mb-6 md:mb-10">
              Upload any educational PDF, read it here, and highlight anything you get stuck on for an
              instant explanation in your language.
            </p>
            <FileUpload
              onUploadSuccess={(doc) => {
                setDocument(doc);
                setStorageRefreshKey((key) => key + 1);
              }}
            />
            <StorageQuota refreshKey={storageRefreshKey} onOpenDocument={setDocument} />
          </main>
          <BrandingFooter />
        </div>
      ) : (
        <ReaderLayout document={document} />
      )}
    </div>
  );
}

export default App;
