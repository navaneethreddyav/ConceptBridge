/**
 * In-memory store for documents to enable caching of extraction and concepts.
 */
class DocumentStore {
    constructor() {
        this.documents = new Map();
        // Kept separate from the document object, which is JSON-serialized in API responses.
        this.buffers = new Map();
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
