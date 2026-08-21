import ConceptParser from '../conceptParser.js';

/**
 * Robustly parses AI JSON output for explanations.
 * Reusing the core regex extraction logic from ConceptParser to ensure stability.
 */
class ExplanationParser {
    static parse(rawResponse) {
        return ConceptParser.parse(rawResponse);
    }
}

export default ExplanationParser;
