# ConceptBridge — Production Architecture Audit (Render → Cloudflare)

Read-only audit performed before any migration code was written. All claims below are cited to `file:line` in the working tree as of this audit. Purpose: establish exactly what exists today, what is and isn't Cloudflare Workers-compatible, and what the migration target architecture is.

## 1. Current architecture (as-is)

Single deployable Express service (`backend/src/server.js`), no root-level build orchestration (no root `package.json`):

- `backend` — Express 5 + Node, `app.listen(PORT, '0.0.0.0')` (`server.js:86`).
- `frontend` — React 19 + Vite, built to `frontend/dist`, served **by the backend** via `express.static` + a regex SPA fallback (`server.js:58-70`).
- No database. All state — uploaded PDF bytes, parsed sample text, document metadata, per-user storage quota, video/explanation caches — lives in module-level in-memory `Map`s (`documentStore.js`, `videoService.js:48`, `explanationService.js:13`). This was an **explicit, documented design constraint** ("no database... to keep the app free-first and not silently introduce paid infrastructure," `DEPLOYMENT.md:29`), not an oversight.
- Deployed today on Render as one Web Service; Render auto-injects `PORT` and redeploys on push (`DEPLOYMENT.md:54-88`). No `render.yaml` — configured via the Render dashboard.
- User identity is an anonymous `httpOnly` cookie (`cb_uid`, `crypto.randomUUID()`), not a login (`userIdentity.js`, `DEPLOYMENT.md:15-19`). Quota/ownership key off this cookie.

## 2. API surface (complete)

| Method + path | Controller | Notes |
|---|---|---|
| `GET /api/health` | inline in `server.js:44` | `{status:"ok", message:"..."}` |
| `GET /api/upload` | `listDocuments` | list caller's documents |
| `GET /api/upload/usage` | `getUsage` | quota usage readout |
| `POST /api/upload` | `handleUpload` | multer `.single('pdf')`, memory storage |
| `GET /api/upload/:id/file` | `getDocumentFile` | re-serves PDF bytes from memory |
| `GET /api/upload/:id/pages` | `getDocumentPages` | bounded on-demand page-range parse |
| `DELETE /api/upload/:id` | `deleteDocument` | soft delete, frees quota |
| `POST /api/ai/test` | `handleTestPrompt` | diagnostic passthrough to AI provider |
| `POST /api/concepts/detect` | `detectConcepts` | terminology + Gemini concept detection |
| `POST /api/explanation` | `generateExplanation` | Gemini explanation generation |
| `POST /api/media` | `getMedia` | YouTube short/long video lookup |

## 3. What already survives migration untouched

These required no rework — pure request-scoped logic, no filesystem, no Node-only APIs:

- **PDF parsing** (`pdfService.js`) — buffer-in/JSON-out via `pdf-parse`'s pdf.js-based `PDFParse`, no `fs`. One open item: pdf.js's internal worker-transfer mechanism needed an actual run-under-Workers test, not just static reading (see §5).
- **Visual/SVG generation** (`visualService.js`) — pure string templating, zero dependencies.
- **Terminology matching** (`terminologyMatcher.js`) — regex match over a statically-imported JSON dataset (`shared/terminologyDataset.json`), no runtime filesystem read.
- **Prompt/language system** (`promptService.js`, `shared/supportedLanguages.json`) — plain JSON, one prompt template with language substituted as a string parameter, no per-language branching code path.
- **Fields validation** (`fileValidationService.js`) — mimetype/extension/size checks only, no filesystem dependency.
- **Frontend dev/prod API base URL** (`frontend/src/config/api.js`) — already resolves via `VITE_API_BASE_URL` with a dev-only `localhost` fallback; production build never bakes in a localhost URL. No frontend code change was needed for this part of the migration.
- **TTS** — 100% frontend (`VoicePlayer.jsx`, browser `SpeechSynthesis`), zero backend involvement.

Full repo grep for `localhost`/`127.0.0.1`/`:5173`/`:3000`/`:3001` found exactly one **unguarded** production-reachable hit: the Ollama dev-fallback default in `modelManager.js:17`, which is intentionally dev-only per `CLAUDE.md` and only used if `OLLAMA_URL` is unset. Every other hit is either the gated frontend dev fallback or plain documentation text.

## 4. What is genuinely Workers-incompatible, and why

