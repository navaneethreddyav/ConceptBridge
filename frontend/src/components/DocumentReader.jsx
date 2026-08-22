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

// Touch selection has no "release" event of its own — the user keeps nudging the OS
// selection handles, firing selectionchange each time. Acting only after this much
// quiet is what separates "still dragging" from "settled on a phrase".
const SELECTION_SETTLE_MS = 300;

// Only pages within this radius of the current page mount a real <Page>; a 500-page
// book therefore never has more than 2*RADIUS+1 canvases and text layers alive.
const WINDOW_RADIUS = 2;
const DEFAULT_PAGE_RATIO = 1.294;
const FALLBACK_PAGE_WIDTH = 640;

const WORD_CHAR = /[\p{L}\p{N}_'-]/u;

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

const rootFor = (node) => {
    if (!node) return null;
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return element?.closest(CONTEXT_ROOT_SELECTOR) || null;
};

const textNodesIn = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node = walker.nextNode();
    while (node) {
        if (node.length > 0) nodes.push(node);
        node = walker.nextNode();
    }
    return nodes;
};

// pdf.js splits a line into many spans, and consecutive spans in document order are
// often on *different* visual lines. Word-joining across a node boundary is only
// correct when the two fragments actually sit on the same line.
const sameVisualLine = (a, b) => {
    const rectA = (a.parentElement || a).getBoundingClientRect?.();
    const rectB = (b.parentElement || b).getBoundingClientRect?.();
    if (!rectA || !rectB || !rectA.height || !rectB.height) return false;
    return Math.abs(rectA.top - rectB.top) <= Math.min(rectA.height, rectB.height) * 0.5;
};

const findTextNode = (nodes, container, fromEnd) => {
    if (fromEnd) {
        for (let i = nodes.length - 1; i >= 0; i -= 1) {
            if (container.contains(nodes[i])) return i;
        }
        return -1;
    }
    return nodes.findIndex((node) => container.contains(node));
};

// Normalizes an arbitrary (node, offset) Range boundary onto the page's flat text-node
// list. A boundary sitting on a node seam is pulled to the touching side so the snap
// walk inspects the character the user actually stopped next to.
const toTextPoint = (container, offset, nodes, isEnd) => {
    if (container.nodeType === Node.TEXT_NODE) {
        let index = nodes.indexOf(container);
        if (index === -1) return null;
        let position = Math.min(offset, container.length);
        if (isEnd && position === 0 && index > 0) {
            index -= 1;
            position = nodes[index].length;
        }
        if (!isEnd && position === container.length && index < nodes.length - 1) {
            index += 1;
            position = 0;
        }
        return { index, offset: position };
    }

    const children = Array.from(container.childNodes);
    if (children.length === 0) return null;

    if (isEnd) {
        const child = children[Math.max(0, Math.min(offset, children.length) - 1)];
        const index = findTextNode(nodes, child, true);
        return index === -1 ? null : { index, offset: nodes[index].length };
    }

    const child = children[Math.min(offset, children.length - 1)];
    const index = findTextNode(nodes, child, false);
    return index === -1 ? null : { index, offset: 0 };
};

const snapStart = (nodes, point) => {
    let { index, offset } = point;

    for (;;) {
        if (offset > 0) {
            if (!WORD_CHAR.test(nodes[index].data[offset - 1])) return { index, offset };
            offset -= 1;
            continue;
        }
        const previous = index - 1;
        if (previous < 0) return { index, offset };
        const data = nodes[previous].data;
        if (!sameVisualLine(nodes[index], nodes[previous])) return { index, offset };
        if (!WORD_CHAR.test(data[data.length - 1])) return { index, offset };
        index = previous;
        offset = data.length;
    }
};

const snapEnd = (nodes, point) => {
    let { index, offset } = point;

    for (;;) {
        const data = nodes[index].data;
        if (offset < data.length) {
            if (!WORD_CHAR.test(data[offset])) return { index, offset };
            offset += 1;
            continue;
        }
        const next = index + 1;
        if (next >= nodes.length) return { index, offset };
        if (!sameVisualLine(nodes[index], nodes[next])) return { index, offset };
        if (!WORD_CHAR.test(nodes[next].data[0])) return { index, offset };
        index = next;
        offset = 0;
    }
};

