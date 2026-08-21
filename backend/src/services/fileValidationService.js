// Raised from 10MB alongside the bounded-extraction/on-demand-pages/windowed-rendering
// changes that make a large upload actually safe to handle — not a standalone bump.
// A 500-1000 page text-heavy engineering textbook typically lands well under this.
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Validates the uploaded file.
 * @param {{mimetype: string, originalname: string, size: number}} file
 * @returns {{isValid: boolean, error?: string}}
 */
const validatePdfFile = (file) => {
    if (!file) {
        return { isValid: false, error: 'No file provided.' };
    }

    if (file.mimetype !== 'application/pdf') {
        return { isValid: false, error: 'Invalid file type. Only PDF files are allowed.' };
    }

    // Inline extension check (no `path` module) — Workers' nodejs_compat polyfills
    // `node:path`, but a one-line extname check doesn't need the dependency at all.
    const dot = file.originalname.lastIndexOf('.');
    const ext = dot === -1 ? '' : file.originalname.slice(dot).toLowerCase();
    if (ext !== '.pdf') {
        return { isValid: false, error: 'Invalid file extension. Only .pdf is allowed.' };
    }

    if (file.size > MAX_FILE_SIZE) {
        return { isValid: false, error: `File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.` };
    }

    return { isValid: true };
};

export { validatePdfFile, MAX_FILE_SIZE };
