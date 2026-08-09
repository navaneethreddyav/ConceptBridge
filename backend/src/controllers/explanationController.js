const explanationService = require('../services/explanation/explanationService');
const documentStore = require('../services/documentStore');
const { sendError } = require('../utils/errorResponse');

const generateExplanation = async (req, res) => {
    try {
        const { documentId, concept, contextBefore, contextAfter, language, difficulty } = req.body;

        if (!concept) {
            return res.status(400).json({ success: false, error: 'Concept name is required.' });
        }

        let before = contextBefore || '';
        let after = contextAfter || '';

        // Safety net for callers that send no selection context at all.
        if (!before && !after && documentId) {
            const doc = documentStore.getDocument(documentId);
            if (doc && doc.content && doc.content.rawText) {
                before = doc.content.rawText;
            }
        }

        const { explanation, visual } = await explanationService.generateExplanation(
            concept,
            { contextBefore: before, contextAfter: after },
            language,
            difficulty,
            documentId
        );

        return res.status(200).json({
            success: true,
            explanation,
            visual
        });

    } catch (error) {
        console.error('Explanation Error:', error);
        return sendError(res, error, 'Failed to generate explanation.');
    }
};

module.exports = {
    generateExplanation
};
