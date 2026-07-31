require('dotenv').config();

class ModelManager {
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        this.currentModel = process.env.OLLAMA_MODEL || 'llama3';
    }

    getOllamaUrl() {
        return this.ollamaUrl;
    }

    getCurrentModel() {
        return this.currentModel;
    }
}

module.exports = new ModelManager();
