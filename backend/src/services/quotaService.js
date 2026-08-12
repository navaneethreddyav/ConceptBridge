const documentStore = require('./documentStore');

// 100MB free storage per (anonymous, cookie-identified) owner. See
// middleware/userIdentity.js and DEPLOYMENT.md for what "owner" means here.
const MAX_USER_STORAGE_BYTES = 100 * 1024 * 1024;

const getUsage = (ownerId) => {
    const usedBytes = documentStore.getUsageBytes(ownerId);
    return {
        usedBytes,
        totalBytes: MAX_USER_STORAGE_BYTES,
        remainingBytes: Math.max(0, MAX_USER_STORAGE_BYTES - usedBytes)
    };
};

/**
 * @param {number} incomingBytes - the size multer actually measured from the
 *   uploaded file. Never trust a client-supplied size for this check.
 * @returns {{ok: boolean, usage: object}}
 */
const checkQuota = (ownerId, incomingBytes) => {
    const usage = getUsage(ownerId);
    return { ok: usage.usedBytes + incomingBytes <= MAX_USER_STORAGE_BYTES, usage };
};

module.exports = { MAX_USER_STORAGE_BYTES, getUsage, checkQuota };
