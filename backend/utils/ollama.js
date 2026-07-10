const axios = require('axios');

/**
 * Queries a local Ollama instance for structured JSON explanations.
 * Assumes Ollama is running locally.
 * 
 * @param {string} prompt User prompt describing concept or selection
 * @param {string} systemPrompt System guidelines for JSON structure
 * @returns {Promise<object>} Parsed JSON response
 */
async function queryOllama(prompt, systemPrompt) {
  const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct';
  
  console.log(`Querying local Ollama model "${model}" at: ${host}/api/generate`);

  try {
    const response = await axios.post(`${host}/api/generate`, {
      model: model,
      prompt: prompt,
      system: systemPrompt,
      format: 'json',
      stream: false,
      options: {
        temperature: 0.5
      }
    }, {
      timeout: 30000 // 30-second timeout for local inference
    });

    if (response.data && response.data.response) {
      return JSON.parse(response.data.response);
    }
    throw new Error('Empty response from local Ollama model.');
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error(`Ollama connection refused at ${host}. Make sure Ollama is running: "ollama serve"`);
      throw new Error(`Local Ollama service is offline. Please start Ollama ("ollama serve") and run model "${model}".`);
    }
    console.error('Ollama request failed:', error.message);
    throw error;
  }
}

module.exports = {
  queryOllama
};
