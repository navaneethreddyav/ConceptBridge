/**
 * In-memory store for documents to enable caching of extraction and concepts.
 */
class DocumentStore {
    constructor() {
        this.documents = new Map();
        // Kept separate from the document object, which is JSON-serialized in API responses.
        this.buffers = new Map();
        // The bounded (first-N-page) text sample — also kept off the document object so
        // it's never accidentally serialized into a response. Used for auto-detect input
        // and as the explanation-context fallback; never the full document text.
        this.sampleTexts = new Map();
    }

    /**
     * Stores the raw PDF bytes for a document.
     * @param {string} id
     * @param {Buffer} buffer
     */
    saveBuffer(id, buffer) {
        this.buffers.set(id, buffer);
    }

    /**
     * Retrieves the raw PDF bytes for a document.
     * @param {string} id
     * @returns {Buffer|null}
     */
    getBuffer(id) {
        return this.buffers.get(id) || null;
    }

    /**
     * Stores the bounded first-N-page text sample for a document.
     * @param {string} id
     * @param {string} text
     */
    saveSampleText(id, text) {
        this.sampleTexts.set(id, text);
    }

    /**
     * Retrieves the bounded text sample for a document.
     * @param {string} id
     * @returns {string|null}
     */
    getSampleText(id) {
        return this.sampleTexts.get(id) || null;
    }

    /**
     * Stores a document object.
     * @param {Object} document
     */
    saveDocument(document) {
        this.documents.set(document.id, document);
    }

    /**
     * Retrieves a document by ID.
     * @param {string} id 
     * @returns {Object|null}
     */
    getDocument(id) {
        return this.documents.get(id) || null;
    }

    /**
     * Updates the cached concepts for a document.
     * @param {string} id 
     * @param {Array} concepts 
     */
    updateConcepts(id, concepts) {
        const doc = this.getDocument(id);
        if (doc) {
            doc.concepts = concepts;
            this.saveDocument(doc);
        }
    }
}

module.exports = new DocumentStore();
