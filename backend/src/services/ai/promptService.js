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
     * Formats the prompt for generating an educational explanation.
     * @param {string} conceptName 
     * @param {string} contextText 
     * @param {string} language 
     * @param {string} difficulty 
     * @returns {string}
     */
    static formatExplanationPrompt(conceptName, contextText, language = 'English', difficulty = 'Beginner') {
        const validatedLanguage = supportedLanguages.includes(language) ? language : 'English';
        
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
7. Return ONLY valid JSON in the exact format shown below. The JSON keys MUST remain in English, but the values MUST be written in ${validatedLanguage}. Do NOT use markdown.

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
    "difficulty": "${difficulty}"
}

Context Document:
---
${contextText.substring(0, 15000)}
---
`;
    }
}

module.exports = PromptService;
