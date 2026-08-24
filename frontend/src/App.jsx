import React, { Suspense, lazy, useState } from 'react';
import FileUpload from './components/FileUpload';
import ReaderLayout from './components/ReaderLayout';
import Header from './components/Header';
import BrandingFooter from './components/BrandingFooter';
import StorageQuota from './components/StorageQuota';
import DisciplineCatalogue from './components/DisciplineCatalogue';
import SubjectCatalogue from './components/SubjectCatalogue';
import SubjectView from './components/SubjectView';
import TopicView from './components/TopicView';
import { BookOpen, Loader2 } from 'lucide-react';

// Lazy-loaded: the glossary's ~250KB term dataset and its own JS should never be
// part of the initial bundle a student pays for just to upload and read a PDF.
const TechnicalTerms = lazy(() => import('./components/TechnicalTerms'));

function App() {
  const [document, setDocument] = useState(null);
  const [storageRefreshKey, setStorageRefreshKey] = useState(0);
  const [showGlossary, setShowGlossary] = useState(false);
  // 'landing' | 'discipline' | 'subject' | 'topic' — catalogue browsing, layered
  // alongside the existing document/glossary states rather than replacing them.
  // Opening a document (from anywhere) still short-circuits straight to the reader
  // via the `!document` check below, exactly as before this catalogue existed. The
  // catalogue now spans 150+ subjects across 16 disciplines, so browsing is
  // Discipline -> Subject -> Unit -> Topic rather than a flat subject list.
  const [screen, setScreen] = useState('landing');
  const [selectedDiscipline, setSelectedDiscipline] = useState(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [selectedTopicId, setSelectedTopicId] = useState(null);

  const goHome = () => {
    setDocument(null);
    setShowGlossary(false);
    setScreen('landing');
    setSelectedDiscipline(null);
    setSelectedSubjectId(null);
    setSelectedUnitId(null);
    setSelectedTopicId(null);
  };

  const openDocument = (doc) => {
    setDocument(doc);
    setStorageRefreshKey((key) => key + 1);
  };

  return (
    <div className="h-dvh bg-background text-text-main font-sans flex flex-col overflow-hidden">
      <Header onHome={goHome} onOpenGlossary={() => setShowGlossary(true)} />

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
      ) : document ? (
        <ReaderLayout document={document} />
      ) : screen === 'discipline' ? (
        <SubjectCatalogue
          discipline={selectedDiscipline}
          onBack={() => setScreen('landing')}
          onSelectSubject={(subjectId) => {
            setSelectedSubjectId(subjectId);
            setScreen('subject');
          }}
        />
      ) : screen === 'subject' ? (
        <SubjectView
          subjectId={selectedSubjectId}
          onBack={() => setScreen('discipline')}
          onSelectTopic={(unitId, topicId) => {
            setSelectedUnitId(unitId);
            setSelectedTopicId(topicId);
            setScreen('topic');
          }}
        />
      ) : screen === 'topic' ? (
        <TopicView
          subjectId={selectedSubjectId}
          unitId={selectedUnitId}
          topicId={selectedTopicId}
          onBack={() => setScreen('subject')}
          onOpenDocument={openDocument}
        />
      ) : (
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
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-2 md:mb-4 tracking-tight max-w-3xl">
              Learn engineering concepts in the <span className="text-primary">language you understand.</span>
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
              className="w-auto h-auto max-w-40 sm:max-w-56 md:max-w-72 lg:max-h-[22vh] rounded-2xl border border-white/10 shadow-lg mb-4 md:mb-8"
            />

            <DisciplineCatalogue
              onSelectDiscipline={(discipline) => {
                setSelectedDiscipline(discipline);
                setScreen('discipline');
              }}
            />

            <div className="w-full max-w-xl border-t border-white/10 pt-6 md:pt-8">
              <button
                type="button"
                onClick={() => setShowGlossary(true)}
                className="w-full flex items-center justify-center gap-2 border border-white/10 rounded-xl px-4 py-3 text-sm font-semibold text-text-main hover:border-primary/50 transition-colors mb-4"
              >
                <BookOpen className="w-4 h-4 text-primary" />
                Explore Technical Terms
              </button>

              <p className="text-xs uppercase tracking-wider text-text-muted mb-3">Or upload your own PDF</p>
              <FileUpload onUploadSuccess={openDocument} />
              <StorageQuota refreshKey={storageRefreshKey} onOpenDocument={openDocument} />
            </div>
          </main>
          <BrandingFooter />
        </div>
      )}
    </div>
  );
}

export default App;
