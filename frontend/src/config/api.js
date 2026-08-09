// Single source of truth for the backend base URL.
// Configure via VITE_API_BASE_URL in frontend/.env (see frontend/.env.example) to point
// at a separately-deployed backend. If unset: in dev (`vite dev`) falls back to the
// backend's documented default dev port, since the two run as separate processes; in a
// production build, falls back to '' (relative paths), which is correct when the
// backend serves this same built frontend from one origin — no localhost URL is ever
// baked into a production bundle.
export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');
