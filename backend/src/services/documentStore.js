class DocumentStore {
    constructor() {
        this.documents = new Map();
        this.buffers = new Map();
        this.sampleTexts = new Map();
        // Owner mapping is kept OUT of the `documents` map on purpose: document
        // objects are serialized directly into API responses, and the owner id
        // (the raw identity cookie value) must never round-trip back to the client.
        this.owners = new Map();
    }

    saveBuffer(id, buffer) { this.buffers.set(id, buffer); }
    getBuffer(id) { return this.buffers.get(id) || null; }
    saveSampleText(id, text) { this.sampleTexts.set(id, text); }
    getSampleText(id) { return this.sampleTexts.get(id) || null; }

    saveDocument(document, ownerId) {
        this.documents.set(document.id, document);
        this.owners.set(document.id, ownerId);
    }

    getDocument(id) {
        const doc = this.documents.get(id);
        return doc && !doc.deleted ? doc : null;
    }

    getOwner(id) { return this.owners.get(id) || null; }

    updateConcepts(id, concepts) {
        const doc = this.documents.get(id);
        if (doc) { doc.concepts = concepts; }
    }

    /**
     * Total bytes attributed to an owner across their non-deleted documents.
     * Sums the actual stored upload size per document — never re-parses a PDF.
     */
    getUsageBytes(ownerId) {
        let total = 0;
        for (const [id, doc] of this.documents.entries()) {
            if (!doc.deleted && this.owners.get(id) === ownerId) total += doc.sizeBytes || 0;
        }
        return total;
    }

    listDocuments(ownerId) {
        return [...this.documents.entries()]
            .filter(([id, doc]) => !doc.deleted && this.owners.get(id) === ownerId)
            .map(([, doc]) => doc)
            .sort((a, b) => new Date(b.metadata?.createdAt || 0) - new Date(a.metadata?.createdAt || 0));
    }

    /**
     * Soft-deletes a document (only if the requester owns it) and releases its
     * buffer/sample-text memory to actually free the quota it was consuming.
     * Left in the map (marked deleted) rather than removed, so a browser still
     * holding the old id sees a clean "not found" instead of the id silently
     * resurrecting if re-inserted elsewhere.
     * @returns {boolean} whether a document was actually deleted
     */
    deleteDocument(id, ownerId) {
        const doc = this.documents.get(id);
        if (!doc || doc.deleted || this.owners.get(id) !== ownerId) return false;
        doc.deleted = true;
        this.buffers.delete(id);
        this.sampleTexts.delete(id);
        return true;
    }
}

module.exports = new DocumentStore();
