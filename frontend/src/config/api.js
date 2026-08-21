// Single source of truth for the backend base URL.
// Post-migration, frontend (Cloudflare Pages) and backend (Cloudflare Workers) are
// always two separate origins — there is no single-service "same origin" deployment
// anymore. Configure via VITE_API_BASE_URL in frontend/.env (see frontend/.env.example),
// pointing at the deployed Worker URL in production. If unset: in dev (`vite dev`)
// falls back to `wrangler dev`'s default local port (see backend's `npm run cf:dev`);
// in a production build with no VITE_API_BASE_URL set, falls back to '' (relative
// paths), which will 404 against Pages — set the env var before building for deploy.
export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:8787' : '');
