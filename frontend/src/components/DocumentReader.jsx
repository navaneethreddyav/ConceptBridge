import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

const CONTEXT_CHARS = 800;
const MAX_HIGHLIGHTED_TERMS = 40;
const CONTEXT_ROOT_SELECTOR = '.react-pdf__Page__textContent, [data-context-root]';

const escapeHtml = (value) =>
    value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Every ordering step has an explicit tiebreak so the same concept list always
// produces the same highlights, and inner spaces match across wrapped lines.
const buildTermRegex = (concepts) => {
    const seen = new Set();
    const names = [];

    concepts
        .map((concept) => ({
            name: (concept.name || '').replace(/\s+/g, ' ').trim(),
            importance: Number(concept.importance) || 0
        }))
        .filter((concept) => concept.name.length > 2)
        .sort((a, b) => b.importance - a.importance || a.name.localeCompare(b.name))
        .forEach((concept) => {
            const key = concept.name.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            names.push(concept.name);
        });

    const selected = names
        .slice(0, MAX_HIGHLIGHTED_TERMS)
        .sort((a, b) => b.length - a.length || a.localeCompare(b));

    if (selected.length === 0) return null;

    const pattern = selected.map((name) => escapeRegExp(name).replace(/ /g, '\\s+')).join('|');
    return new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`, 'giu');
};

const markUpTerms = (raw, termRegex) => {
    if (!termRegex) return escapeHtml(raw);

    let output = '';
    let last = 0;
    termRegex.lastIndex = 0;

    let match = termRegex.exec(raw);
    while (match !== null) {
        output += escapeHtml(raw.slice(last, match.index));
        output += `<mark data-cb-term="true">${escapeHtml(match[0])}</mark>`;
        last = match.index + match[0].length;
        if (match[0].length === 0) termRegex.lastIndex += 1;
        match = termRegex.exec(raw);
    }
    output += escapeHtml(raw.slice(last));
    return output;
};

// Offsets are measured against the nearest context root (a pdf.js text layer, or the
// raw-text container in fallback mode) so both render modes share one context path.
const contextFromRange = (range) => {
    const startEl =
        range.startContainer.nodeType === Node.ELEMENT_NODE
            ? range.startContainer
            : range.startContainer.parentElement;
    const root = startEl?.closest(CONTEXT_ROOT_SELECTOR);
    if (!root) return { contextBefore: '', contextAfter: '' };

    const full = root.textContent || '';
    const preRange = document.createRange();
    preRange.selectNodeContents(root);
    preRange.setEnd(range.startContainer, range.startOffset);

    const start = preRange.toString().length;
    const end = start + range.toString().length;

    return {
        contextBefore: full.slice(Math.max(0, start - CONTEXT_CHARS), start),
        contextAfter: full.slice(end, end + CONTEXT_CHARS)
    };
};

const DocumentReader = ({ document: doc, onSelect }) => {
    const containerRef = useRef(null);
    const pageRefs = useRef([]);
    const detectRequestRef = useRef({ key: null, promise: null });
    const [numPages, setNumPages] = useState(0);
    const [pageWidth, setPageWidth] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pdfFailed, setPdfFailed] = useState(false);
    const [concepts, setConcepts] = useState([]);

    const fileUrl = `${API_BASE_URL}/api/upload/${doc.id}/file`;
    const rawText = doc.content?.rawText || '';

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return undefined;

        const observer = new ResizeObserver(([entry]) => {
            setPageWidth(Math.max(320, entry.contentRect.width - 48));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        let cancelled = false;

        // Reuses the in-flight promise so a re-fired effect (StrictMode remount, rapid
        // re-render) never spends a second detection call on the same document.
        if (detectRequestRef.current.key !== doc.id) {
            detectRequestRef.current = {
                key: doc.id,
                promise: fetch(`${API_BASE_URL}/api/concepts/detect`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ documentId: doc.id, text: rawText })
                })
                    .then((res) => res.json())
                    // Auto-highlighting is an enhancement; manual selection works without it.
                    .catch(() => null)
            };
        }

        detectRequestRef.current.promise.then((data) => {
            if (!cancelled && Array.isArray(data?.concepts)) {
                setConcepts(data.concepts);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [doc.id, rawText]);

    // Keeps the page counter honest during free scrolling, not just button clicks.
    // Tracks every observed page's latest intersection ratio (IntersectionObserver
    // only reports entries that crossed a threshold in a given callback, not the
    // full set), then picks the most-visible page across all of them.
    useEffect(() => {
        if (pdfFailed || numPages === 0) return undefined;
        const root = containerRef.current;
        if (!root) return undefined;

        const ratios = new Map();
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => ratios.set(entry.target, entry.intersectionRatio));

                let bestIndex = -1;
                let bestRatio = 0;
                pageRefs.current.forEach((el, index) => {
                    const ratio = ratios.get(el) || 0;
                    if (ratio > bestRatio) {
                        bestRatio = ratio;
                        bestIndex = index;
                    }
                });
                if (bestIndex !== -1) setCurrentPage(bestIndex + 1);
            },
            { root, threshold: [0, 0.25, 0.5, 0.75, 1] }
        );

        pageRefs.current.forEach((el) => el && observer.observe(el));
        return () => observer.disconnect();
    }, [pdfFailed, numPages]);

    const termRegex = useMemo(() => buildTermRegex(concepts), [concepts]);

    const emitSelection = useCallback(
        (text, contextBefore, contextAfter) => {
            const trimmed = text.trim();
            if (!trimmed) return;
            onSelect({ text: trimmed, contextBefore, contextAfter });
        },
        [onSelect]
    );

    const handleMouseUp = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
        if (!selection.toString().trim()) return;

        const range = selection.getRangeAt(0);
        const { contextBefore, contextAfter } = contextFromRange(range);
        emitSelection(selection.toString(), contextBefore, contextAfter);
    }, [emitSelection]);

    const handleClick = useCallback(
        (event) => {
            const mark = event.target.closest?.('mark[data-cb-term]');
            if (!mark) return;

            const range = document.createRange();
            range.selectNodeContents(mark);
            const { contextBefore, contextAfter } = contextFromRange(range);
            emitSelection(mark.textContent || '', contextBefore, contextAfter);
        },
        [emitSelection]
    );

    const customTextRenderer = useCallback(
        ({ str }) => markUpTerms(str, termRegex),
        [termRegex]
    );

    const goToPage = (target) => {
        const clamped = Math.min(Math.max(target, 1), numPages || 1);
        setCurrentPage(clamped);
        pageRefs.current[clamped - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="flex flex-col h-full min-h-0 bg-black">
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/10 shrink-0">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-text-main truncate">
                        {doc.filename || doc.metadata?.title}
                    </p>
                    <p className="text-xs text-text-muted">
                        Select any word or phrase to open ConceptBridge
                    </p>
                </div>

                {!pdfFailed && numPages > 0 && (
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage <= 1}
                            className="p-2 rounded-lg border border-white/10 text-text-main hover:border-primary/50 disabled:opacity-30 transition-colors"
                            title="Previous page"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-mono text-text-muted tabular-nums">
                            {currentPage} / {numPages}
                        </span>
                        <button
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage >= numPages}
                            className="p-2 rounded-lg border border-white/10 text-text-main hover:border-primary/50 disabled:opacity-30 transition-colors"
                            title="Next page"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            <div
                ref={containerRef}
                onMouseUp={handleMouseUp}
                onClick={handleClick}
                className="flex-1 min-h-0 overflow-y-auto px-6 py-6"
            >
                {pdfFailed ? (
                    <div className="mx-auto max-w-3xl">
                        <div className="flex items-center gap-2 mb-4 text-xs text-text-muted">
                            <AlertCircle className="w-4 h-4 text-primary" />
                            Showing extracted text (the PDF could not be rendered).
                        </div>
                        <div
                            data-context-root="true"
                            className="whitespace-pre-wrap leading-relaxed text-text-main text-[15px] selection:bg-primary/40"
                            dangerouslySetInnerHTML={{ __html: markUpTerms(rawText, termRegex) }}
                        />
                    </div>
                ) : (
                    <Document
                        file={fileUrl}
                        onLoadSuccess={({ numPages: total }) => setNumPages(total)}
                        onLoadError={() => setPdfFailed(true)}
                        onSourceError={() => setPdfFailed(true)}
                        loading={
                            <div className="flex flex-col items-center justify-center py-24 gap-4">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                <p className="text-sm text-text-muted">Loading document...</p>
                            </div>
                        }
                        error={
                            <div className="flex flex-col items-center justify-center py-24 gap-3">
                                <AlertCircle className="w-8 h-8 text-red-500" />
                                <p className="text-sm text-text-muted">Could not render the PDF.</p>
                            </div>
                        }
                        className="flex flex-col items-center gap-6"
                    >
                        {Array.from({ length: numPages }, (_, index) => (
                            <div
                                key={index}
                                ref={(el) => {
                                    pageRefs.current[index] = el;
                                }}
                                className="border border-white/10 rounded-lg overflow-hidden bg-white"
                            >
                                <Page
                                    pageNumber={index + 1}
                                    width={pageWidth || undefined}
                                    renderTextLayer
                                    renderAnnotationLayer={false}
                                    customTextRenderer={customTextRenderer}
                                    loading={
                                        <div className="flex items-center justify-center h-96 bg-black">
                                            <Loader2 className="w-6 h-6 text-primary animate-spin" />
                                        </div>
                                    }
                                />
                            </div>
                        ))}
                    </Document>
                )}
            </div>
        </div>
    );
};

export default DocumentReader;
