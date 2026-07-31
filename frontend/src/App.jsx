import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import ConceptList from './components/ConceptList';
import Header from './components/Header';

function App() {
  const [document, setDocument] = useState(null);

  const handleUploadSuccess = (doc) => {
    setDocument(doc);
  };

  return (
    <div className="min-h-screen bg-background text-text-main font-sans flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {!document ? (
          <>
            <h2 className="text-5xl font-extrabold mb-6 tracking-tight">
              Master any Concept, <br />
              <span className="text-primary">Instantly.</span>
            </h2>
            <p className="text-xl text-text-muted max-w-2xl mb-10">
              Upload any educational PDF and let our AI teacher guide you with tailored explanations, analogies, and quizzes in your native language.
            </p>
            <FileUpload onUploadSuccess={(doc) => setDocument(doc)} />
          </>
        ) : (
          <div className="w-full max-w-3xl text-left bg-surface/50 p-8 rounded-2xl border border-surface">
            <h3 className="text-2xl font-bold mb-4">Document Extracted</h3>
            <div className="space-y-4">
              <div className="flex justify-between border-b border-surface pb-2">
                <span className="text-text-muted">Filename:</span>
                <span className="font-medium">{document.filename}</span>
              </div>
              <div className="flex justify-between border-b border-surface pb-2">
                <span className="text-text-muted">Title (from metadata):</span>
                <span className="font-medium">{document.metadata.title}</span>
              </div>
              <div className="flex justify-between border-b border-surface pb-2">
                <span className="text-text-muted">Pages:</span>
                <span className="font-medium">{document.metadata.pageCount}</span>
              </div>
              <div className="flex justify-between border-b border-surface pb-2">
                <span className="text-text-muted">Extracted Characters:</span>
                <span className="font-medium">{document.metadata.extractedTextLength.toLocaleString()}</span>
              </div>
            </div>
            
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-2 text-text-muted">Raw Text Preview:</h4>
              <div className="bg-background p-4 rounded-lg overflow-y-auto h-32 text-sm font-mono whitespace-pre-wrap border border-surface">
                {document.content.rawText}
              </div>
            </div>

            <ConceptList document={document} />

            <div className="mt-6 flex justify-center">
              <button 
                onClick={() => setDocument(null)}
                className="bg-surface hover:bg-surface/80 text-white font-medium py-2 px-6 rounded-lg transition-colors border border-surface/50"
              >
                Upload Another Document
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
