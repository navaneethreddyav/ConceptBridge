const COOKIE_NAME = 'cb_uid';
const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 1 year (Set-Cookie Max-Age is seconds)
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
 *
 * Hono port notes: `crypto.randomUUID()` needs no change — it was already the Workers
 * global, not Node's `crypto` module. `secure` is derived from the actual request
 * protocol (Workers is always HTTPS in production; `wrangler dev` serves plain HTTP
 * locally) rather than an env flag, since the protocol is always known per-request.
 */
const userIdentity = async (c, next) => {
    const existing = parseCookie(c.req.header('Cookie'), COOKIE_NAME);
    const userId = existing && UUID_RE.test(existing) ? existing : crypto.randomUUID();

    c.set('userId', userId);

    if (userId !== existing) {
        const isHttps = new URL(c.req.url).protocol === 'https:';
        const attributes = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${COOKIE_MAX_AGE_SECONDS}`];
        if (isHttps) attributes.push('Secure');
        c.header('Set-Cookie', `${COOKIE_NAME}=${userId}; ${attributes.join('; ')}`, { append: true });
    }

    await next();
};

export { userIdentity, COOKIE_NAME };
