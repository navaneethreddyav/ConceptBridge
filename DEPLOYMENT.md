# Deploying ConceptBridge

ConceptBridge now runs as **one deployable service**: the Express backend serves the built Vite frontend directly (static files + SPA fallback), and the frontend calls the API via relative paths (`/api/...`) on that same origin. One URL, one Render Web Service, no CORS to configure between them.

Splitting frontend and backend into two separately-hosted services is still possible (see "Split deployment" at the bottom) but is no longer the recommended path — it's just supported for flexibility.

There is no database, no queue, and no container requirement. The document store is in-memory, so **uploaded documents do not survive a backend restart or redeploy**, and the service does not scale horizontally without sticky routing / a shared store. That is by design for the current scope.

---

## READ THIS FIRST: this deployment runs on the Gemini free tier, by design

**This is a deliberate constraint, not an oversight.** The API key stays on the Gemini free tier — each model caps at roughly 20 requests/day — and no paid billing is enabled. The app is optimized to make a demo reliable *within* that limit rather than to work around the limit with a bigger quota. Three mitigations are built in:

1. **Documents are deduplicated by content, not upload.** `documentService.js` derives a document's ID from a hash of its extracted text, and `uploadController.js` reuses the existing cached record (concepts included) when the same content is uploaded again — e.g. after a page reload wipes client state and the user re-selects the same file. No re-analysis, no extra Gemini calls.
2. **Concept detection and explanations are cached in-memory** (`documentStore`, `explanationService`), the latter keyed by normalized term + context + language, and — because document IDs are content-derived — that cache also hits across re-uploads of the same PDF, not just within one session.
3. **A free-tier model waterfall.** `modelManager.js` holds an ordered list of free-tier-eligible models; `geminiService.js` walks to the next one only when the current model's *daily* quota is exhausted (a short-lived 429 still just retries the same model with backoff). See `GEMINI_MODEL_CANDIDATES` below. This never selects a paid model and never touches billing — it only spreads load across free-tier models that already exist on the key.

None of this makes the free tier unlimited. A demo that opens many *different* documents, or has many people selecting *different* terms in quick succession, can still exhaust every candidate model's daily quota — at which point the app degrades gracefully (a clear "AI service is temporarily busy" message, never a crash) rather than failing silently. If that happens, the fix within these constraints is simply to wait for the daily reset, not to enable billing.

**On Render specifically:** every redeploy and every spin-down-then-wake (free/low tiers sleep after inactivity) restarts the Node process, which wipes the in-memory document/concept/explanation cache described above. The first upload/selection after a cold start will genuinely hit Gemini again even for content analyzed before the restart — this is expected, not a regression.

YouTube Data API v3 also has a daily quota (10,000 units/day default; each search costs ~100 units). Video results are cached by normalized term for the same reason, with the same cache-survives-restarts caveat.

---

## Render deployment (single Web Service) — recommended

**Service type:** Web Service (Node)

**Root Directory:** `backend`

**Build Command:**
```
npm ci && cd ../frontend && npm ci && npm run build
```
This installs backend dependencies, then builds the frontend into `frontend/dist`. The backend serves that folder — it locates it via `__dirname` (`backend/src/server.js` → `../../frontend/dist`), so this works regardless of Render's working-directory quirks; you don't need to move or copy anything after the build.

**Start Command:**
```
npm start
```
(Root Directory is `backend`, so this runs `node src/server.js` from there — unaffected by `NODE_ENV`; Render sets that automatically.)

**Environment variables** (Render dashboard → Environment, not committed anywhere):

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Server-side only. Never exposed to the frontend. |
| `YOUTUBE_API_KEY` | Yes | Server-side only. Never exposed to the frontend. |
| `PORT` | No | **Do not set this on Render** — Render injects it automatically and the server already reads `process.env.PORT`. Setting it yourself can conflict with Render's own assignment. |
| `GEMINI_MODEL` | No | Tried first, before the fallback waterfall. Defaults to `gemini-3.6-flash` if unset. |
| `GEMINI_MODEL_CANDIDATES` | No | Comma-separated free-tier fallback list, tried in order as each prior model's daily quota is exhausted. Defaults to a built-in list (`gemini-3.5-flash-lite, gemini-3.1-flash-lite, gemini-3-flash-preview, gemini-3.6-flash`). Google can rename/retire free-tier models over time — update this if the default list goes stale. Never put a paid-only model here. |
| `NODE_ENV` | No | Render sets this to `production` automatically for Web Services. Suppresses stack-trace logging and strips error details from API responses. |
| `VITE_API_BASE_URL` | No | **Leave unset for the single-service setup.** The frontend build defaults to relative paths (`/api/...`), which correctly target this same service. Only set this if you're doing a split deployment (see below) where the frontend is built separately from a different backend origin. |
| `OLLAMA_URL` / `OLLAMA_MODEL` | No | Local development fallback only. Not needed on Render. |

