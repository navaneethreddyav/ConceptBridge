// D1 (metadata) + R2 (raw PDF bytes) backed document store, replacing the old
// module-level in-memory Maps. Every function takes `env` (the Worker's per-request
// bindings) as its first argument rather than closing over a module-level singleton —
// Workers env bindings only exist for the lifetime of a single fetch() call, so there is
// no safe module-level place to cache `env.DB` / `env.PDF_BUCKET` across requests.
//
// Owner id is intentionally never included in the object returned by `rowToDocument` —
// mirrors the old in-memory store's `owners` Map being kept separate from `documents`
// so it can never round-trip into an API response. `getOwner` is the only function that
// exposes it, and only to server-side ownership checks (404-not-403).

const rowToDocument = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        filename: row.filename,
        sizeBytes: row.size_bytes,
        metadata: {
            pageCount: row.page_count,
            title: row.title,
            author: row.author,
            createdAt: row.created_at
        },
        ...(row.concepts ? { concepts: JSON.parse(row.concepts) } : {})
    };
};

/**
 * @returns {Promise<Object|null>} the document, or null if missing/soft-deleted.
 */
const getDocument = async (env, id) => {
    const row = await env.DB.prepare('SELECT * FROM documents WHERE id = ?').bind(id).first();
    if (!row || row.deleted) return null;
    return rowToDocument(row);
};

/**
 * Owner id for a document, regardless of its deleted state (matches the old Map's
 * `owners.get(id)`, which also never forgot an owner on delete) — callers combine this
 * with a `getDocument`/`getBuffer` null-check to get "not found" semantics for deleted docs.
 * @returns {Promise<string|null>}
 */
const getOwner = async (env, id) => {
    const row = await env.DB.prepare('SELECT owner_id FROM documents WHERE id = ?').bind(id).first();
    return row ? row.owner_id : null;
};

/**
 * Inserts a new document row, or "resurrects" one that previously existed under the
 * same content-hash id and was soft-deleted — an UPSERT, not a plain INSERT. Content-hash
 * ids are stable, so deleting a document and then re-uploading byte-identical content
 * lands on the same primary key; the old in-memory `Map.set(id, document)` this replaces
 * had the same effect (an unconditional overwrite, silently un-deleting the row with
 * fresh metadata), so this preserves that exact behavior instead of erroring on the
 * still-present (deleted=1) row's PRIMARY KEY. `document.id` is the content-hash-derived
 * id computed by documentService.js; `content_hash` stores that same hash without the
 * "doc_" prefix.
 */
const saveDocument = async (env, document, ownerId) => {
    const contentHash = document.id.startsWith('doc_') ? document.id.slice(4) : document.id;
    await env.DB.prepare(
        `INSERT INTO documents
            (id, owner_id, filename, size_bytes, content_hash, sample_text, page_count, title, author, concepts, created_at, deleted)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, ?, 0)
         ON CONFLICT(id) DO UPDATE SET
            owner_id = excluded.owner_id,
            filename = excluded.filename,
            size_bytes = excluded.size_bytes,
            content_hash = excluded.content_hash,
            sample_text = NULL,
            page_count = excluded.page_count,
            title = excluded.title,
            author = excluded.author,
            concepts = NULL,
            created_at = excluded.created_at,
            deleted = 0`
    ).bind(
        document.id,
        ownerId,
        document.filename,
        document.sizeBytes,
        contentHash,
        document.metadata?.pageCount ?? null,
        document.metadata?.title ?? null,
        document.metadata?.author ?? null,
        document.metadata?.createdAt ?? new Date().toISOString()
    ).run();
};

/**
 * Re-upload of already-known content under a (possibly) new filename. Kept separate
 * from saveDocument so the dedup path in uploadController doesn't need a full re-insert.
 */
const updateFilename = async (env, id, filename) => {
    await env.DB.prepare('UPDATE documents SET filename = ? WHERE id = ?').bind(filename, id).run();
};

const saveSampleText = async (env, id, text) => {
    await env.DB.prepare('UPDATE documents SET sample_text = ? WHERE id = ?').bind(text, id).run();
};

/**
 * @returns {Promise<string|null>} the bounded upload-time sample text, or null if the
 *   document is missing/soft-deleted/has none yet.
 */
const getSampleText = async (env, id) => {
    const row = await env.DB.prepare('SELECT sample_text, deleted FROM documents WHERE id = ?').bind(id).first();
    if (!row || row.deleted) return null;
    return row.sample_text || null;
};

const updateConcepts = async (env, id, concepts) => {
    await env.DB.prepare('UPDATE documents SET concepts = ? WHERE id = ?').bind(JSON.stringify(concepts), id).run();
};

/**
 * @returns {Promise<Object[]>} the owner's non-deleted documents, newest first.
 */
const listDocuments = async (env, ownerId) => {
    const { results } = await env.DB.prepare(
        'SELECT * FROM documents WHERE owner_id = ? AND deleted = 0 ORDER BY created_at DESC'
    ).bind(ownerId).all();
    return (results || []).map(rowToDocument);
};

/**
 * Soft-deletes a document (only if the requester owns it) and frees its R2 bytes.
 * @returns {Promise<boolean>} whether a document was actually deleted.
 */
const deleteDocument = async (env, id, ownerId) => {
    const row = await env.DB.prepare('SELECT owner_id, deleted FROM documents WHERE id = ?').bind(id).first();
    if (!row || row.deleted || row.owner_id !== ownerId) return false;

    await env.DB.prepare('UPDATE documents SET deleted = 1 WHERE id = ?').bind(id).run();
    await env.PDF_BUCKET.delete(id).catch(() => {});
    return true;
};

/**
 * @param {ArrayBuffer|Uint8Array} bytes
 */
const saveBuffer = async (env, id, bytes) => {
    await env.PDF_BUCKET.put(id, bytes);
};

/**
 * @returns {Promise<Uint8Array|null>} the raw PDF bytes, or null if not found. Always
 *   a Uint8Array (not a bare ArrayBuffer) so pdfService's `Uint8Array.from(buffer)`
 *   (which needs an array-like/iterable, not a plain ArrayBuffer) keeps working unchanged.
 */
const getBuffer = async (env, id) => {
    const obj = await env.PDF_BUCKET.get(id);
    if (!obj) return null;
    return new Uint8Array(await obj.arrayBuffer());
};

export {
    getDocument,
    getOwner,
    saveDocument,
    updateFilename,
    saveSampleText,
    getSampleText,
    updateConcepts,
    listDocuments,
    deleteDocument,
    saveBuffer,
    getBuffer
};
