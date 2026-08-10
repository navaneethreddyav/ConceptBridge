const path = require('path');

// Raised from 10MB alongside the bounded-extraction/on-demand-pages/windowed-rendering
// changes that make a large upload actually safe to handle — not a standalone bump.
// A 500-1000 page text-heavy engineering textbook typically lands well under this.
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Validates the uploaded file.
 * @param {Object} file - The file object from Multer
 * @returns {Object} - { isValid: boolean, error?: string }
 */
const validatePdfFile = (file) => {
    if (!file) {
        return { isValid: false, error: 'No file provided.' };
    }

    // Check MIME type
    if (file.mimetype !== 'application/pdf') {
        return { isValid: false, error: 'Invalid file type. Only PDF files are allowed.' };
    }

    // Check extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') {
        return { isValid: false, error: 'Invalid file extension. Only .pdf is allowed.' };
    }

    // Check size
    if (file.size > MAX_FILE_SIZE) {
        return { isValid: false, error: `File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.` };
    }

    return { isValid: true };
};

module.exports = {
    validatePdfFile,
    MAX_FILE_SIZE
};
