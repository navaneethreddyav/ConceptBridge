const ytSearch = require('youtube-search-without-api-key');

class VideoService {
    /**
     * Fetches short educational YouTube videos related to the concept.
     * @param {string} concept 
     * @returns {Promise<Array>}
     */
    async getVideos(concept) {
        try {
            const query = `${concept} educational explanation short`;
            const videos = await ytSearch.search(query);

            if (!videos || videos.length === 0) return [];

            // Filter and map the top 2 videos
            return videos.slice(0, 2).map(video => ({
                id: video.id.videoId,
                url: video.url,
                title: video.title,
                thumbnail: video.snippet?.thumbnails?.url || '',
                duration: video.duration_raw,
                source: 'YouTube'
            }));
        } catch (error) {
            console.error('VideoService Error:', error.message);
            return []; // Fail gracefully
        }
    }
}

module.exports = new VideoService();
