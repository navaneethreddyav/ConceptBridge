const ConceptParser = require('../conceptParser');

/**
 * Robustly parses AI JSON output for explanations.
 * Reusing the core regex extraction logic from ConceptParser to ensure stability.
 */
class ExplanationParser {
    static parse(rawResponse) {
        return ConceptParser.parse(rawResponse);
    }
}

module.exports = ExplanationParser;
