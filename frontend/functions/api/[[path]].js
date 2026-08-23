// Same-origin proxy for every /api/* request on the Pages origin
// (conceptbridge-cbv.pages.dev) to the existing, unmodified conceptbridge-api Worker,
// via the service binding declared in wrangler.jsonc.
//
// Why this exists: the anonymous cb_uid identity cookie (backend/src/middleware/
// userIdentity.js) is what all ownership/quota checks key off. Cloudflare Pages
// (pages.dev) and Workers (workers.dev) are different registrable domains, so calling
// the Worker directly from the browser makes that cookie genuinely cross-site — Safari/
// WebKit's Intelligent Tracking Prevention silently refuses to persist a cookie set
// under those conditions (confirmed by direct reproduction: the Set-Cookie header
// arrives, but WebKit's cookie jar stays empty), so every request after the first looks
// like a brand-new anonymous user. Proxying through this same-origin route means the
// browser only ever talks to conceptbridge-cbv.pages.dev — the cookie becomes an
// ordinary first-party cookie, which every browser (including Safari) persists
// normally. See userIdentity.js for the matching SameSite=Lax change.
//
// `context.request` is forwarded to the bound Worker completely unmodified — method,
// headers (Cookie included), body, and query string all pass through as-is, and
// whatever Response the Worker returns (status, headers, Set-Cookie, body) is returned
// unmodified in turn. This is a direct binding call, not a fetch() over the public
// internet, so there's no extra network hop, no re-upload of request bodies, and no
// double round-trip for large PDF uploads.
export async function onRequest(context) {
    return context.env.API.fetch(context.request);
}
