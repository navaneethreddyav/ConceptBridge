const express = require('express');
const multer = require('multer');
const { handleUpload } = require('../controllers/uploadController');
const { MAX_FILE_SIZE } = require('../services/fileValidationService');

const router = express.Router();

// Configure multer for memory storage
// We keep the file in memory buffer instead of writing to disk since we only need to extract text
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE
    }
});

router.post('/', upload.single('pdf'), handleUpload);

module.exports = router;