// Clamps a selection to the page it started on, then widens partial words out to whole
// words. Already-clean selections (double-click, deliberate word-boundary drags) are
// left untouched because both boundaries already sit next to a non-word character.
const refineRange = (range) => {
    const startRoot = rootFor(range.startContainer);
    if (!startRoot) return null;

    const nodes = textNodesIn(startRoot);
    if (nodes.length === 0) return null;

    const refined = range.cloneRange();
    if (rootFor(range.endContainer) !== startRoot) {
        const last = nodes[nodes.length - 1];
        refined.setEnd(last, last.length);
    }

    const start = toTextPoint(refined.startContainer, refined.startOffset, nodes, false);
    const end = toTextPoint(refined.endContainer, refined.endOffset, nodes, true);
    if (!start || !end) return refined;

    const snappedStart = snapStart(nodes, start);
    const snappedEnd = snapEnd(nodes, end);

    refined.setStart(nodes[snappedStart.index], snappedStart.offset);
    refined.setEnd(nodes[snappedEnd.index], snappedEnd.offset);
    return refined;
};

// Offsets are measured against the nearest context root (a pdf.js text layer, or the
// page-text container in fallback mode) so both render modes share one context path.
// pdf.js emits one text node per rendered line with no trailing space, so line ends
// get a separator — otherwise the context reads "a set of registersThe arithmetic".
const contextFromRange = (range) => {
    const root = rootFor(range.startContainer);
    if (!root) return { contextBefore: '', contextAfter: '' };

    const nodes = textNodesIn(root);
    const start = toTextPoint(range.startContainer, range.startOffset, nodes, false);
    const end = toTextPoint(range.endContainer, range.endOffset, nodes, true);
    if (!start || !end) return { contextBefore: '', contextAfter: '' };

    let full = '';
    let startPos = 0;
    let endPos = 0;

    nodes.forEach((node, index) => {
        if (index > 0 && !sameVisualLine(nodes[index - 1], node)) full += ' ';
        if (index === start.index) startPos = full.length + start.offset;
        if (index === end.index) endPos = full.length + end.offset;
        full += node.data;
    });

    const clean = (value) => value.replace(/\s+/g, ' ');

    return {
        contextBefore: clean(full.slice(Math.max(0, startPos - CONTEXT_CHARS), startPos)),
        contextAfter: clean(full.slice(endPos, endPos + CONTEXT_CHARS))
    };
};

