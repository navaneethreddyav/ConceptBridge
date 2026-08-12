import React, { useCallback, useEffect, useState } from 'react';
import { Trash2, FileText, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const formatMB = (bytes) => (bytes / (1024 * 1024)).toFixed(1);

// Non-intrusive usage readout for the landing screen: a one-line summary, a thin
// progress bar, and an optional expandable list for releasing storage by deleting
// PDFs — the only way a user gets storage back, since there's no payment path yet.
const StorageQuota = ({ refreshKey, onOpenDocument }) => {
    const [usage, setUsage] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const load = useCallback(() => {
        fetch(`${API_BASE_URL}/api/upload`, { credentials: 'include' })
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setUsage(data.usage);
                    setDocuments(data.documents || []);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load, refreshKey]);

    const handleDelete = async (id, event) => {
        event.stopPropagation();
        setDeletingId(id);
        try {
            const res = await fetch(`${API_BASE_URL}/api/upload/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                setDocuments((docs) => docs.filter((doc) => doc.id !== id));
                setUsage(data.usage);
            }
        } catch {
            // Leave the list as-is; the delete button remains available to retry.
        } finally {
            setDeletingId(null);
        }
    };

    if (loading || !usage) return null;

    const percent = usage.totalBytes > 0 ? Math.min(100, (usage.usedBytes / usage.totalBytes) * 100) : 0;
    const atLimit = usage.remainingBytes <= 0;
    const nearLimit = !atLimit && percent >= 85;

    return (
        <div className="w-full max-w-xl mx-auto mt-4 text-left">
            <div className="flex items-center justify-between gap-3 text-xs text-text-muted">
                <span>
                    Storage &middot; {formatMB(usage.usedBytes)} MB / {formatMB(usage.totalBytes)} MB used
                </span>
                <span className={atLimit ? 'text-red-400' : 'text-primary'}>
                    {atLimit ? 'Limit reached' : `${formatMB(usage.remainingBytes)} MB left`}
                </span>
            </div>

            <div className="mt-1.5 w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-300 ${
                        atLimit ? 'bg-red-500' : nearLimit ? 'bg-primary/70' : 'bg-primary'
                    }`}
                    style={{ width: `${percent}%` }}
                />
            </div>

            {atLimit && (
                <p className="mt-1.5 text-xs text-red-400">
                    Free storage limit reached. Delete a PDF below to free up space.
                </p>
            )}
            {nearLimit && (
                <p className="mt-1.5 text-xs text-text-muted">
                    You're using {formatMB(usage.usedBytes)} MB of your {formatMB(usage.totalBytes)} MB free storage.
                </p>
            )}

            {documents.length > 0 && (
                <div className="mt-2">
                    <button
                        type="button"
                        onClick={() => setExpanded((value) => !value)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                        {expanded ? 'Hide' : 'Manage'} your PDFs ({documents.length})
                        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {expanded && (
                        <ul className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                            {documents.map((doc) => (
                                <li
                                    key={doc.id}
                                    onClick={() => onOpenDocument?.(doc)}
                                    className="flex items-center justify-between gap-2 border border-white/10 rounded-lg px-3 py-2 hover:border-primary/40 cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                                        <span className="text-xs text-text-main truncate">{doc.filename}</span>
                                        <span className="text-[10px] text-text-muted shrink-0">
                                            {formatMB(doc.sizeBytes)} MB
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(event) => handleDelete(doc.id, event)}
                                        disabled={deletingId === doc.id}
                                        className="p-1.5 rounded-full hover:bg-red-500/10 shrink-0"
                                        title="Delete this PDF"
                                    >
                                        {deletingId === doc.id ? (
                                            <Loader2 className="w-3.5 h-3.5 text-text-muted animate-spin" />
                                        ) : (
                                            <Trash2 className="w-3.5 h-3.5 text-text-muted hover:text-red-400" />
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};

export default StorageQuota;
