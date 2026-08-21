import * as conceptDetectionService from '../services/conceptDetectionService.js';
import * as documentStore from '../services/documentStore.js';
import { sendError } from '../utils/errorResponse.js';

const detectConcepts = async (c) => {
    try {
        const env = c.env;
        const userId = c.get('userId');
        const { documentId } = await c.req.json();

        if (!documentId) {
            return c.json({ success: false, error: 'Document ID is required.' }, 400);
        }

        // 404 (not 403) on ownership mismatch — same convention as uploadController.
        const owner = await documentStore.getOwner(env, documentId);
        if (owner !== userId) {
            return c.json({ success: false, error: 'Document not found.' }, 404);
        }

        // Check cache
        const doc = await documentStore.getDocument(env, documentId);
        if (doc && doc.concepts && doc.concepts.length > 0) {
            return c.json({
                success: true,
                documentId: documentId,
                concepts: doc.concepts,
                cached: true
            }, 200);
        }

        // Detection always runs against the bounded upload-time sample (first ~20
        // pages), never the full document — this is what keeps auto-detect to a small,
        // constant number of Gemini calls regardless of whether the document is 5 pages
        // or 5000. Manual selection (the primary path) works on any text either way.
        const sampleText = await documentStore.getSampleText(env, documentId);
        if (!sampleText) {
            return c.json({ success: false, error: 'Document not found.' }, 404);
        }

        const concepts = await conceptDetectionService.detectConcepts(env, sampleText);

        // Save to cache
        await documentStore.updateConcepts(env, documentId, concepts);

        return c.json({
            success: true,
            documentId: documentId,
            concepts: concepts
        }, 200);
    } catch (error) {
        console.error('Concept Detection Error:', error);
        return sendError(c, error, 'Failed to detect concepts.');
    }
};

export { detectConcepts };
