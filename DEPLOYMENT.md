# Deploying ConceptBridge

ConceptBridge now runs as **one deployable service**: the Express backend serves the built Vite frontend directly (static files + SPA fallback), and the frontend calls the API via relative paths (`/api/...`) on that same origin. One URL, one Render Web Service, no CORS to configure between them.

Splitting frontend and backend into two separately-hosted services is still possible (see "Split deployment" at the bottom) but is no longer the recommended path — it's just supported for flexibility.

There is no database, no queue, and no container requirement. The document store is in-memory, so **uploaded documents do not survive a backend restart or redeploy**, and the service does not scale horizontally without sticky routing / a shared store. That is by design for the current scope.

---

## Per-user storage quotas

Each identified user gets **100MB of free PDF storage**, tracked as cumulative bytes across all their uploaded documents (not a per-file allowance, not a document count). Uploads are accepted as long as `current usage + new file size <= 100MB`; the request is rejected *before* the PDF is parsed if it isn't.

**How users are identified — read this carefully.** There is no login, no password, no account. The backend issues an anonymous, random UUID (`crypto.randomUUID()`) on first contact and stores it in an `httpOnly` cookie (`cb_uid`, `backend/src/middleware/userIdentity.js`). Every request after that carries the cookie, and the quota/ownership system keys off it. This is **identity, not authentication**:
- It identifies a browser profile, not a verified person.
- Clearing cookies, using a different browser, or private/incognito mode all produce a brand-new identity with a fresh 100MB quota — there is no way to prevent this without real accounts, which are explicitly out of scope (see `CLAUDE.md`).
- It's `httpOnly` specifically so page JavaScript can't read or forge it — the one concrete bypass this system defends against is "edit a value in the frontend to get more storage." A user resetting their own quota by clearing cookies is an accepted limitation of a no-signup free tier, not a security hole (they're only ever affecting their own storage).
- CORS is `{ origin: true, credentials: true }` (dynamic origin reflection) so the cookie survives the local dev split between the Vite server and the API. In production, frontend and backend share one origin, so this is effectively same-origin regardless.

**Per-file limit: 50MB**, unchanged from before this feature and enforced independently of the 100MB total (`backend/src/services/fileValidationService.js`, `MAX_FILE_SIZE`). It was already sized for large engineering textbooks (verified against real 500+ page fixtures) and comfortably fits multiple files under the 100MB umbrella — a single file can never exceed half the total quota, so it was kept rather than replaced.

**Storage accounting** lives in the same in-memory `documentStore` used for everything else (`backend/src/services/documentStore.js`) — no second tracking system, no re-parsing PDFs to compute size. Each stored document records its owner (kept in a separate `owners` map, never serialized into API responses) and its exact `sizeBytes`, taken directly from Multer's measured upload size. `quotaService.js` sums `sizeBytes` across an owner's non-deleted documents to get current usage; nothing here estimates or recomputes from page count or PDF content.

**Deleting a PDF releases its storage immediately.** `DELETE /api/upload/:id` (only the owner can call it successfully — others get a 404, not a 403, so the id's existence isn't revealed) soft-deletes the record and frees its buffer/sample-text memory. The freed bytes are available for the next upload right away; there's no async cleanup delay.

**Ownership is enforced on every document-scoped operation**, not just upload: fetching the PDF file, fetching on-demand page text, concept detection, and explanation generation all check that the requesting cookie's identity owns the `documentId` before doing anything, returning 404 on mismatch. Content-hash document IDs are also owner-scoped (`sha256(ownerId + ':' + text)`) so two different users uploading byte-identical content never collide onto the same record — each gets their own, and quota is charged to the right owner.

**Persistence — the honest version.** Quota usage is derived entirely from the in-memory `documentStore`, which — as stated in the section above and reiterated here so it isn't missed — **does not survive a backend restart, redeploy, or Render free-tier spin-down**. A user's 100MB quota is not a persistent, durable allowance across the service's lifetime; it resets to 0/100MB whenever the process restarts, exactly like every other piece of state this app keeps. No database or paid persistent storage was added to fix this, per the explicit constraint to keep the app free-first and not silently introduce paid infrastructure. If durable per-user storage becomes a real requirement later, it needs a real datastore (and, more fundamentally, real authentication — an anonymous cookie is not durable/portable enough to be worth persisting against) — that's future work, not something this feature claims to already provide.

**Quota-exceeded behavior:** the upload is rejected with HTTP 507 and the message *"Your free storage limit of 100 MB has been reached. Delete existing PDFs or upgrade your storage."* No payment processing, no upgrade flow, and no fake "Upgrade" button exist yet — the message only mentions the possibility for future context. The free tier remains fully usable without payment.

The frontend shows a non-intrusive usage readout (`frontend/src/components/StorageQuota.jsx`) near the upload dropzone — current usage, a thin progress bar, a warning past 85% used, and an expandable list of the user's own PDFs with a delete button per row. It is display-only; the server-side check in `uploadController.js` is what actually enforces the limit, so there is no way to bypass the quota by editing frontend code.

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
- **Storage quotas reset on the same restarts/redeploys/cold-starts described above** — a user's 100MB usage figure resets to 0 along with everything else in the in-memory store. See "Per-user storage quotas" for the full disclosure.

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
10. Storage indicator on the landing page shows `0 MB / 100 MB` on first visit, updates after each upload, and a deleted PDF's storage is released — confirms the `cb_uid` cookie round-trips correctly for that origin. If it doesn't update, check the browser's Application/Storage tab for a blocked `cb_uid` cookie first (third-party cookie blocking is the most likely cause on a split deployment).

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

`backend/src/server.js` uses `app.use(cors({ origin: true, credentials: true }))` — the requesting origin is reflected dynamically (required for the `cb_uid` identity cookie described above to ride along on requests), effectively allowing any origin. This matters for a split deployment (the frontend origin differs from the API origin); for the single-service setup above it's irrelevant since everything is same-origin.

Two things to weigh here, now that the identity cookie exists: since it's `httpOnly` and per-owner, another site cannot read or forge it to access someone else's documents — cross-user data exposure is not the risk. What this open policy *does* allow is a form of CSRF limited to self-harm: a malicious page could trigger a request that rides the visitor's own cookie (e.g. an unwanted delete of their own PDF, or consuming their own quota) — annoying, but it cannot read another user's data, leak API keys, or affect anyone but the visitor themselves. Also unchanged from before: anyone who discovers the backend URL can still burn your Gemini/YouTube quota directly (CORS only stops *browser* requests from other origins, not a direct scripted request). Restricting CORS to a known frontend origin removes both risks and is worth doing if either becomes a real concern, paired with rate limiting.
