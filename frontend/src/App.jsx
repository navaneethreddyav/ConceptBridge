import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import ReaderLayout from './components/ReaderLayout';
import Header from './components/Header';
import BrandingFooter from './components/BrandingFooter';

function App() {
  const [document, setDocument] = useState(null);

  return (
    <div className="h-screen bg-background text-text-main font-sans flex flex-col overflow-hidden">
      <Header />

      {!document ? (
        <>
          <main className="flex-1 flex flex-col items-center justify-center-safe p-6 text-center overflow-y-auto">
            <img
              src="/assets/branding/conceptbridge-logo.png"
              alt="ConceptBridge logo"
              className="h-20 w-20 object-contain rounded-2xl shadow-md mb-6"
            />
            <h2 className="text-5xl font-extrabold mb-6 tracking-tight">
              Master any Concept, <br />
              <span className="text-primary">Instantly.</span>
            </h2>
            <p className="text-xl text-text-muted max-w-2xl mb-10">
              Upload any educational PDF, read it here, and highlight anything you get stuck on for an
              instant explanation in your language.
            </p>
            <FileUpload onUploadSuccess={setDocument} />
          </main>
          <BrandingFooter />
        </>
      ) : (
        <ReaderLayout document={document} />
      )}
    </div>
  );
}

export default App;
