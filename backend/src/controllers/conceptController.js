const conceptDetectionService = require('../services/conceptDetectionService');
const documentStore = require('../services/documentStore');
const { sendError } = require('../utils/errorResponse');

const detectConcepts = async (req, res) => {
    try {
        const { documentId } = req.body;

        if (!documentId) {
            return res.status(400).json({ success: false, error: 'Document ID is required.' });
        }

        // Check cache
        const doc = documentStore.getDocument(documentId);
        if (doc && doc.concepts && doc.concepts.length > 0) {
            return res.status(200).json({
                success: true,
                documentId: documentId,
                concepts: doc.concepts,
                cached: true
            });
        }

        // Detection always runs against the bounded upload-time sample (first ~20
        // pages), never the full document — this is what keeps auto-detect to a small,
        // constant number of Gemini calls regardless of whether the document is 5 pages
        // or 5000. Manual selection (the primary path) works on any text either way.
        const sampleText = documentStore.getSampleText(documentId);
        if (!sampleText) {
            return res.status(404).json({ success: false, error: 'Document not found.' });
        }

        const concepts = await conceptDetectionService.detectConcepts(sampleText);

        // Save to cache
        documentStore.updateConcepts(documentId, concepts);

        return res.status(200).json({
            success: true,
            documentId: documentId,
            concepts: concepts
        });
    } catch (error) {
        console.error('Concept Detection Error:', error);
        return sendError(res, error, 'Failed to detect concepts.');
    }
};

module.exports = {
    detectConcepts
};
