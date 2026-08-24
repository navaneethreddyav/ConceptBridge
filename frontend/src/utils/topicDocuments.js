// Client-side (per-browser) convenience tag linking an uploaded document to the
// subject/topic it was added from. Document storage/ownership itself is entirely
// server-side (see backend/src/services/documentStore.js, scoped to the anonymous
// cb_uid identity) — this is only a local index so a topic's "Study Material" section
// can re-list documents the learner previously added there, without any backend schema
// change. It never affects quota, ownership, or the document's availability elsewhere
// (e.g. it still opens fine from a future "your documents" view with no topic tag).
const STORAGE_KEY = 'cb_topic_documents_v1';

const readAll = () => {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        // Private browsing, storage disabled, or corrupted JSON — treat as empty
        // rather than ever throwing out of a UI interaction.
        return {};
    }
};

const writeAll = (map) => {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        // Best-effort only — a failed write just means the tag won't survive reload.
    }
};

/**
 * @param {string} documentId
 * @param {string} subjectId
 * @param {string} unitId
 * @param {string} topicId
 */
const tagDocumentForTopic = (documentId, subjectId, unitId, topicId) => {
    if (!documentId || !subjectId || !unitId || !topicId) return;
    const all = readAll();
    all[documentId] = { subjectId, unitId, topicId, taggedAt: Date.now() };
    writeAll(all);
};

/**
 * @param {string} subjectId
 * @param {string} unitId
 * @param {string} topicId
 * @returns {string[]} documentIds tagged for this exact topic
 */
const getDocumentIdsForTopic = (subjectId, unitId, topicId) => {
    const all = readAll();
    return Object.entries(all)
        .filter(([, tag]) => tag.subjectId === subjectId && tag.unitId === unitId && tag.topicId === topicId)
        .map(([documentId]) => documentId);
};

export { tagDocumentForTopic, getDocumentIdsForTopic };
