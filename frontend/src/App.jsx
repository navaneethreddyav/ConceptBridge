import React, { useState } from 'react';
import axios from 'axios';
import Header, { LANGUAGES } from './components/Header';
import UploadSection from './components/UploadSection';
import LoadingIndicator from './components/LoadingIndicator';
import ConceptsSection from './components/ConceptsSection';
import ConceptDetails from './components/ConceptDetails';
import { AlertCircle, BookOpen, RefreshCw, Sparkles, FileText } from 'lucide-react';

export default function App() {
  const [file, setFile] = useState(null);
  const [processingState, setProcessingState] = useState(null); // 'uploading' | 'extracting' | 'concepts' | null
  const [concepts, setConcepts] = useState([]);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [conceptDetailsCache, setConceptDetailsCache] = useState({}); // { [concept_langCode]: details }
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState(null);
  const [generalError, setGeneralError] = useState(null);

  // New Selection & Document Viewer State
  const [pdfText, setPdfText] = useState('');
  const [activeTab, setActiveTab] = useState('concepts'); // 'concepts' | 'viewer'
  const [selectionText, setSelectionText] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  
  // Multilingual State
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0]); // Defaults to Telugu

  const resetState = () => {
    setFile(null);
    setProcessingState(null);
    setConcepts([]);
    setSelectedConcept(null);
    setConceptDetailsCache({});
    setExplainLoading(false);
    setExplainError(null);
    setGeneralError(null);
    setPdfText('');
    setActiveTab('concepts');
    setSelectionText('');
    setSelectedLanguage(LANGUAGES[0]);
  };

  const handleFileSelected = async (selectedFile) => {
    if (!selectedFile) {
      resetState();
      return;
    }

    setFile(selectedFile);
    setConcepts([]);
    setSelectedConcept(null);
    setConceptDetailsCache({});
    setGeneralError(null);
    setProcessingState('uploading');

    const formData = new FormData();
    formData.append('pdf', selectedFile);

    let filePath = '';

    // 1. Upload PDF
    try {
      const uploadRes = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      filePath = uploadRes.data.filePath;
    } catch (err) {
      console.error(err);
      setGeneralError(err.response?.data?.error || 'Failed to upload PDF file to the server.');
      setProcessingState(null);
      return;
    }

    // 2. Extract Text
    setProcessingState('extracting');
    let extractedText = '';
    try {
      const extractRes = await axios.post('/api/extract', { filePath });
      extractedText = extractRes.data.text;
      setPdfText(extractedText);
    } catch (err) {
      console.error(err);
      setGeneralError(err.response?.data?.error || 'Failed to extract text from the PDF file.');
      setProcessingState(null);
      return;
    }

    // 3. Extract Concepts
    setProcessingState('concepts');
    try {
      const conceptsRes = await axios.post('/api/concepts', { text: extractedText });
      const extractedConcepts = conceptsRes.data.concepts;

      if (!extractedConcepts || extractedConcepts.length === 0) {
        setGeneralError('No concepts could be extracted from this PDF. Please try a different document.');
        setProcessingState(null);
        return;
      }

      setConcepts(extractedConcepts);
      setProcessingState(null);

      // Auto-select the first concept to make it easy
      if (extractedConcepts.length > 0) {
        handleConceptSelect(extractedConcepts[0]);
      }
    } catch (err) {
      console.error(err);
      setGeneralError(err.response?.data?.error || 'AI failed to process and extract concepts.');
      setProcessingState(null);
    }
  };

  const triggerConceptExplanation = async (concept, lang) => {
    const cacheKey = `${concept}_${lang.code}`;
    setExplainLoading(true);
    setExplainError(null);

    try {
      const explainRes = await axios.post('/api/explain', { 
        concept, 
        language: lang.name 
      });
      setConceptDetailsCache((prev) => ({
        ...prev,
        [cacheKey]: explainRes.data,
      }));
    } catch (err) {
      console.error(err);
      setExplainError(err.response?.data?.error || `Failed to fetch explanation for "${concept}".`);
    } finally {
      setExplainLoading(false);
    }
  };

  const triggerSelectionExplanation = async (text, lang) => {
    const cacheKey = `${text}_${lang.code}`;
    setExplainLoading(true);
    setExplainError(null);

    try {
      const res = await axios.post('/api/explain-selection', { 
        text, 
        language: lang.name 
      });
      setConceptDetailsCache((prev) => ({
        ...prev,
        [cacheKey]: res.data
      }));
    } catch (err) {
      console.error(err);
      setExplainError(err.response?.data?.error || `Failed to explain the selected text.`);
    } finally {
      setExplainLoading(false);
    }
  };

  const handleConceptSelect = (concept) => {
    setSelectedConcept(concept);
    const cacheKey = `${concept}_${selectedLanguage.code}`;

    if (!conceptDetailsCache[cacheKey]) {
      triggerConceptExplanation(concept, selectedLanguage);
    } else {
      setExplainError(null);
    }
  };

  const handleExplainSelection = () => {
    if (!selectionText) return;

    const textToExplain = selectionText;
    
    // Clear selection
    setSelectionText('');
    window.getSelection().removeAllRanges();

    setSelectedConcept(textToExplain);
    const cacheKey = `${textToExplain}_${selectedLanguage.code}`;

    if (!conceptDetailsCache[cacheKey]) {
      triggerSelectionExplanation(textToExplain, selectedLanguage);
    } else {
      setExplainError(null);
    }
  };

  const handleLanguageChange = (lang) => {
    setSelectedLanguage(lang);
    
    if (selectedConcept) {
      const cacheKey = `${selectedConcept}_${lang.code}`;
      
      // If not in cache, load it immediately
      if (!conceptDetailsCache[cacheKey]) {
        const isConceptCard = concepts.includes(selectedConcept);
        if (isConceptCard) {
          triggerConceptExplanation(selectedConcept, lang);
        } else {
          triggerSelectionExplanation(selectedConcept, lang);
        }
      }
    }
  };

  // Text highlight handler
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 5 && text.length < 500) {
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Calculate coordinates relative to the viewport + scroll offset
        setTooltipPosition({
          top: rect.top + window.scrollY - 48,
          left: rect.left + window.scrollX + (rect.width / 2) - 64
        });
        setSelectionText(text);
      } catch (err) {
        setSelectionText('');
      }
    } else {
      setSelectionText('');
    }
  };

  // Resolve current active cache details
  const activeDetailsKey = selectedConcept ? `${selectedConcept}_${selectedLanguage.code}` : '';
  const activeDetails = conceptDetailsCache[activeDetailsKey] || null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col grid-bg select-none">
      <Header selectedLanguage={selectedLanguage} onLanguageChange={handleLanguageChange} />

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-10">
        
        {/* Welcome Section / File Uploader */}
        {concepts.length === 0 && !processingState && (
          <div className="mx-auto max-w-2xl text-center space-y-4 py-6 md:py-10">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-8 ring-brand-500/5 mb-2">
              <BookOpen className="h-6 w-6" />
            </div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Bridge Language Gaps in Technical Studies
            </h2>
            <p className="text-slate-600 text-sm md:text-base max-w-lg mx-auto">
              Upload any English textbook, article, or lecture notes PDF. We will automatically find key concepts and generate clear explanations, regional translation, examples, and video lessons.
            </p>
          </div>
        )}

        {/* Upload Container */}
        {concepts.length === 0 && (
          <div className="flex justify-center">
            {processingState ? (
              <LoadingIndicator state={processingState} />
            ) : (
              <UploadSection onFileSelected={handleFileSelected} isProcessing={false} />
            )}
          </div>
        )}

        {/* Error Messaging */}
        {generalError && (
          <div className="mx-auto max-w-2xl flex items-start gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-inset ring-red-600/15 animate-fade-in">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Error Occurred</p>
              <p className="mt-1 text-red-700 leading-relaxed">{generalError}</p>
              <button 
                type="button" 
                onClick={resetState}
                className="mt-3 flex items-center gap-1.5 text-xs font-bold text-red-800 hover:text-red-950 underline transition-all"
              >
                <RefreshCw className="h-3 w-3" /> Try Another Upload
              </button>
            </div>
          </div>
        )}

        {/* Main Workspace (Concepts & Document Viewer Left, Explanations Right) */}
        {concepts.length > 0 && (
          <div className="space-y-6">
            
            {/* Top info and upload new bar */}
            <div className="flex justify-between items-center bg-white/60 p-4 rounded-xl border border-slate-200/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="font-medium text-slate-800">Current PDF:</span>
                <span className="truncate max-w-[150px] md:max-w-[350px] bg-slate-100 px-2 py-0.5 rounded text-xs font-semibold text-slate-700" title={file?.name}>
                  {file?.name}
                </span>
              </div>
              <button
                type="button"
                onClick={resetState}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className="h-3 w-3 text-slate-500" />
                Upload New Document
              </button>
            </div>

            {/* Split layout workspace */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
              
              {/* Left Column: Tab container (Concepts or Selectable Viewer) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Tabs switcher header */}
                <div className="flex border-b border-slate-200 bg-slate-100/50 p-1.5 rounded-xl gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('concepts')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                      activeTab === 'concepts'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/40'
                    }`}
                  >
                    <Sparkles className="h-4 w-4 text-brand-500" />
                    AI Concepts List
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('viewer')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                      activeTab === 'viewer'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/40'
                    }`}
                  >
                    <FileText className="h-4 w-4 text-indigo-500" />
                    Document Reader
                  </button>
                </div>

                {/* Tab Contents */}
                <div className="transition-all duration-300">
                  {activeTab === 'concepts' ? (
                    <ConceptsSection
                      concepts={concepts}
                      selectedConcept={selectedConcept}
                      onConceptClick={handleConceptSelect}
                    />
                  ) : (
                    <div className="relative space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <div className="text-left">
                          <h2 className="font-display text-lg font-bold text-slate-900">
                            Selectable Document Text
                          </h2>
                          <p className="text-xs text-slate-500">
                            Highlight any word, sentence, or paragraph to trigger a custom explanation.
                          </p>
                        </div>
                      </div>
                      
                      {/* Document Viewer Container */}
                      <div 
                        onMouseUp={handleTextSelection}
                        className="border border-slate-200 bg-white p-6 rounded-2xl h-[480px] overflow-y-auto font-sans text-slate-700 leading-relaxed whitespace-pre-wrap select-text cursor-text focus:outline-none relative shadow-sm"
                      >
                        {pdfText}
                      </div>

                      {/* Selection Tooltip Button */}
                      {selectionText && (
                        <button
                          type="button"
                          onClick={handleExplainSelection}
                          style={{
                            position: 'absolute',
                            top: `${tooltipPosition.top}px`,
                            left: `${tooltipPosition.left}px`,
                            zIndex: 1000,
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xl hover:bg-brand-600 active:scale-95 transition-all animate-fade-in border border-slate-700 cursor-pointer"
                        >
                          <span>Explain Selection 💡</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Explanations Display Panel */}
              <div className="lg:col-span-5">
                {selectedConcept || explainLoading ? (
                  <ConceptDetails
                    concept={selectedConcept}
                    details={activeDetails}
                    isLoading={explainLoading}
                    error={explainError}
                    selectedLanguage={selectedLanguage}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400 bg-white/40 backdrop-blur-sm h-[320px] flex flex-col items-center justify-center space-y-3">
                    <BookOpen className="h-8 w-8 text-slate-300" />
                    <div>
                      <p className="font-semibold text-slate-600 text-sm">No Concept Selected</p>
                      <p className="text-xs max-w-[200px] mx-auto mt-0.5">
                        Select an AI concept card or highlight text in the Document Reader tab.
                      </p>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </main>

      <footer className="w-full border-t border-slate-200/80 bg-white py-6 mt-12">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} ConceptBridge. Built for students from regional-language academic backgrounds.</p>
        </div>
      </footer>
    </div>
  );
}
