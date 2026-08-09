const aiProvider = require('../services/ai/aiProvider');
const promptService = require('../services/ai/promptService');

const handleTestPrompt = async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ success: false, error: 'A valid text prompt is required.' });
        }

        const formattedPrompt = promptService.formatTestPrompt(prompt);
        
        // Expose generateResponse(prompt) seamlessly as requested
        const response = await aiProvider.generateResponse(formattedPrompt);

        return res.status(200).json({
            success: true,
            response: response
        });
    } catch (error) {
        console.error('AI Test Route Error:', error.message);
        return res.status(503).json({
            success: false,
            error: error.message
        });
    }
};

module.exports = {
    handleTestPrompt
};
