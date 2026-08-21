import * as mediaService from '../services/media/mediaService.js';
import { sendError } from '../utils/errorResponse.js';

const getMedia = async (c) => {
    try {
        const env = c.env;
        const { concept } = await c.req.json();

        if (!concept) {
            return c.json({ success: false, error: 'Concept name is required.' }, 400);
        }

        const videos = await mediaService.getVideosForConcept(env, concept);

        return c.json({
            success: true,
            videos
        }, 200);
    } catch (error) {
        console.error('Media Controller Error:', error);
        return sendError(c, error, 'Failed to fetch media.');
    }
};

export { getMedia };
