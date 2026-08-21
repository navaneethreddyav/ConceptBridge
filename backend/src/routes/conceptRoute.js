import { Hono } from 'hono';
import { detectConcepts } from '../controllers/conceptController.js';

const conceptRoute = new Hono();

conceptRoute.post('/detect', detectConcepts);

export default conceptRoute;
