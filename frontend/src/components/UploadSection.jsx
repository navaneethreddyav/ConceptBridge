import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, AlertCircle, Trash2 } from 'lucide-react';

export default function UploadSection({ onFileSelected, isProcessing }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateAndSetFile = (file) => {
    if (!file) return;

    // Check if the file is a PDF
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Invalid file type. Please upload a PDF file only.');
      setSelectedFile(null);
      return;
    }

    setErrorMessage('');
    setSelectedFile(file);
    onFileSelected(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const removeFile = (e) => {
    e.stopPropagation();
    setSelectedFile(null);
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onFileSelected(null);
  };

  return (
    <div className="mx-auto max-w-2xl w-full">
      <div 
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
          dragActive 
            ? 'border-brand-500 bg-brand-50/50 scale-[1.01]' 
            : 'border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50/50'
        } ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,application/pdf"
          onChange={handleChange}
          disabled={isProcessing}
        />

        {!selectedFile ? (
          <div className="flex flex-col items-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <UploadCloud className="h-8 w-8" />
            </div>
            <p className="font-display text-lg font-semibold text-slate-900">
              Upload your academic PDF
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Drag & drop your file here, or click to browse
            </p>
            <button
              type="button"
              onClick={onButtonClick}
              className="mt-6 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 transition-all duration-200"
            >
              Select File
            </button>
            <p className="mt-3 text-xs text-slate-400">
              PDF files only (Max size: 10MB)
            </p>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex items-center gap-3 truncate">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                <FileText className="h-5 w-5" />
              </div>
              <div className="truncate text-left">
                <p className="truncate text-sm font-medium text-slate-900">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-slate-500">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            {!isProcessing && (
              <button
                type="button"
                onClick={removeFile}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/50 hover:text-slate-600 transition-colors"
                title="Remove file"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-red-50 p-3.5 text-sm text-red-800 ring-1 ring-inset ring-red-600/15 animate-fade-in">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold">Validation Error</p>
            <p className="mt-0.5 text-red-700">{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
