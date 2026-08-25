import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // shared/ (engineeringTerminology.json, firstYearSubjects.json, supportedLanguages.json)
  // lives one level above this project root and is imported both as a plain module and,
  // in topicTerms.js, via a `?url` asset import — the latter hits Vite's stricter
  // server.fs allow-list even though a plain import of the same path is unaffected,
  // so the repo root must be explicitly allowed for both dev server and Vitest (which
  // reuses this same config/transform pipeline).
  server: {
    fs: {
      allow: ['..'],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
  },
})
