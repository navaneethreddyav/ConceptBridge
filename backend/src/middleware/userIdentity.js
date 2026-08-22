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
 *
 * SameSite: production Pages (pages.dev) and Worker (workers.dev) are different
 * registrable domains, i.e. genuinely cross-site — a `Lax` cookie is never attached to
 * a cross-site `fetch()`, only to top-level navigations, so it would never round-trip
 * back to the API and every request would mint a fresh identity. `None` (requires
 * `Secure`, hence HTTPS-only) is needed for it to actually ride along, matching the
 * cross-origin `credentials: true` CORS config in worker.js. Local dev keeps `Lax`
 * because Vite (:5173) and `wrangler dev` (:8787) are same-site (same scheme + host,
 * only the port differs), where `None` isn't needed and isn't available anyway (no
 * HTTPS locally).
 */
const userIdentity = async (c, next) => {
    const existing = parseCookie(c.req.header('Cookie'), COOKIE_NAME);
    const userId = existing && UUID_RE.test(existing) ? existing : crypto.randomUUID();

    c.set('userId', userId);

    if (userId !== existing) {
        const isHttps = new URL(c.req.url).protocol === 'https:';
        const attributes = ['Path=/', 'HttpOnly', `Max-Age=${COOKIE_MAX_AGE_SECONDS}`];
        if (isHttps) attributes.push('SameSite=None', 'Secure');
        else attributes.push('SameSite=Lax');
        c.header('Set-Cookie', `${COOKIE_NAME}=${userId}; ${attributes.join('; ')}`, { append: true });
    }

    await next();
};

export { userIdentity, COOKIE_NAME };
