/**
 * Sends a controller error without leaking internals outside development.
 * Errors flagged `userFacing` carry a message written for the reader, so it is
 * sent as-is instead of the generic fallback.
 * @param {Object} res
 * @param {Error} error
 * @param {string} fallbackMessage
 */
const sendError = (res, error, fallbackMessage) => {
    return res.status(error.statusCode || 500).json({
        success: false,
        error: error.userFacing ? error.message : fallbackMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
};

module.exports = { sendError };
