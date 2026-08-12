const express = require('express');
const multer = require('multer');
const {
    handleUpload,
    getDocumentFile,
    getDocumentPages,
    listDocuments,
    getUsage,
    deleteDocument
} = require('../controllers/uploadController');
const { MAX_FILE_SIZE } = require('../services/fileValidationService');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: MAX_FILE_SIZE } });

const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE'
            ? 'The PDF is too large.'
            : `Upload the PDF as a single "pdf" form field. (${err.code})`;
        return res.status(400).json({ success: false, error: message });
    }
    return next(err);
};

router.get('/', listDocuments);
router.get('/usage', getUsage);
router.post('/', upload.single('pdf'), handleMulterError, handleUpload);
router.get('/:id/file', getDocumentFile);
router.get('/:id/pages', getDocumentPages);
router.delete('/:id', deleteDocument);

module.exports = router;
