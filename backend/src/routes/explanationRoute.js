import { Hono } from 'hono';
import { generateExplanation } from '../controllers/explanationController.js';

const explanationRoute = new Hono();

explanationRoute.post('/', generateExplanation);

export default explanationRoute;
