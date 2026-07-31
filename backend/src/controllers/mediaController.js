const mediaService = require('../services/media/mediaService');

const getMedia = async (req, res) => {
    try {
        const { concept, documentSubject, keywords, relatedConcepts } = req.body;

        if (!concept) {
            return res.status(400).json({ success: false, error: 'Concept name is required.' });
        }

        // Construct context-aware query
        let queryParts = [concept];
        if (documentSubject) queryParts.push(documentSubject);
        
        // If we have no subject but have related concepts or keywords, add one to provide context
        if (!documentSubject) {
            if (relatedConcepts && relatedConcepts.length > 0) {
                queryParts.push(relatedConcepts[0]);
            } else if (keywords && keywords.length > 0) {
                queryParts.push(keywords[0]);
            }
        }

        const searchQuery = queryParts.join(' ');

        const media = await mediaService.getMediaForConcept(searchQuery);

        return res.status(200).json({
            success: true,
            media
        });
    } catch (error) {
        console.error('Media Controller Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch media.',
            details: error.message
        });
    }
};

module.exports = {
    getMedia
};
