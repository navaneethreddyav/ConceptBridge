import axios from 'axios';
import * as modelManager from './modelManager.js';

/**
 * Checks if the local Ollama instance is reachable.
 * @returns {Promise<boolean>}
 */
const isAvailable = async (env) => {
    try {
        const url = `${modelManager.getOllamaUrl(env)}/api/tags`;
        await axios.get(url, { timeout: 3000 });
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Sends a prompt to the local Ollama model and gets the response.
 * @param {Object} env
 * @param {string} prompt - The final formatted prompt
 * @returns {Promise<string>} - The model's response text
 */
const generateResponse = async (env, prompt) => {
    const available = await isAvailable(env);
    if (!available) {
        throw new Error(`Ollama service is unavailable at ${modelManager.getOllamaUrl(env)}. Please ensure Ollama is installed and running.`);
    }

    const url = `${modelManager.getOllamaUrl(env)}/api/generate`;
    const payload = {
        model: modelManager.getCurrentModel(env),
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
            throw new Error(`Model '${modelManager.getCurrentModel(env)}' not found in Ollama. Please run 'ollama run ${modelManager.getCurrentModel(env)}' to install it.`);
        }
        throw new Error('Failed to generate response from Ollama.');
    }
};

export { isAvailable, generateResponse };
