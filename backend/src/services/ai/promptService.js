const { supportedLanguages } = require('../../../../shared/supportedLanguages.json');

const CONTEXT_CHAR_LIMIT = 4000;

/**
 * Generates specific prompts for the AI model.
 */
class PromptService {
    /**
     * Formats a basic text prompt for testing.
     * @param {string} text - The input text
     * @returns {string} - The formatted prompt
     */
    static formatTestPrompt(text) {
        return `Please answer the following request concisely:\n\n${text}`;
    }
    
    /**
     * Formats the prompt for AI concept extraction.
     * @param {string} documentText - The text to extract concepts from
     * @returns {string} - The formatted prompt
     */
    static formatConceptExtractionPrompt(documentText) {
        return `
You are an expert educational AI. Your task is to analyze a portion of an educational document and identify the most important concepts discussed within it.

The AI should identify:
- definitions, algorithms, theories, protocols, architectures, formulas, standards, data structures, important terminology, processes, scientific concepts, mathematical concepts.

Ignore:
- filler text, acknowledgements, references, page numbers, table of contents, repeated headings.

Instructions:
1. Read the document chunk thoroughly.
2. Identify only meaningful, high-level educational concepts.
3. Remove any duplicate concepts.
4. You MUST return ONLY valid JSON in the exact format shown below. Do NOT use markdown. Do NOT write any conversational text.

Expected JSON format:
{
  "concepts": [
    {
      "id": "concept_1",
      "name": "Concept Name",
      "summary": "A concise 1-sentence summary of what this concept is in the context of the document.",
      "importance": 10,
      "confidence": 0.95,
      "page": null,
      "section": "The section or context where it was found",
      "keywords": ["keyword1", "keyword2"],
      "relatedConcepts": ["Related Concept 1"],
      "prerequisites": ["Prerequisite 1"]
    }
  ]
}
Note: If some fields cannot yet be generated, return empty arrays or null instead of removing them.

Document Chunk:
---
${documentText}
---
`;
    }
    /**
     * Formats the prompt for generating an educational explanation of selected text.
     * @param {string} conceptName - The text the reader selected
     * @param {string} contextBefore - Document text immediately preceding the selection
     * @param {string} contextAfter - Document text immediately following the selection
     * @param {string} language
     * @param {string} difficulty
     * @returns {string}
     */
    static formatExplanationPrompt(conceptName, contextBefore = '', contextAfter = '', language = 'English', difficulty = 'Beginner') {
        const validatedLanguage = supportedLanguages.includes(language) ? language : 'English';

        // Keep the text closest to the selection on both sides.
        const before = String(contextBefore || '').slice(-CONTEXT_CHAR_LIMIT);
        const after = String(contextAfter || '').slice(0, CONTEXT_CHAR_LIMIT);
        const contextText = `${before}\n[SELECTED TEXT: ${conceptName}]\n${after}`;

        return `
You are an expert, experienced, and deeply empathetic teacher. 
Your task is to explain the concept "${conceptName}" to a student at the "${difficulty}" level.

IMPORTANT: You MUST generate the explanation directly in ${validatedLanguage}. Do NOT generate in English first and translate. Think and write naturally in ${validatedLanguage}.

Instructions:
1. Explain in very simple, conversational ${validatedLanguage}, as if sitting beside the student.
2. NEVER assume prior knowledge. Avoid unnecessary technical jargon. If a technical word is necessary, explain it immediately.
3. Build understanding gradually. Prefer intuition before formal definitions.
4. Use a highly memorable, real-world analogy (culturally familiar if applicable).
5. Provide a step-by-step breakdown if applicable.
6. Base your explanation strictly on the context provided below.
7. Write the way a good teacher actually speaks ${validatedLanguage} — not a literal, dictionary-style translation. Keep widely used English technical terms (for example "algorithm", "voltage", "compiler") in English where that is how people genuinely say them; natural code-switching is expected. Technical accuracy is non-negotiable.
8. Return ONLY valid JSON in the exact format shown below. The JSON keys MUST remain in English, but the values MUST be written in ${validatedLanguage}. Do NOT use markdown.

Expected JSON format:
{
    "title": "The name of the concept in ${validatedLanguage}",
    "definition": "A simple, formal definition in ${validatedLanguage}",
    "simpleExplanation": "A highly intuitive, jargon-free explanation in ${validatedLanguage}",
    "whyItMatters": "Why is this important to learn? in ${validatedLanguage}",
    "stepByStepExplanation": ["Step 1 in ${validatedLanguage}...", "Step 2 in ${validatedLanguage}..."],
    "realLifeExample": "A practical example from everyday life in ${validatedLanguage}",
    "analogy": "A creative, memorable analogy in ${validatedLanguage}",
    "keyPoints": ["Key point 1 in ${validatedLanguage}", "Key point 2 in ${validatedLanguage}"],
    "commonMistakes": ["Common misconception 1 in ${validatedLanguage}"],
    "relatedConcepts": ["Related concept 1 in ${validatedLanguage}"],
    "difficulty": "${difficulty}",
    "visualSpec": {
        "type": "process | comparison | hierarchy | none",
        "title": "Very short diagram title in ${validatedLanguage}",
        "nodes": [{ "id": "n1", "label": "Short label in ${validatedLanguage}" }],
        "edges": [{ "from": "n1", "to": "n2", "label": "optional short label" }],
        "items": [{ "label": "Column title in ${validatedLanguage}", "points": ["Short point in ${validatedLanguage}"] }]
    }
}

Rules for "visualSpec" (optional, best-effort — a simple diagram that is rendered next to the explanation):
- Choose "process" for an ordered sequence of steps: supply 2-6 "nodes" and "edges" chaining them in order. Omit "items".
- Choose "hierarchy" for a parent concept with its parts/types: the FIRST node is the parent, the remaining 2-6 nodes are its children. Omit "edges" and "items".
- Choose "comparison" to contrast 2-3 alternatives: supply 2-3 "items", each with a short label and up to 5 short points (under 40 characters each). Omit "nodes" and "edges".
- If no diagram would genuinely help explain this concept, return { "type": "none" } and nothing else inside visualSpec. Never invent a diagram just to fill the field.
- Keep every node/item label under 40 characters. Labels are rendered as plain text inside small boxes.

Context Document (the reader selected the text marked [SELECTED TEXT: ...] below; explain it as used in this context):
---
${contextText}
---
`;
    }
}

module.exports = PromptService;
