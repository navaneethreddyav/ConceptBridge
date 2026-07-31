/**
 * In-memory store for documents to enable caching of extraction and concepts.
 */
class DocumentStore {
    constructor() {
        this.documents = new Map();
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