| Item | Location | Problem | Resolution |
|---|---|---|---|
| Persistent HTTP server | `server.js:86` (`app.listen`) | Workers has no persistent process — it's a stateless `fetch(request, env, ctx)` export per request | Rewrite as a Hono app exporting `fetch` |
| Frontend static serving | `server.js:58-70` | No local filesystem in a Workers isolate | Move to Cloudflare Pages as a separate deploy target; drop this responsibility from the Worker entirely |
| `documentStore.js` in-memory `Map`s | whole file | Module-level mutable state assumes one long-lived process; Workers isolates are short-lived/stateless per request | Raw PDF bytes → **R2**; document metadata/ownership/sample text → **D1** |
| `quotaService.js` | whole file | Entirely derived from `documentStore`, inherits the same non-persistence (was already a documented limitation even on Render — quota reset on every restart) | Derive from the same D1 `documents` table; this is a strict improvement over current Render behavior, not just parity |
| `videoService.js` cache, `explanationService.js` cache | `videoService.js:48`, `explanationService.js:13` | Same per-process assumption | **KV**, with TTL |
| `multer.memoryStorage()` + Express body parsers | `uploadRoute.js:15`, `server.js:30-31` | Express/Node-ecosystem-specific | Hono's native `c.req.parseBody()` / `Request.formData()` |
| `require('crypto').createHash('sha256')` | `userIdentity.js:1`, `documentService.js:1,40` | Node's synchronous crypto module isn't available in Workers | Web Crypto `crypto.subtle.digest('SHA-256', …)` (async); `crypto.randomUUID()` needed **no change** — it's already a Workers global |

## 5. Target production architecture

```
Local development (unchanged)
        |
GitHub main (origin: navaneethreddyav/ConceptBridge)
        |
        +--> Cloudflare Pages  --(static build)-->  frontend/dist  --> https://conceptbridge.pages.dev
        |
        +--> Cloudflare Workers (GitHub-connected Workers Build) --> Hono API --> https://conceptbridge-api.<subdomain>.workers.dev
                    |
                    +-- R2 bucket        conceptbridge-pdfs   (raw PDF bytes)
                    +-- D1 database      conceptbridge        (documents, quota-by-sum, ownership)
                    +-- KV namespace     conceptbridge-cache  (video + explanation cache, TTL'd)
```

- **Frontend and API are two separate deploys**, not one combined origin as on Render. The frontend already supports this cleanly via `VITE_API_BASE_URL` (§3) — set at Pages build time to the Worker's URL. CORS (`origin: true, credentials: true`) already exists specifically to support a cross-origin cookie (`DEPLOYMENT.md:19`), so this is not new complexity, just the mode that was already built and documented as "split deployment."
- **Database reversal, and why it's still in the spirit of the original constraint.** The original "no database" decision (`DEPLOYMENT.md:29`) was explicitly about not silently introducing *paid* infrastructure — Workers' statelessness makes some persistent store structurally mandatory (there is no single long-lived process left to hold a `Map` in), so this constraint cannot survive the platform change requested. D1 (5GB), R2 (10GB, egress-free), and KV (100k reads/day) all have free tiers comfortably beyond this app's scale, so the "free-first" spirit is preserved even though "no database" literally cannot be.
- Health check (`GET /api/health`) already matches the requested `{"status":"ok"}` shape (`server.js:44-46`) and needs no change beyond porting to Hono.

## 6. What blocks full automated deployment right now

Verified directly in this environment, not assumed:

- `wrangler whoami` → **not authenticated**, and no `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` in this shell's environment. Creating the actual R2 bucket / D1 database / KV namespace, connecting the GitHub repo in the Cloudflare dashboard (Workers Builds / Pages Git integration), and running a real `wrangler deploy` all require the Cloudflare account owner to authenticate — this cannot be done from this environment.
- `gh auth status` → authenticated as `navaneethreddyav`, confirmed push access to `origin`.

Everything that does **not** require a live Cloudflare account — writing the Hono backend, wrangler config, D1 schema/migrations, GitHub Actions deploy workflow, and local functional testing via `wrangler dev` (which emulates Workers/R2/D1/KV locally without any account) — proceeds without waiting on that credential. Actual resource provisioning and the first live deploy are the specific stop-point; see `docs/PRODUCTION-DEPLOYMENT.md` for exactly what's needed there.
