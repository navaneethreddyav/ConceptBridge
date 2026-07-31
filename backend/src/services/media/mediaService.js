const imageService = require('./imageService');
const videoService = require('./videoService');

class MediaService {
    /**
     * Aggregates images and videos for a given concept.
     * @param {string} concept 
     * @returns {Promise<Object>}
     */
    async getMediaForConcept(concept) {
        if (!concept) {
            throw new Error('Concept is required to fetch media.');
        }

        // Fetch concurrently for performance
        const [images, videos] = await Promise.all([
            imageService.getImages(concept),
            videoService.getVideos(concept)
        ]);

        return {
            images,
            videos
        };
    }
}

module.exports = new MediaService();
