const axios = require('axios');

class ImageService {
    /**
     * Fetches educational images related to the concept using Wikipedia API.
     * @param {string} concept 
     * @returns {Promise<Array>}
     */
    async getImages(concept) {
        try {
            // Use Wikipedia API to search for the concept and return page images
            const url = `https://en.wikipedia.org/w/api.php`;
            const params = {
                action: 'query',
                generator: 'search',
                gsrsearch: `${concept} education`,
                gsrlimit: 3,
                prop: 'pageimages',
                pithumbsize: 800,
                format: 'json',
                origin: '*'
            };

            const response = await axios.get(url, { params });
            const pages = response.data?.query?.pages;
            
            if (!pages) return [];

            const images = [];
            for (const key in pages) {
                const page = pages[key];
                if (page.thumbnail && page.thumbnail.source) {
                    images.push({
                        url: page.thumbnail.source,
                        title: page.title,
                        source: 'Wikipedia'
                    });
                }
            }

            return images;
        } catch (error) {
            console.error('ImageService Error:', error.message);
            return []; // Fail gracefully
        }
    }
}

module.exports = new ImageService();
