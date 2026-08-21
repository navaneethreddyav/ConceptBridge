-- ConceptBridge D1 schema — stage 1 of the Render -> Cloudflare Workers migration.
--
-- Replaces the in-memory `documentStore.js` Maps (documents / buffers / sampleTexts /
-- owners) with a single durable `documents` table. Raw PDF bytes live in R2 (bucket
-- `conceptbridge-pdfs`, keyed by document id), NOT in this table.
--
-- Column notes:
--   id           - content-hash derived document id ("doc_<hash16>"), see
--                   documentService.js. Primary key, also the R2 object key.
--   owner_id     - the anonymous cb_uid cookie value. NEVER serialized into an API
--                   response (mirrors the old in-memory `owners` Map being kept out of
--                   the `documents` Map on purpose). Ownership checks are 404-not-403.
--   content_hash - the raw hash portion of `id` (id minus the "doc_" prefix), stored
--                   separately for future lookups/debugging without string-parsing id.
--   sample_text  - the bounded (first ~20 pages) extracted text used for auto concept
--                   detection and as an explanation-context safety net. Never returned
--                   in list/upload responses, same as the old in-memory sampleTexts map.
--   concepts     - JSON-encoded array, populated lazily by POST /api/concepts/detect
--                   (stage 2). NULL until first detection for a document.
--   deleted      - soft-delete flag. A deleted row is kept (not removed) so a stale id
--                   reliably 404s instead of ever being reused/resurrected.
CREATE TABLE IF NOT EXISTS documents (
    id           TEXT PRIMARY KEY,
    owner_id     TEXT NOT NULL,
    filename     TEXT NOT NULL,
    size_bytes   INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    sample_text  TEXT,
    page_count   INTEGER,
    title        TEXT,
    author       TEXT,
    concepts     TEXT,
    created_at   TEXT NOT NULL,
    deleted      INTEGER NOT NULL DEFAULT 0
);

-- Quota (SUM(size_bytes) WHERE owner_id = ? AND deleted = 0) and list-my-documents are
-- both owner-scoped hot paths; content_hash lookups back the dedup check in the upload
-- handler (same owner + same content -> same row, no re-parse).
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id, deleted);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);
