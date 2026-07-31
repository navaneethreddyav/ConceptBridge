import React, { useState, useEffect } from 'react';
import { Loader2, Lightbulb, AlertCircle } from 'lucide-react';
import LearningModal from './LearningModal';

const ConceptList = React.memo(({ document }) => {
    const [concepts, setConcepts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [selectedConcept, setSelectedConcept] = useState(null);

    useEffect(() => {
        const detectConcepts = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await fetch('http://localhost:5000/api/concepts/detect', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        documentId: document.id,
                        text: document.content.rawText
                    })
                });

                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to detect concepts.');
                }
                
                setConcepts(data.concepts);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (document) {
            detectConcepts();
        }
    }, [document]);

    const handleConceptClick = (concept) => {
        setSelectedConcept(concept);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 border border-surface rounded-2xl bg-surface/20 mt-6">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                <p className="text-text-muted">AI is reading the document and identifying concepts...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-6 border border-red-500/20 rounded-2xl bg-red-500/5 mt-6">
                <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                <p className="text-red-400 text-center font-medium">Concept Detection Failed</p>
                <p className="text-text-muted text-sm text-center mt-2">{error}</p>
            </div>
        );
    }

    if (concepts.length === 0) {
        return null;
    }

    return (
        <div className="mt-8">
            <div className="flex items-center mb-4 space-x-2">
                <Lightbulb className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-bold">Concepts to Master</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {concepts.map((concept) => (
                    <div 
                        key={concept.id}
                        onClick={() => handleConceptClick(concept)}
                        className="bg-surface/40 hover:bg-surface border border-surface/50 rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:border-primary/30 flex flex-col h-full"
                    >
                        <h4 className="font-bold text-lg mb-2 line-clamp-1">{concept.name}</h4>
                        <p className="text-sm text-text-muted flex-grow line-clamp-3">
                            {concept.summary}
                        </p>
                        <div className="mt-4 flex items-center justify-between text-xs font-mono text-text-muted/70">
                            <span>Imp: {concept.importance}/10</span>
                            <span className="bg-background px-2 py-1 rounded">
                                {concept.section}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {selectedConcept && (
                <LearningModal 
                    concept={selectedConcept} 
                    documentId={document?.id} 
                    onClose={() => setSelectedConcept(null)} 
                />
            )}
        </div>
    );
});

export default ConceptList;
