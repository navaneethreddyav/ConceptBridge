const videoService = require('./videoService');

class MediaService {
    /**
     * @param {string} concept
     * @returns {Promise<{short: Object|null, long: Object|null}>}
     */
    async getVideosForConcept(concept) {
        if (!concept) {
            throw new Error('Concept is required to fetch media.');
        }

        return videoService.getVideos(concept);
    }
}

module.exports = new MediaService();
