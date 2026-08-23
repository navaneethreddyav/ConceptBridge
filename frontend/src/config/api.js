// Single source of truth for the backend base URL.
// Production deliberately leaves VITE_API_BASE_URL unset so this resolves to '' —
// relative paths, same-origin against Cloudflare Pages. frontend/functions/api/
// [[path]].js proxies /api/* to the conceptbridge-api Worker over a service binding
// (see frontend/wrangler.jsonc), so the browser never talks to the Worker's own
// workers.dev URL directly. This is what keeps the cb_uid identity cookie same-site —
// see userIdentity.js for why that matters (Safari/WebKit doesn't persist a genuinely
// cross-site cookie even with SameSite=None; Secure set). In dev (`vite dev`), falls
// back to `wrangler dev`'s default local port instead, since there's no Pages Function
// proxy running locally — Vite (:5173) and `wrangler dev` (:8787) are already same-site
// (same scheme + host, only the port differs), so no proxy is needed there.
export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8787' : '');
