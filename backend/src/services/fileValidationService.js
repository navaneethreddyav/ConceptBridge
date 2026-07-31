const path = require('path');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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
