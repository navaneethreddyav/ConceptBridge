const axios = require('axios');
const modelManager = require('./modelManager');

/**
 * Service to interact with the local Ollama instance.
 */
class OllamaService {
    /**
     * Checks if the Ollama service is reachable.
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            const url = `${modelManager.getOllamaUrl()}/api/tags`;
            await axios.get(url, { timeout: 3000 });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Sends a prompt to the local Ollama model and gets the response.
     * @param {string} prompt - The final formatted prompt
     * @returns {Promise<string>} - The model's response text
     */
    async generateResponse(prompt) {
        const available = await this.isAvailable();
        if (!available) {
            throw new Error(`Ollama service is unavailable at ${modelManager.getOllamaUrl()}. Please ensure Ollama is installed and running.`);
        }

        const url = `${modelManager.getOllamaUrl()}/api/generate`;
        const payload = {
            model: modelManager.getCurrentModel(),
            prompt: prompt,
            stream: false
        };

        try {
            const response = await axios.post(url, payload);
            if (response.data && response.data.response) {
                return response.data.response.trim();
            }
            throw new Error('Unexpected response format from Ollama.');
        } catch (error) {
            console.error('Ollama Generation Error:', error.message);
            if (error.response && error.response.status === 404) {
                throw new Error(`Model '${modelManager.getCurrentModel()}' not found in Ollama. Please run 'ollama run ${modelManager.getCurrentModel()}' to install it.`);
            }
            throw new Error('Failed to generate response from Ollama.');
        }
    }
}

module.exports = new OllamaService();
