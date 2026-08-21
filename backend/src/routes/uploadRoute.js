import { Hono } from 'hono';
import {
    handleUpload,
    getDocumentFile,
    getDocumentPages,
    listDocuments,
    getUsage,
    deleteDocument
} from '../controllers/uploadController.js';

// Per-file size limit (50MB) is enforced by fileValidationService, called from
// handleUpload — there is no Multer-level limit to configure separately anymore
// (Hono/Workers has no streaming multipart size cap short of a manual Content-Length
// check), so validation staying in fileValidationService is the single source of truth.
const uploadRoute = new Hono();

uploadRoute.get('/', listDocuments);
uploadRoute.get('/usage', getUsage);
uploadRoute.post('/', handleUpload);
uploadRoute.get('/:id/file', getDocumentFile);
uploadRoute.get('/:id/pages', getDocumentPages);
uploadRoute.delete('/:id', deleteDocument);

export default uploadRoute;
