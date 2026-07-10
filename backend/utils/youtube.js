const axios = require('axios');

/**
 * Searches YouTube for relevant videos.
 * Try official API if key is present, otherwise scrape, and fallback if both fail.
 * 
 * @param {string} query The concept name or search query
 * @returns {Promise<Array<{id: string, title: string, thumbnail: string, url: string}>>}
 */
async function searchYouTube(query) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const searchQuery = `${query} educational explanation`;

  if (apiKey && apiKey !== 'your_optional_youtube_api_key_here') {
    try {
      console.log(`Using YouTube API for search: "${searchQuery}"`);
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: searchQuery,
          maxResults: 3,
          type: 'video',
          key: apiKey
        }
      });

      if (response.data && response.data.items) {
        return response.data.items.map(item => ({
          id: item.id.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));
      }
    } catch (apiError) {
      console.error('YouTube API search failed, falling back to scraper:', apiError.message);
    }
  }

  // Fallback to Scraper
  try {
    console.log(`Using Scraper for YouTube search: "${searchQuery}"`);
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    
    // Set a normal browser user-agent to prevent immediate blocking
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    });

    const html = response.data;
    
    // Search for ytInitialData JSON structure in script tag
    const ytDataMatch = html.match(/ytInitialData\s*=\s*({.+?});/);
    if (ytDataMatch) {
      const data = JSON.parse(ytDataMatch[1]);
      
      // Safely navigate the nested object structure of ytInitialData
      const contents = data?.contents?.twoColumnSearchResultRenderer?.primaryContents?.sectionListRenderer?.contents;
      if (contents && contents.length > 0) {
        // Find the itemSectionRenderer
        const itemSection = contents.find(c => c.itemSectionRenderer)?.itemSectionRenderer;
        const videoItems = itemSection?.contents || [];
        
        // Filter out ads, shelfRenderers, etc. and keep only videoRenderer
        const videos = videoItems
          .filter(item => item.videoRenderer && item.videoRenderer.videoId)
          .map(item => {
            const vr = item.videoRenderer;
            const videoId = vr.videoId;
            const title = vr.title?.runs?.[0]?.text || 'Educational Video';
            const thumbnail = vr.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            return {
              id: videoId,
              title: title,
              thumbnail: thumbnail,
              url: `https://www.youtube.com/watch?v=${videoId}`
            };
          });

        if (videos.length >= 3) {
          return videos.slice(0, 3);
        }
      }
    }
  } catch (scraperError) {
    console.error('YouTube scraping failed, using query link generators:', scraperError.message);
  }

  // Final Fallback: Generate custom high-quality YouTube search direct links with descriptive placeholders
  console.log(`Generating fallback video items for: "${query}"`);
  
  // Custom video templates tailored to the query
  return [
    {
      id: 'fallback-1-' + encodeURIComponent(query),
      title: `Introduction to ${query} | Crash Course Educational Lesson`,
      thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=480&auto=format&fit=crop&q=60',
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' explanation')}`
    },
    {
      id: 'fallback-2-' + encodeURIComponent(query),
      title: `${query} Explained Simply (Mental Models & Visuals)`,
      thumbnail: 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=480&auto=format&fit=crop&q=60',
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' real world examples')}`
    },
    {
      id: 'fallback-3-' + encodeURIComponent(query),
      title: `Deep Dive into ${query} - Key Principles and Applications`,
      thumbnail: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=480&auto=format&fit=crop&q=60',
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' tutorial')}`
    }
  ];
}

module.exports = {
  searchYouTube
};
