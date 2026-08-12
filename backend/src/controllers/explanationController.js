const explanationService = require('../services/explanation/explanationService');
const documentStore = require('../services/documentStore');
const { sendError } = require('../utils/errorResponse');

const generateExplanation = async (req, res) => {
    try {
        const { documentId, concept, contextBefore, contextAfter, language, difficulty } = req.body;

        if (!concept) {
            return res.status(400).json({ success: false, error: 'Concept name is required.' });
        }

        // documentId doubles as part of the explanation cache key, so ownership is
        // checked whenever it's present — not just when it's needed to fetch context —
        // to avoid letting a caller probe or pollute another owner's cache namespace.
        if (documentId && documentStore.getOwner(documentId) !== req.userId) {
            return res.status(404).json({ success: false, error: 'Document not found.' });
        }

        let before = contextBefore || '';
        let after = contextAfter || '';

        // Safety net for callers that send no selection context at all. Uses the
        // bounded upload-time sample, not the full document — in normal operation the
        // frontend always supplies real contextBefore/After from the live PDF text
        // layer, so this only matters for an edge-case caller with no selection.
        if (!before && !after && documentId) {
            const sampleText = documentStore.getSampleText(documentId);
            if (sampleText) {
                before = sampleText;
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
