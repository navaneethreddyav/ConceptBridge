import { Hono } from 'hono';
import { getMedia } from '../controllers/mediaController.js';

const mediaRoute = new Hono();

mediaRoute.post('/', getMedia);

export default mediaRoute;
