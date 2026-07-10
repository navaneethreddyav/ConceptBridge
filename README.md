# ConceptBridge (Phase 1 MVP)

ConceptBridge is an AI-powered educational platform designed to bridge language gaps for students from rural and regional-language backgrounds. It automatically extracts key academic concepts from uploaded English PDFs and translates/explains them in a student-friendly format with Telugu translations, real-world examples, and curated YouTube learning videos.

---

## Features Implemented
1. **PDF Upload**: Drag-and-drop or select academic PDFs with immediate client-side validation (PDF only, max 10MB).
2. **Text Extraction**: Uses `pdf-parse` to extract complete text from the uploaded PDF.
3. **Concept Extraction**: Employs OpenAI GPT-4o-mini to find 5–20 important technical concepts, ignoring duplicates and common words.
4. **Concept Explanation**: Explains terms in simple jargon-free English (max 150 words).
5. **Telugu Translation**: Generates natural, student-friendly Telugu translation and explanations (using Telugu script).
6. **Real-World Examples**: Produces a relatable real-world example for each concept.
7. **YouTube Resources**: Suggests 3 relevant YouTube learning videos with titles and thumbnails, linked to open in a new tab.

---

## Directory Structure
```
ConceptBridge/
├── sample.pdf                 # Pre-generated academic PDF for testing
├── README.md                  # Installation and setup guide (this file)
├── backend/
│   ├── index.js               # Express application and api endpoints
│   ├── package.json           # Backend npm dependencies and scripts
│   ├── .env                   # Configuration file (loaded on startup)
│   ├── .env.example           # Reference configuration template
│   ├── test-backend.js        # Offline integration testing script
│   └── utils/
│       ├── openai.js          # OpenAI concept and explanation engine
│       └── youtube.js         # YouTube Data API and HTML scraping helper
└── frontend/
    ├── index.html             # Vite entry template (loads Outfit and Inter fonts)
    ├── package.json           # Frontend npm dependencies and scripts
    ├── vite.config.js         # Vite configuration with backend api proxy
    ├── tailwind.config.js     # Tailwind setup with brand typography & colors
    ├── postcss.config.js      # PostCSS parser integration
    └── src/
        ├── main.jsx           # React app renderer
        ├── index.css          # Styling declarations, glassmorphism, scrollbars
        ├── App.jsx            # Main app controller and cache manager
        └── components/
            ├── Header.jsx           # App navbar & translation target indicator
            ├── UploadSection.jsx    # Drag-and-drop PDF component
            ├── LoadingIndicator.jsx # State spinner & progress indicator
            ├── ConceptsSection.jsx  # Interactive card grid of concepts
            └── ConceptDetails.jsx   # Tabulated explanations & YouTube cards
```

---

## Prerequisites
- **Node.js**: v18.x or higher
- **npm**: v9.x or higher

---

## Setup & Installation

### 1. Clone or Navigate to the Workspace
Ensure you are in the project root directory:
```bash
/Users/navaneeth/.gemini/antigravity/scratch/ConceptBridge
```

### 2. Configure Environment Variables
Navigate to the backend directory:
```bash
cd backend
```
Open `.env` in an editor and enter your **OpenAI API Key**:
```env
PORT=5001
OPENAI_API_KEY=your_openai_api_key_here
YOUTUBE_API_KEY=your_optional_youtube_api_key_here
```
> **Note**: If no OpenAI API Key is provided, the application will automatically enter **Mock Mode**. It will allow you to upload the included `sample.pdf` and test the entire user interface flow with mock concepts, explanations, and YouTube resources!

---

## Running the Application

To run the application locally, you will need to start both the backend server and the frontend development server.

### Start the Backend Server
From the `backend/` directory:
```bash
npm run dev
# Or to run with node directly: npm start
```
The backend will launch on **http://localhost:5001**.

### Start the Frontend Dev Server
Open a new terminal window, navigate to the `frontend/` directory, and run:
```bash
cd frontend
npm run dev
```
The frontend will launch on **http://localhost:5173**. Open this URL in your web browser to use the application!

---

## Testing & Verification

### Running the Backend Integration Test
A backend integration script is included to quickly verify that text extraction, translation prompts, and video scrapers are functioning properly.
From the `backend/` directory, run:
```bash
node test-backend.js
```
This script will parse the root `sample.pdf` file, trigger concept extraction, request explanations, fetch YouTube results, and display the JSON structures. It does not require starting the backend server.