const DocumentReader = ({ document: doc, onSelect }) => {
    const containerRef = useRef(null);
    const pageRefs = useRef([]);
    const detectRequestRef = useRef({ key: null, promise: null });
    const pageTextCacheRef = useRef(new Map());
    const pageRatioRef = useRef(0);
    const touchInputRef = useRef(false);
    const lastTouchTextRef = useRef('');
    const [numPages, setNumPages] = useState(0);
    const [pageWidth, setPageWidth] = useState(0);
    const [pageRatio, setPageRatio] = useState(DEFAULT_PAGE_RATIO);
    const [currentPage, setCurrentPage] = useState(1);
    const [pdfFailed, setPdfFailed] = useState(false);
    const [concepts, setConcepts] = useState([]);
    const [pageText, setPageText] = useState('');
    const [pageTextLoading, setPageTextLoading] = useState(false);
    const [pageTextError, setPageTextError] = useState(null);

    // Object form (not a bare URL string) so pdf.js's own fetch sends the identity
    // cookie the ownership-checked file route now requires.
    const fileSource = useMemo(
        () => ({ url: `${API_BASE_URL}/api/upload/${doc.id}/file`, withCredentials: true }),
        [doc.id]
    );
    const totalPages = numPages || doc.metadata?.pageCount || 0;

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return undefined;

        // contentRect is already the padding-excluded content box, so the available
        // width is used as-is — subtracting the gutter again shrank every page a second
        // time. The floor only exists to keep a degenerate 0-width measurement from
        // collapsing the page, so it sits below any real phone width.
        const observer = new ResizeObserver(([entry]) => {
            setPageWidth(Math.max(240, entry.contentRect.width));
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
                    credentials: 'include',
                    body: JSON.stringify({ documentId: doc.id })
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
    }, [doc.id]);

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

    // Fallback mode has no rendered PDF to scroll, so text is pulled one page at a
    // time and cached — never the whole book, which is what made large files hang.
    useEffect(() => {
        if (!pdfFailed) return undefined;

        const cache = pageTextCacheRef.current;
        if (cache.has(currentPage)) {
            setPageText(cache.get(currentPage));
            setPageTextLoading(false);
            return undefined;
        }

        let cancelled = false;
        setPageTextLoading(true);

        fetch(`${API_BASE_URL}/api/upload/${doc.id}/pages?first=${currentPage}&last=${currentPage}`, {
            credentials: 'include'
        })
            .then(async (res) => {
                const data = await res.json().catch(() => null);
                // A non-2xx status or an explicit success:false both mean the backend
                // failed to extract text — genuinely-empty text is success:true with an
                // empty string. Previously both cases fell through to the same falsy
                // `data?.pages?.[0]?.text || ''` and were indistinguishable in the UI.
                if (!res.ok || !data?.success) {
                    const reason = data?.error || `HTTP ${res.status}`;
                    // documentId/page only — never cookies, tokens, or PDF contents.
                    console.error('[PDF_PAGES_ERROR]', { documentId: doc.id, page: currentPage, reason });
                    throw new Error(reason);
                }
                return data;
            })
            .then((data) => {
                const text = data?.pages?.[0]?.text || '';
                cache.set(currentPage, text);
                if (!cancelled) {
                    setPageText(text);
                    setPageTextError(null);
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    setPageText('');
                    setPageTextError(error.message || 'Failed to load page text.');
                }
            })
            .finally(() => {
                if (!cancelled) setPageTextLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [pdfFailed, currentPage, doc.id]);

    const termRegex = useMemo(() => buildTermRegex(concepts), [concepts]);

    const emitSelection = useCallback(
        (text, contextBefore, contextAfter) => {
            const cleaned = text.replace(/\s+/g, ' ').trim();
            if (!cleaned) return;
            onSelect({ text: cleaned, contextBefore, contextAfter });
        },
        [onSelect]
    );

    const captureSelection = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
        if (!selection.toString().trim()) return;

        const refined = refineRange(selection.getRangeAt(0));
        if (!refined) return;

        // Re-applying the range keeps the on-screen highlight identical to what is
        // sent, and Selection.toString() (unlike Range.toString()) keeps the line
        // breaks between pdf.js spans, so wrapped phrases don't lose their spaces.
        selection.removeAllRanges();
        selection.addRange(refined);

        const { contextBefore, contextAfter } = contextFromRange(refined);
        emitSelection(selection.toString(), contextBefore, contextAfter);
    }, [emitSelection]);

    // Touch input never reliably produces the mouseup that drives the pointer path, so
    // settled selectionchange events are routed through the identical capture helper.
    useEffect(() => {
        let timer = null;

        const settle = () => {
            if (!touchInputRef.current) return;

            const selection = window.getSelection();
            const text = selection && !selection.isCollapsed ? selection.toString().trim() : '';
            if (!text) {
                lastTouchTextRef.current = '';
                return;
            }
            // captureSelection re-applies the refined range, which itself fires
            // selectionchange; without this the same phrase would be emitted twice.
            if (text === lastTouchTextRef.current) return;

            captureSelection();
            lastTouchTextRef.current = (window.getSelection()?.toString() || text).trim();
        };

        const handleSelectionChange = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(settle, SELECTION_SETTLE_MS);
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => {
            if (timer) clearTimeout(timer);
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
    }, [captureSelection]);

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

    const handlePageLoadSuccess = useCallback((page) => {
        if (pageRatioRef.current) return;
        const width = page.originalWidth || page.width;
        const height = page.originalHeight || page.height;
        if (!width || !height) return;
        pageRatioRef.current = height / width;
        setPageRatio(height / width);
    }, []);

    const goToPage = (target) => {
        const clamped = Math.min(Math.max(target, 1), totalPages || 1);
        setCurrentPage(clamped);
        if (pdfFailed) {
            containerRef.current?.scrollTo({ top: 0 });
        } else {
            pageRefs.current[clamped - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const placeholderHeight = Math.round((pageWidth || FALLBACK_PAGE_WIDTH) * pageRatio);

    return (
        <div className="flex flex-col h-full min-h-0 bg-black">
            <div className="flex items-center justify-between gap-3 md:gap-4 px-4 py-3 border-b border-white/10 shrink-0 select-none">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-text-main truncate">
                        {doc.filename || doc.metadata?.title}
                    </p>
                    <p className="text-xs text-text-muted sm:hidden">
                        Drag across any word or phrase to explain it
                    </p>
                    <p className="hidden sm:block text-xs text-text-muted">
                        Select any word or phrase to open ConceptBridge
                    </p>
                </div>

                {totalPages > 0 && (
                    <div className="flex items-center gap-1 md:gap-2 shrink-0 select-none">
                        <button
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage <= 1}
                            className="p-3 md:p-2 rounded-lg border border-white/10 text-text-main hover:border-primary/50 disabled:opacity-30 transition-colors"
                            title="Previous page"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-mono text-text-muted tabular-nums">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                            className="p-3 md:p-2 rounded-lg border border-white/10 text-text-main hover:border-primary/50 disabled:opacity-30 transition-colors"
                            title="Next page"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            <div
                ref={containerRef}
                // pointerType is read rather than pairing touchstart with mousedown: a tap
                // emits a *synthetic* mousedown afterwards, which would wrongly re-classify
                // the following long-press selection as mouse input and skip it.
                onPointerDown={(event) => {
                    touchInputRef.current = event.pointerType !== 'mouse';
                    // A fresh gesture is always allowed to re-emit, so re-selecting the
                    // same phrase after closing the sidebar reopens it. The re-emit guard
                    // only needs to cover the selectionchange that captureSelection itself
                    // triggers, and that never involves a pointerdown.
                    lastTouchTextRef.current = '';
                }}
                onMouseUp={captureSelection}
                onClick={handleClick}
                className="flex-1 min-h-0 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6"
            >
                {pdfFailed ? (
                    <div className="mx-auto max-w-3xl">
                        <div className="flex items-center gap-2 mb-4 text-xs text-text-muted">
                            <AlertCircle className="w-4 h-4 text-primary" />
                            Showing extracted text (the PDF could not be rendered).
                        </div>
                        {pageTextLoading ? (
                            <div className="flex items-center gap-2 py-12 text-sm text-text-muted">
                                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                Loading page {currentPage}...
                            </div>
                        ) : pageText ? (
                            <div
                                data-context-root="true"
                                className="whitespace-pre-wrap leading-relaxed text-text-main text-[15px] selection:bg-primary/40"
                                dangerouslySetInnerHTML={{ __html: markUpTerms(pageText, termRegex) }}
                            />
                        ) : pageTextError ? (
                            <p className="py-12 text-sm text-text-muted">
                                Could not load page {currentPage}: {pageTextError}
                            </p>
                        ) : (
                            <p className="py-12 text-sm text-text-muted">
                                No text could be extracted from page {currentPage}.
                            </p>
                        )}
                    </div>
                ) : (
                    <Document
                        file={fileSource}
                        onLoadSuccess={({ numPages: total }) => setNumPages(total)}
                        onLoadError={(error) => {
                            // documentId only — never cookies, tokens, or PDF contents.
                            console.error('[PDF_RENDER_ERROR]', { documentId: doc.id, reason: error?.message || String(error) });
                            setPdfFailed(true);
                        }}
                        onSourceError={(error) => {
                            console.error('[PDF_RENDER_ERROR]', { documentId: doc.id, reason: error?.message || String(error) });
                            setPdfFailed(true);
                        }}
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
                        {Array.from({ length: numPages }, (_, index) => {
                            const inWindow = Math.abs(index + 1 - currentPage) <= WINDOW_RADIUS;

                            return (
                                <div
                                    key={index}
                                    ref={(el) => {
                                        pageRefs.current[index] = el;
                                    }}
                                    className="border border-white/10 rounded-lg overflow-hidden bg-white"
                                    style={
                                        inWindow
                                            ? undefined
                                            : {
                                                  width: pageWidth || FALLBACK_PAGE_WIDTH,
                                                  height: placeholderHeight
                                              }
                                    }
                                >
                                    {inWindow && (
                                        <Page
                                            pageNumber={index + 1}
                                            width={pageWidth || undefined}
                                            renderTextLayer
                                            renderAnnotationLayer={false}
                                            customTextRenderer={customTextRenderer}
                                            onLoadSuccess={handlePageLoadSuccess}
                                            loading={
                                                <div
                                                    className="flex items-center justify-center bg-black"
                                                    style={{ height: placeholderHeight }}
                                                >
                                                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                                                </div>
                                            }
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </Document>
                )}
            </div>
        </div>
    );
};

export default DocumentReader;
