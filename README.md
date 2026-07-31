# ConceptBridge 2.0 MVP

ConceptBridge is an AI-powered learning platform that helps students understand difficult concepts from educational PDFs. 
Instead of just summarizing documents like a standard chatbot, ConceptBridge acts as an intelligent, deeply empathetic tutor—extracting key concepts and explaining them step-by-step with real-world analogies, native language support, and interactive voice playback.

**Crucially, ConceptBridge runs 100% locally.** No paid APIs, no OpenAI keys, and complete data privacy using Ollama and local models.

---

## Features

- **Intelligent PDF Extraction**: Upload dense educational PDFs. The backend processes the document and chunks text to support massive files without token overflow.
- **Context-Aware Concept Detection**: AI scans the document and automatically identifies algorithms, theories, definitions, and processes—ignoring filler text and table of contents.
- **AI Educational Explanation Engine**: Click any concept to receive a personalized lesson. Explanations avoid heavy jargon, prioritize intuition, and provide step-by-step breakdowns and common mistakes.
- **Multilingual Support**: Generate explanations natively in English, Telugu, Hindi, Tamil, Kannada, and Malayalam without literal machine translation.
- **Visual Learning**: Automatically fetches relevant educational diagrams from Wikipedia and short educational explainer videos from YouTube, completely free of API keys.
- **Voice Playback**: Offline, browser-based Text-to-Speech (TTS) that reads the explanation to you in the selected language.

---

## Architecture

The project uses a highly modular, decoupled architecture:

### Frontend (Vite + React + Tailwind)
- `App.jsx`: Main application wrapper.
- `SettingsContext.jsx`: Global context managing language, difficulty, and voice preferences.
- `ConceptList.jsx`: Renders AI-detected concepts as interactive cards (optimized with `React.memo`).
- `LearningModal.jsx`: Dynamic overlay that concurrently fetches Explanations and Media when a concept is clicked.
- `VoicePlayer.jsx`: Hooks into the `window.speechSynthesis` API for offline TTS.
- `ErrorBoundary.jsx`: Catches rendering crashes and provides a graceful fallback UI.

### Backend (Node.js + Express)
- `documentStore.js`: In-memory caching for parsed PDFs to avoid redundant extraction.
- `conceptDetectionService.js`: Chunks PDFs, runs local inference, and orchestrates the parsing pipeline.
- `explanationService.js`: High-speed generation engine with in-memory caching keyed by language and difficulty.
- `promptService.js`: Centralized prompt engineering logic injecting the "Teacher" persona.
- `mediaService.js`: Scrapes Wikipedia (images) and YouTube (videos) without API keys.

---

## Prerequisites

1. **Node.js**: v18+ recommended.
2. **Ollama**: Installed and running locally.

### Ollama Setup
Install [Ollama](https://ollama.ai/) and download a suitable model (e.g., `llama3.1`, `qwen2.5`, or `gemma2`).

```bash
ollama run qwen2.5
```

---

## Installation & Running Locally

### 1. Clone the repository
Ensure you are in the root directory.

### 2. Install dependencies
```bash
# Terminal 1: Backend
cd backend
npm install

# Terminal 2: Frontend
cd frontend
npm install
```

### 3. Environment Variables
Create a `.env` file in the `backend` directory:
```env
PORT=5000
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5
NODE_ENV=development
```

### 4. Start the Application
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```
Navigate to `http://localhost:5173` in your browser.

---

## Supported Languages
The application currently supports native explanation generation and TTS in:
- English
- Telugu
- Hindi
- Tamil
- Kannada
- Malayalam

*Languages are centrally managed in `shared/supportedLanguages.js`.*

---

## Future Roadmap
- Local vector database (ChromaDB) for advanced RAG.
- Generated Quizzes for self-assessment.
- User accounts and progress tracking.

---

## License
MIT License. Open-source and built for local learning.
