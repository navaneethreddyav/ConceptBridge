/**
 * Sends a controller error without leaking internals outside development.
 * Errors flagged `userFacing` carry a message written for the reader, so it is
 * sent as-is instead of the generic fallback.
 *
 * Hono port note: this was Express-`res`-shaped (`res.status(...).json(...)`) during
 * stage 1, when only uploadController.js existed on Hono — it deliberately used its own
 * local `sendError(c, ...)` helper instead of this file rather than fix it mid-migration.
 * Now that concept/explanation/media controllers are Hono-based too, this is ported to
 * the same `c.json(...)` shape (identical signature/behavior to uploadController's local
 * copy) so all three can share one implementation instead of duplicating it a third time.
 * @param {import('hono').Context} c
 * @param {Error} error
 * @param {string} fallbackMessage
 */
const sendError = (c, error, fallbackMessage) => {
    return c.json({
        success: false,
        error: error.userFacing ? error.message : fallbackMessage,
        details: c.env?.NODE_ENV === 'development' ? error.message : undefined
    }, error.statusCode || 500);
};

export { sendError };
