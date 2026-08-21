import { Hono } from 'hono';
import { handleTestPrompt } from '../controllers/aiController.js';

const aiRoute = new Hono();

aiRoute.post('/test', handleTestPrompt);

export default aiRoute;
