const explanationService = require('../services/explanation/explanationService');
const documentStore = require('../services/documentStore');

const generateExplanation = async (req, res) => {
    try {
        const { documentId, concept, context, language, difficulty } = req.body;

        if (!concept) {
            return res.status(400).json({ success: false, error: 'Concept name is required.' });
        }

        let contextText = context || "";

        if (documentId && !contextText) {
            const doc = documentStore.getDocument(documentId);
            if (doc && doc.content && doc.content.rawText) {
                contextText = doc.content.rawText;
            }
        }

        const explanation = await explanationService.generateExplanation(concept, contextText, language, difficulty, documentId);

        return res.status(200).json({
            success: true,
            explanation
        });

    } catch (error) {
        console.error('Explanation Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to generate explanation.',
            details: error.message
        });
    }
};

module.exports = {
    generateExplanation
};
