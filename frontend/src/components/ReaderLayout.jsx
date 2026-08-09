import React, { useState } from 'react';
import DocumentReader from './DocumentReader';
import ConceptSidebar from './ConceptSidebar';

const ReaderLayout = ({ document: doc }) => {
    const [selection, setSelection] = useState(null);

    return (
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
            <div className="flex-1 min-h-0 min-w-0">
                <DocumentReader document={doc} onSelect={setSelection} />
            </div>

            {selection && (
                <ConceptSidebar
                    selection={selection}
                    documentId={doc.id}
                    onClose={() => setSelection(null)}
                />
            )}
        </div>
    );
};

export default ReaderLayout;
