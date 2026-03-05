import { Router } from 'express';
import multer from 'multer';
import { uploadFile, deleteFile, getSignedUrl } from './storage.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Todas las rutas de storage requieren auth
router.use(authMiddleware);

// POST /api/storage/upload  (multipart/form-data)
router.post('/upload', upload.single('file'), uploadFile);

// DELETE /api/storage/delete
router.delete('/delete', deleteFile);

// POST /api/storage/signed-url
router.post('/signed-url', getSignedUrl);

export default router;
