# ConceptBridge

An AI-powered reading companion: upload an educational PDF, read it in-app, select any word or phrase, and get an instant explanation in the sidebar — visual, simple meaning, natural-language explanation in the chosen language, and short/long educational videos. Signature flow: **READ → GET STUCK → HIGHLIGHT → UNDERSTAND → CONTINUE READING.**

## Engineering organization

This repo uses a Contractor + Worker model. The default Claude session in this repo acts as **Lead Contractor**: owns architecture, planning, delegation, implementation, integration, testing, debugging, deployment, and final verification. The Contractor inspects and verifies worker output — a worker reporting "done" is not sufficient evidence of done.

Four specialist subagents are defined in `.claude/agents/`:
- `architect` — inspects architecture, identifies reusable code, scopes minimal changes, flags risky rewrites. Read-only.
- `fullstack-engineer` — implements frontend (reader, sidebar, text selection) and backend (PDF processing, Gemini, YouTube Data API, language system, visuals).
- `qa-engineer` — actually runs and tests the app; never declares something working without running it.
- `deployment-engineer` — production build, env config, deploy, smoke test.

Workers make implementation decisions within their lane; architectural conflicts get escalated to the Contractor. Avoid two workers editing the same file in the same window.

## Stack

- **Frontend**: React 19 + Vite + Tailwind v4, `frontend/src`.
- **Backend**: Express 5 + Node, `backend/src`, in-memory `documentStore` (no database).
- **Shared**: `shared/supportedLanguages.json` is the single source of truth for the language list — used by both frontend and backend prompt logic. Language is a prompt parameter, not a branching code path. (JSON rather than a CommonJS module so Vite can import it directly in the browser without a `module.exports` shim.)

## AI provider

Runtime AI provider is **Google Gemini Developer API** via `GEMINI_API_KEY` (`backend/.env`, server-side only). Ollama remains as a fallback during development — do not delete it, but Gemini is the production path. Claude is the development system only; never use the Anthropic API in application runtime code.

## Video provider

**YouTube Data API v3** via `YOUTUBE_API_KEY` (`backend/.env`, server-side only), replacing the keyless search package. For a selected concept, retrieve one short (<4 min preferred) and one long (>20 min preferred) embeddable educational video. These are ranking preferences, not guarantees — never claim the API guarantees animation or no-voiceover, and never invent a video URL; every displayed video must come from a real retrieved result. Cache by normalized term to reduce quota usage. Degrade gracefully (empty state) on API failure — never crash.

## Secrets

`GEMINI_API_KEY`, `YOUTUBE_API_KEY`, `PORT` live in `backend/.env` (gitignored). `backend/.env.example` is the public template with placeholder values only.

- Never print or log actual key values.
- Never expose either key to frontend code or bundles.
- Never commit `backend/.env`.
- Never put real values in documentation.

## Languages

Base: English. Required: Hindi, Telugu, Tamil, Gujarati, Marathi, Bengali. Explanations are natural, spoken-register educational language generated directly by the AI in the target language — not literal/dictionary translation. Preserve commonly-used English technical terms where that aids understanding; natural code-switching is fine. Technical accuracy is non-negotiable. One generic language config, not six parallel implementations.

## Automatic terminology detection

Detect important engineering/technical terms across domains (CS, electrical, electronics, mechanical, civil, and other technical fields), ranked by importance. Don't over-highlight ordinary words. Manual selection must always work even when a term wasn't auto-detected.

## Visuals

Deterministic SVG/HTML diagrams only — no image-generation API. Visuals must actually explain the concept, not decorate the page. Clean fallback when a visual can't be generated for a concept.

## UI

Strict palette: black `#000000`, white `#FFFFFF`, gold `#D4AF37`. No other accent colors. Premium, academic, focused, minimal. Layout: document reader on the left, ConceptBridge sidebar on the right, responsive on smaller screens.

## Out of scope (do not build)

Authentication, payments, user accounts, admin dashboard, unnecessary database, OCR, speech recognition, speech synthesis beyond the existing browser TTS, live voice translation, vector database, RAG, fine-tuning, mobile app, microservices, unnecessary APIs.

## Repository safety

Never `git reset --hard`, never force-push, never delete `.git`, never change the origin remote, never commit secrets. Do not delete working functionality without understanding why it's there first. Create logical git checkpoints before major milestones. Only commit when asked.

## Definition of done (P0)

Frontend and backend start; PDF upload and text extraction work; document reader displays the PDF; arbitrary text selection works and reaches the backend with context; sidebar opens with concept, visual, simple meaning, and natural explanation; all seven languages produce natural explanations; important engineering terms are auto-detected; short and long YouTube videos load; loading/error states work; production build and deployment work; the full read → highlight → understand journey passes end-to-end. P1 (general web resource discovery, advanced ranking/caching, richer diagrams, polish) never delays P0.