No `PORT` handling to configure beyond what's already in the code: `server.js` reads `process.env.PORT` and listens on `0.0.0.0`, which is exactly what Render expects.

**That's the whole configuration.** No separate static site, no CORS setup, no proxy/rewrite rules — Render gives you one URL and that's what you hand your professor.

---

## What could break after deploying

- **Cold starts wipe the cache** (see above) — the very first request after a period of inactivity or a fresh deploy will be slower and will genuinely call Gemini/YouTube again, even for a document tested minutes before the deploy.
- **Render's free/low tiers spin down on idle** and take some seconds to wake on the next request — the first load after idle may hang briefly before the health check responds. Not a bug, just cold-start latency.
- **Gemini's free-tier daily cap is shared across everyone who uses the deployed URL**, not per-visitor. If several people try the demo in quick succession on different documents/terms, the cache/waterfall mitigations reduce but don't eliminate the chance of hitting "AI service is temporarily busy" — see the quota section above.
- **The PDF worker asset is ~1MB** (`pdf.worker.min.mjs`, bundled by Vite) — first load will be a bit slower on a cold Render instance or a slow connection; this is pre-existing, not something this deployment change introduced.
- **In-memory store means no horizontal scaling** — if you ever bump the Render service to run multiple instances, uploads/concepts/explanations cached on one instance won't be visible from another. Fine at one instance (Render's default), a real problem beyond that.

---

## Post-deploy verification checklist

1. `GET https://<your-service>.onrender.com/api/health` returns `{"status":"ok",...}`.
2. Load `https://<your-service>.onrender.com/` — the app itself, not a JSON response.
3. Open browser dev tools → Network tab — confirm API calls go to `/api/...` on the *same* origin, never `localhost`.
4. Upload a PDF — reader renders it with selectable text.
5. Select a phrase — sidebar returns simple meaning, SVG visual, and explanation.
6. Switch language (verify at least one of Hindi/Telugu/Tamil/Gujarati/Marathi/Bengali) — explanation regenerates in that language.
7. Short and long videos load, including their thumbnails (a cross-origin image load — confirms the CSP `img-src` adjustment in `server.js` is working; if thumbnails are broken but everything else works, check the browser console for a CSP violation first).
8. Branding assets (header logo, hero logo, footer logos/attribution) render correctly.
9. Grep the deployed bundle for `GEMINI_API_KEY`, `YOUTUBE_API_KEY`, and `AIza` — all must be absent. (`curl https://<your-service>.onrender.com/assets/*.js | grep -c AIza` should print `0`.)

Steps 4-8 all consume Gemini and YouTube quota. Re-running the checklist against the *same* PDF and term costs nothing extra past the first pass — the caching described above serves repeats for free, cold starts aside. Use a fresh PDF and a fresh term if you specifically want to exercise a live Gemini call.

---

## Split deployment (backend + frontend as two separate services)

Only needed if you have a specific reason to host them separately (e.g. a static host you're already paying for). The code supports it, but it reintroduces CORS and an extra URL to manage — the single-service setup above is simpler and is what's actually been verified end-to-end.

### Backend

Same as above, but as its own service — `Root Directory: backend`, `Build Command: npm ci`, `Start Command: npm start`, same environment variables. Its `express.static`/SPA-fallback middleware will simply find no `frontend/dist` next to it and no-op; the API routes are unaffected either way.

### Frontend

Build separately, pointing at the backend's URL:

```bash
cd frontend
npm ci
VITE_API_BASE_URL=https://your-backend-host.onrender.com npm run build
# serve the resulting dist/ directory as static files, e.g. Render's Static Site type
```

**`VITE_API_BASE_URL` is inlined at build time, not read at runtime** — set it before `npm run build`, and rebuild whenever it changes. Only `VITE_`-prefixed variables reach the bundle — never put an API key in a `VITE_` variable.

Because it's a client-side SPA, configure the static host to **fall back to `/index.html` for unknown paths**.

### CORS

`backend/src/server.js` uses `app.use(cors())` — all origins allowed. This matters for a split deployment (the frontend origin differs from the API origin); for the single-service setup above it's irrelevant since everything is same-origin. Acceptable either way: there is no authentication, no cookies, and no user data; the API keys never leave the server.

The real risk of the open CORS policy is **quota theft**, not data exposure: anyone who discovers the backend URL can burn your Gemini/YouTube quota directly (CORS only stops *browser* requests from other websites, not a direct scripted request). Restricting CORS to a known frontend origin is worth doing if that becomes a real concern, paired with rate limiting — CORS alone doesn't fully solve it.
