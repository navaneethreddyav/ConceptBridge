import * as explanationService from '../services/explanation/explanationService.js';
import * as documentStore from '../services/documentStore.js';
import { sendError } from '../utils/errorResponse.js';

const generateExplanation = async (c) => {
    try {
        const env = c.env;
        const userId = c.get('userId');
        const { documentId, concept, contextBefore, contextAfter, language, difficulty } = await c.req.json();

        if (!concept) {
            return c.json({ success: false, error: 'Concept name is required.' }, 400);
        }

        // documentId doubles as part of the explanation cache key, so ownership is
        // checked whenever it's present — not just when it's needed to fetch context —
        // to avoid letting a caller probe or pollute another owner's cache namespace.
        // 404 (not 403) on mismatch, same convention as uploadController/conceptController.
        if (documentId) {
            const owner = await documentStore.getOwner(env, documentId);
            if (owner !== userId) {
                return c.json({ success: false, error: 'Document not found.' }, 404);
            }
        }

        let before = contextBefore || '';
        let after = contextAfter || '';

        // Safety net for callers that send no selection context at all. Uses the
        // bounded upload-time sample, not the full document — in normal operation the
        // frontend always supplies real contextBefore/After from the live PDF text
        // layer, so this only matters for an edge-case caller with no selection.
        if (!before && !after && documentId) {
            const sampleText = await documentStore.getSampleText(env, documentId);
            if (sampleText) {
                before = sampleText;
            }
        }

        const { explanation, visual } = await explanationService.generateExplanation(
            env,
            concept,
            { contextBefore: before, contextAfter: after },
            language,
            difficulty,
            documentId
        );

        return c.json({
            success: true,
            explanation,
            visual
        }, 200);

    } catch (error) {
        console.error('Explanation Error:', error);
        return sendError(c, error, 'Failed to generate explanation.');
    }
};

export { generateExplanation };
