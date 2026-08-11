import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import ReaderLayout from './components/ReaderLayout';
import Header from './components/Header';
import BrandingFooter from './components/BrandingFooter';

function App() {
  const [document, setDocument] = useState(null);

  return (
    <div className="h-dvh bg-background text-text-main font-sans flex flex-col overflow-hidden">
      <Header onHome={() => setDocument(null)} />

      {!document ? (
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
            <p className="text-base sm:text-lg md:text-xl text-text-muted max-w-2xl mb-6 md:mb-10">
              Upload any educational PDF, read it here, and highlight anything you get stuck on for an
              instant explanation in your language.
            </p>
            <FileUpload onUploadSuccess={setDocument} />
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
