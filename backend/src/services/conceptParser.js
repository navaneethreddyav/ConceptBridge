/**
 * Parses JSON output from the AI model robustly.
 */
class ConceptParser {
    /**
     * Parses the raw text output from Ollama into a JSON object.
     * @param {string} rawResponse - The AI's raw response
     * @returns {Object} - Parsed JSON containing { concepts: [] }
     */
    static parse(rawResponse) {
        if (!rawResponse) {
            throw new Error("Empty response from AI model.");
        }

        try {
            // Fast path: Try standard JSON parse first
            return JSON.parse(rawResponse);
        } catch (e) {
            // Slower path: Try to extract JSON using regex (often models wrap JSON in markdown blocks)
            const jsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
            const match = rawResponse.match(jsonRegex);
            
            if (match && match[1]) {
                try {
                    return JSON.parse(match[1]);
                } catch (innerError) {
                    // Fallthrough to brute force extraction
                }
            }

            // Brute force: Find the first '{' and last '}'
            const start = rawResponse.indexOf('{');
            const end = rawResponse.lastIndexOf('}');
            
            if (start !== -1 && end !== -1 && end > start) {
                try {
                    const extractedJsonString = rawResponse.slice(start, end + 1);
                    return JSON.parse(extractedJsonString);
                } catch (fallbackError) {
                    throw new Error("Could not parse the AI response as valid JSON.");
                }
            }
            
            throw new Error("AI response did not contain JSON structure.");
        }
    }
}

module.exports = ConceptParser;
