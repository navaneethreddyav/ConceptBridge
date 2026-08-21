// 100MB free storage per (anonymous, cookie-identified) owner. See
// middleware/userIdentity.js and DEPLOYMENT.md for what "owner" means here.
//
// Usage is now derived directly from D1 with a SUM query rather than reading the old
// in-memory documentStore Map — this is a strict improvement over the Render/in-memory
// behavior (quota used to reset on every restart; a D1-backed sum survives them).
const MAX_USER_STORAGE_BYTES = 100 * 1024 * 1024;

const getUsage = async (env, ownerId) => {
    const row = await env.DB.prepare(
        'SELECT SUM(size_bytes) as total FROM documents WHERE owner_id = ? AND deleted = 0'
    ).bind(ownerId).first();
    const usedBytes = row?.total || 0;
    return {
        usedBytes,
        totalBytes: MAX_USER_STORAGE_BYTES,
        remainingBytes: Math.max(0, MAX_USER_STORAGE_BYTES - usedBytes)
    };
};

/**
 * @param {number} incomingBytes - the size Hono's parseBody actually measured from the
 *   uploaded file (Web File.size). Never trust a client-supplied size for this check.
 * @returns {Promise<{ok: boolean, usage: object}>}
 */
const checkQuota = async (env, ownerId, incomingBytes) => {
    const usage = await getUsage(env, ownerId);
    return { ok: usage.usedBytes + incomingBytes <= MAX_USER_STORAGE_BYTES, usage };
};

export { MAX_USER_STORAGE_BYTES, getUsage, checkQuota };
