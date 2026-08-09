import React, { useState, useRef } from 'react';
import { UploadCloud, File, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { API_BASE_URL } from '../config/api';

const FileUpload = ({ onUploadSuccess }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [errorMessage, setErrorMessage] = useState('');
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFiles(files[0]);
        }
    };

    const handleFileInput = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFiles(files[0]);
        }
    };

    const handleFiles = async (file) => {
        if (file.type !== 'application/pdf') {
            setStatus('error');
            setErrorMessage('Only PDF files are allowed.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setStatus('error');
            setErrorMessage('File exceeds the 10MB limit.');
            return;
        }

        setStatus('uploading');
        setErrorMessage('');
        setProgress(0);

        const formData = new FormData();
        formData.append('pdf', file);

        try {
            // Fake progress for visual feedback (XMLHttpRequest could be used for real progress)
            const progressInterval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 200);

            const response = await fetch(`${API_BASE_URL}/api/upload`, {
                method: 'POST',
                body: formData,
            });

            clearInterval(progressInterval);
            setProgress(100);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            setStatus('success');
            if (onUploadSuccess) {
                onUploadSuccess(data.document);
            }
        } catch (error) {
            setStatus('error');
            setErrorMessage(error.message);
        }
    };

    return (
        <div className="w-full max-w-xl mx-auto mt-8">
            <div
                className={clsx(
                    "relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl transition-all duration-300",
                    isDragging ? "border-primary bg-primary/10 scale-105" : "border-white/10 hover:border-primary/50 hover:bg-white/5",
                    status === 'error' && "border-red-500/50 bg-red-500/5",
                    status === 'success' && "border-primary/50"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept="application/pdf"
                    onChange={handleFileInput}
                />

                {status === 'idle' && (
                    <>
                        <div className="p-4 bg-white/5 rounded-full mb-4">
                            <UploadCloud className="w-8 h-8 text-primary" />
                        </div>
                        <p className="text-lg font-medium text-text-main">
                            Drag & drop your PDF here
                        </p>
                        <p className="text-sm text-text-muted mt-2">
                            or click to browse (Max 10MB)
                        </p>
                    </>
                )}

                {status === 'uploading' && (
                    <div className="flex flex-col items-center w-full px-12">
                        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                        <p className="text-lg font-medium text-text-main mb-4">
                            Extracting concepts...
                        </p>
                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-primary transition-all duration-300 rounded-full"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {status === 'error' && (
                    <>
                        <div className="p-4 bg-red-500/10 rounded-full mb-4">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>
                        <p className="text-lg font-medium text-red-400">
                            Upload Failed
                        </p>
                        <p className="text-sm text-text-muted mt-2 text-center px-4">
                            {errorMessage}
                        </p>
                        <button 
                            className="mt-4 text-sm text-primary hover:underline"
                            onClick={(e) => { e.stopPropagation(); setStatus('idle'); }}
                        >
                            Try again
                        </button>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="p-4 border border-primary/30 rounded-full mb-4">
                            <CheckCircle2 className="w-8 h-8 text-primary" />
                        </div>
                        <p className="text-lg font-medium text-primary">
                            Upload Successful
                        </p>
                        <p className="text-sm text-text-muted mt-2">
                            Document processed and ready.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default FileUpload;
