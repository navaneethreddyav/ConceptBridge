const conceptDetectionService = require('../services/conceptDetectionService');
const documentStore = require('../services/documentStore');

const detectConcepts = async (req, res) => {
    try {
        const { documentId, text } = req.body;

        if (!text || !documentId) {
            return res.status(400).json({ success: false, error: 'Document text and ID are required.' });
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

        const concepts = await conceptDetectionService.detectConcepts(text);

        // Save to cache
        documentStore.updateConcepts(documentId, concepts);

        return res.status(200).json({
            success: true,
            documentId: documentId,
            concepts: concepts
        });
    } catch (error) {
        console.error('Concept Detection Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to detect concepts.',
            details: error.message
        });
    }
};

module.exports = {
    detectConcepts
};
