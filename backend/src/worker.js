import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { userIdentity } from './middleware/userIdentity.js';
import uploadRoute from './routes/uploadRoute.js';
import aiRoute from './routes/aiRoute.js';
import conceptRoute from './routes/conceptRoute.js';
import explanationRoute from './routes/explanationRoute.js';
import mediaRoute from './routes/mediaRoute.js';

const app = new Hono();

// origin: (origin) => origin reflects the requesting origin dynamically (Hono's
// equivalent of Express cors' `origin: true`), which is required once credentials:
// true is set — needed so the anonymous identity cookie (see middleware/userIdentity.js)
// actually rides along on cross-origin requests between Cloudflare Pages (frontend) and
// this Worker (API). See DEPLOYMENT.md's CORS section for the full rationale.
app.use('*', cors({
    origin: (origin) => origin,
    credentials: true
}));

// Hono's secureHeaders() doesn't ship an implicit default CSP the way helmet does — the
// object below IS the full policy, reconstructed from helmet.contentSecurityPolicy
// .getDefaultDirectives() (see server.js) with the same img-src override this app has
// always needed: YouTube video thumbnails are a genuine cross-origin <img>, which the
// bare 'self' default would otherwise silently block.
app.use('*', secureHeaders({
    // Hono applies secureHeaders' own headers via `.set()` (overwrite) AFTER the route
    // handler runs, the reverse of Express/helmet's before-the-handler ordering — so
    // its "same-origin" CORP default would silently clobber uploadController's explicit
    // per-route `Cross-Origin-Resource-Policy: cross-origin` on the PDF file-serving
    // route (confirmed by an actual curl test showing "same-origin" win). Disabled here
    // so the route handler stays authoritative, exactly like the original Express app.
    // This matters more than it did on Render: Pages (frontend) and this Worker (API)
    // are genuinely different origins in the target split deployment.
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
        upgradeInsecureRequests: []
    }
}));

app.use('*', userIdentity);

// Basic health check route — matches server.js's shape exactly.
app.get('/api/health', (c) => c.json({ status: 'ok', message: 'ConceptBridge API is running' }));

app.route('/api/upload', uploadRoute);
app.route('/api/ai', aiRoute);
app.route('/api/concepts', conceptRoute);
app.route('/api/explanation', explanationRoute);
app.route('/api/media', mediaRoute);

app.notFound((c) => c.json({ success: false, error: 'Not found.' }, 404));

app.onError((err, c) => {
    console.error('Unhandled Worker Error:', err);
    return c.json({
        success: false,
        error: 'An unexpected server error occurred.',
        details: c.env?.NODE_ENV === 'development' ? err.message : undefined
    }, err.status || 500);
});

export default app;
