const crypto = require('crypto');

const COOKIE_NAME = 'cb_uid';
const COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseCookie = (header, name) => {
    if (!header) return null;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
    }
    return null;
};

/**
 * Assigns every request an anonymous, server-issued identity via an httpOnly cookie.
 *
 * This is NOT authentication — there is no login, no password, no verified identity.
 * It identifies a browser, not a person. Clearing cookies, using a different browser,
 * or private/incognito mode all produce a fresh identity and a fresh 100MB quota.
 * See DEPLOYMENT.md for the full disclosure. It is httpOnly specifically so frontend
 * JavaScript cannot read or forge it.
 */
const userIdentity = (req, res, next) => {
    const existing = parseCookie(req.headers.cookie, COOKIE_NAME);
    const userId = existing && UUID_RE.test(existing) ? existing : crypto.randomUUID();

    req.userId = userId;

    if (userId !== existing) {
        res.cookie(COOKIE_NAME, userId, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: COOKIE_MAX_AGE_MS
        });
    }

    next();
};

module.exports = { userIdentity, COOKIE_NAME };
