import * as aiProvider from '../services/ai/aiProvider.js';
import promptService from '../services/ai/promptService.js';

const handleTestPrompt = async (c) => {
    try {
        const env = c.env;
        const { prompt } = await c.req.json();

        if (!prompt || typeof prompt !== 'string') {
            return c.json({ success: false, error: 'A valid text prompt is required.' }, 400);
        }

        const formattedPrompt = promptService.formatTestPrompt(prompt);

        // Expose generateResponse(env, prompt) seamlessly as requested
        const response = await aiProvider.generateResponse(env, formattedPrompt);

        return c.json({
            success: true,
            response: response
        }, 200);
    } catch (error) {
        console.error('AI Test Route Error:', error.message);
        return c.json({
            success: false,
            error: error.message
        }, 503);
    }
};

export { handleTestPrompt };
