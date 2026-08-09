const mediaService = require('../services/media/mediaService');
const { sendError } = require('../utils/errorResponse');

const getMedia = async (req, res) => {
    try {
        const { concept } = req.body;

        if (!concept) {
            return res.status(400).json({ success: false, error: 'Concept name is required.' });
        }

        const videos = await mediaService.getVideosForConcept(concept);

        return res.status(200).json({
            success: true,
            videos
        });
    } catch (error) {
        console.error('Media Controller Error:', error);
        return sendError(res, error, 'Failed to fetch media.');
    }
};

module.exports = {
    getMedia
};
