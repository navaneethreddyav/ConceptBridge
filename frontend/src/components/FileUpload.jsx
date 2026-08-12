import React, { useState, useRef } from 'react';
import { UploadCloud, File, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { API_BASE_URL } from '../config/api';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Hosting platforms can occasionally return a non-JSON response ahead of the actual
// app response — e.g. a proxy/edge layer's own error page during a cold start — which
// never happens against a local server with no such layer in front of it. Blindly
// calling response.json() on that throws a cryptic, JS-engine-specific parser error
// (e.g. Safari's "The string did not match the expected pattern.") instead of a real,
// actionable message. Guard on content-type before parsing, and signal the caller
// whether this looks like a one-off platform blip worth a single silent retry.
const parseUploadResponse = async (response) => {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        const err = new Error(
            response.ok
                ? 'Unexpected response from the server. Please try again.'
                : `Server error (${response.status}). Please try again in a moment.`
        );
        err.transient = true;
        throw err;
    }

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
    }
    return data;
};

// XMLHttpRequest rather than fetch(): fetch has no widely-supported way to observe
// request-body progress, and a 50MB textbook needs real byte-level feedback. The
// resolved object mimics the slice of the Response interface parseUploadResponse uses.
const uploadWithProgress = (file, onProgress) =>
    new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('pdf', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}/api/upload`);
        // Carries the anonymous identity cookie (see backend/src/middleware/userIdentity.js)
        // so uploads are attributed to the right owner for quota accounting.
        xhr.withCredentials = true;

        // Second argument reports whether the browser actually gave us a byte total:
        // without it a percentage would be invented rather than measured.
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                onProgress(Math.round((event.loaded / event.total) * 100), true);
            }
        };
        xhr.upload.onload = () => onProgress(100, false);

        xhr.onload = () => {
            resolve({
                ok: xhr.status >= 200 && xhr.status < 300,
                status: xhr.status,
                headers: { get: (name) => xhr.getResponseHeader(name) },
                json: async () => JSON.parse(xhr.responseText),
            });
        };
        xhr.onerror = () => reject(new Error('Network error during upload. Please try again.'));
        xhr.onabort = () => reject(new Error('Upload was cancelled.'));

        xhr.send(formData);
    });

const FileUpload = ({ onUploadSuccess }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [errorMessage, setErrorMessage] = useState('');
    const [progress, setProgress] = useState(0);
    const [progressMeasured, setProgressMeasured] = useState(false);
    const fileInputRef = useRef(null);

    const isUploading = status === 'uploading';

    const openFilePicker = () => {
        if (isUploading) return;
        fileInputRef.current?.click();
    };

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
        // Allow re-picking the same file after a failed attempt, which otherwise
        // fires no change event and looks like a dead tap.
        e.target.value = '';
    };

    const handleFiles = async (file) => {
        if (isUploading) return;

        if (file.type !== 'application/pdf') {
            setStatus('error');
            setErrorMessage('Only PDF files are allowed.');
            return;
        }
        if (file.size > 50 * 1024 * 1024) {
            setStatus('error');
            setErrorMessage('File exceeds the 50MB limit.');
            return;
        }

        setStatus('uploading');
        setErrorMessage('');
        setProgress(0);
        setProgressMeasured(false);

        try {
            const handleProgress = (percent, measured) => {
                if (measured) setProgressMeasured(true);
                setProgress(percent);
            };

            const doUpload = () => {
                setProgress(0);
                setProgressMeasured(false);
                return uploadWithProgress(file, handleProgress).then(parseUploadResponse);
            };

            let data;
            try {
                data = await doUpload();
            } catch (err) {
                // One silent retry, only for the platform-transient case above — a
                // real validation error (bad file type, oversized file, corrupt PDF)
                // comes back as proper JSON and never hits this branch.
                if (!err.transient) throw err;
                await sleep(1500);
                data = await doUpload();
            }
            setProgress(100);

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
        <div className="w-full max-w-xl mx-auto mt-6 md:mt-8">
            <div
                className={clsx(
                    "relative flex flex-col items-center justify-center w-full h-56 md:h-64 border-2 border-dashed rounded-2xl transition-all duration-300",
                    isDragging ? "border-primary bg-primary/10 scale-105" : "border-white/10",
                    !isDragging && !isUploading && "hover:border-primary/50 hover:bg-white/5",
                    isUploading && "cursor-wait",
                    status === 'error' && "border-red-500/50 bg-red-500/5",
                    status === 'success' && "border-primary/50"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={openFilePicker}
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
                            or click to browse (Max 50MB)
                        </p>
                    </>
                )}

                {status === 'uploading' && (
                    <div className="flex flex-col items-center w-full px-6 md:px-12">
                        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                        <p className="text-lg font-medium text-text-main mb-1">
                            {progress < 100 ? 'Uploading PDF...' : 'Processing document...'}
                        </p>
                        <p className="text-sm text-text-muted mb-4 text-center">
                            {progress === 100
                                ? 'Extracting text and concepts. This can take a moment for large documents.'
                                : progressMeasured
                                    ? `${progress}% transferred`
                                    : 'Transferring your document. This can take a moment for large files.'}
                        </p>
                        {(progressMeasured || progress === 100) && (
                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-300 rounded-full"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}
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
