const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const helmet = require('helmet');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
    // Default CSP is img-src 'self', which would silently block the YouTube video
    // thumbnails (a genuine cross-origin <img>) now that this server also serves the
    // frontend HTML in production. Everything else keeps helmet's default directives.
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            'img-src': ["'self'", 'data:', 'https:']
        }
    }
}));
// origin: true reflects the requesting origin dynamically (rather than a fixed '*'),
// which is required once credentials: true is set — needed so the anonymous identity
// cookie (see middleware/userIdentity.js) actually rides along on cross-origin
// requests from the Vite dev server; in production the frontend is served from this
// same origin so this is effectively a same-origin request either way.
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const { userIdentity } = require('./middleware/userIdentity');
app.use(userIdentity);

// Routes
const uploadRoute = require('./routes/uploadRoute');
const aiRoute = require('./routes/aiRoute');
const conceptRoute = require('./routes/conceptRoute');
const explanationRoute = require('./routes/explanationRoute');
const mediaRoute = require('./routes/mediaRoute');

// Basic health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'ConceptBridge API is running' });
});

app.use('/api/upload', uploadRoute);
app.use('/api/ai', aiRoute);
app.use('/api/concepts', conceptRoute);
app.use('/api/explanation', explanationRoute);
app.use('/api/media', mediaRoute);

// Serve the built frontend so the whole app can run as a single deployed service.
// __dirname-relative, so this resolves correctly regardless of the process's cwd.
// No-op locally if frontend/dist hasn't been built (e.g. plain `npm run dev` on the
// backend alone) — express.static simply falls through to the routes below it.
const FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(FRONTEND_DIST));

// SPA fallback: any non-API GET request serves the frontend shell. Regex (not the
// string wildcard '*') because Express 5's path-to-regexp no longer accepts a bare
// '*' pattern; a RegExp route is unaffected by that and matches everything except
// /api/... . If frontend/dist isn't built, sendFile's error reaches the handler below
// instead of crashing the process.
app.get(/^\/(?!api\/).*/, (req, res, next) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'), (err) => {
        if (err) next(err);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    // Only log error in development, avoid leaking stack traces in production
    if (process.env.NODE_ENV !== 'production') {
        console.error('Unhandled Server Error:', err);
    }
    
    res.status(err.status || 500).json({
        success: false,
        error: 'An unexpected server error occurred.',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running safely on port ${PORT}`);
});
