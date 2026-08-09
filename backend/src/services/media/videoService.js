const axios = require('axios');

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';

const SHORT_MAX_SECONDS = 240;
const LONG_MIN_SECONDS = 1200;

const EMPTY = { short: null, long: null };

/**
 * Parses an ISO-8601 duration (e.g. PT4M13S) into seconds.
 * @param {string} duration
 * @returns {number}
 */
function parseIsoDuration(duration) {
    const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(duration || '');
    if (!match) return 0;

    const [, days, hours, minutes, seconds] = match;
    return (Number(days || 0) * 86400)
        + (Number(hours || 0) * 3600)
        + (Number(minutes || 0) * 60)
        + Math.floor(Number(seconds || 0));
}

function normalizeTerm(concept) {
    return String(concept).toLowerCase().trim().replace(/\s+/g, ' ');
}

function toVideo(item, durationSeconds) {
    const snippet = item.snippet || {};
    const thumbnails = snippet.thumbnails || {};
    const thumbnail = thumbnails.medium || thumbnails.high || thumbnails.default || {};

    return {
        id: item.id,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        title: snippet.title || '',
        thumbnail: thumbnail.url || '',
        duration: durationSeconds,
        channelTitle: snippet.channelTitle || ''
    };
}

class VideoService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Finds one short and one long embeddable educational video for a concept.
     * Returns nulls rather than throwing when the API is unavailable.
     * @param {string} concept
     * @returns {Promise<{short: Object|null, long: Object|null}>}
     */
    async getVideos(concept) {
        if (!concept || !String(concept).trim()) return { ...EMPTY };

        const key = normalizeTerm(concept);
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey) {
            console.warn('VideoService: YOUTUBE_API_KEY is not configured; returning no videos.');
            return { ...EMPTY };
        }

        try {
            const search = await axios.get(SEARCH_URL, {
                params: {
                    q: `${concept} explained`,
                    type: 'video',
                    videoEmbeddable: 'true',
                    safeSearch: 'strict',
                    maxResults: 10,
                    part: 'snippet',
                    key: apiKey
                },
                timeout: 10000
            });

            const ids = (search.data.items || [])
                .map(item => item.id && item.id.videoId)
                .filter(Boolean);

            if (ids.length === 0) return { ...EMPTY };

            const details = await axios.get(VIDEOS_URL, {
                params: {
                    id: ids.join(','),
                    part: 'contentDetails,snippet',
                    key: apiKey
                },
                timeout: 10000
            });

            const byId = new Map((details.data.items || []).map(item => [item.id, item]));

            let short = null;
            let long = null;

            // Walk in original relevance order.
            for (const id of ids) {
                const item = byId.get(id);
                if (!item) continue;

                const seconds = parseIsoDuration(item.contentDetails && item.contentDetails.duration);
                if (seconds <= 0) continue;

                if (!short && seconds < SHORT_MAX_SECONDS) short = toVideo(item, seconds);
                else if (!long && seconds > LONG_MIN_SECONDS) long = toVideo(item, seconds);

                if (short && long) break;
            }

            const result = { short, long };
            this.cache.set(key, result);
            return result;
        } catch (error) {
            // Never let a quota/network/key failure crash the request.
            console.error('VideoService: YouTube lookup failed:', error.message);
            return { ...EMPTY };
        }
    }
}

module.exports = new VideoService();
