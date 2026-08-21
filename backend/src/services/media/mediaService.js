import * as videoService from './videoService.js';

/**
 * @param {Object} env
 * @param {string} concept
 * @returns {Promise<{short: Object|null, long: Object|null}>}
 */
const getVideosForConcept = async (env, concept) => {
    if (!concept) {
        throw new Error('Concept is required to fetch media.');
    }

    return videoService.getVideos(env, concept);
};

export { getVideosForConcept };
