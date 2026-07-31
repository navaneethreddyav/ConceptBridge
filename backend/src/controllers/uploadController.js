const fileValidationService = require('../services/fileValidationService');
const documentService = require('../services/documentService');

const handleUpload = async (req, res) => {
    try {
        const file = req.file;

        // 1. Validation
        const validation = fileValidationService.validatePdfFile(file);
        if (!validation.isValid) {
            return res.status(400).json({ success: false, error: validation.error });
        }

        // 2. Process Document
        const document = await documentService.processDocument(file);

        // Save to in-memory store
        const documentStore = require('../services/documentStore');
        documentStore.saveDocument(document);

        // 3. Return Response
        return res.status(200).json({
            success: true,
            document: document
        });

    } catch (error) {
        console.error('Upload handling error:', error);
        return res.status(500).json({
            success: false,
            error: 'An error occurred while processing the PDF.',
            details: error.message
        });
    }
};

module.exports = {
    handleUpload
};
