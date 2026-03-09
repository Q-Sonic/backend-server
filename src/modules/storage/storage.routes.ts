import { Router } from 'express';
import multer from 'multer';
import { uploadFile, deleteFile, getSignedUrl } from './storage.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { MAX_VIDEO_SIZE } from '../../helper/storage';

const router = Router();
// Limit for generic upload (images, short videos, audio). Validation by type in controller.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_VIDEO_SIZE },
});

// Todas las rutas de storage requieren auth
router.use(authMiddleware);

// POST /api/storage/upload  (multipart/form-data)
router.post('/upload', upload.single('file'), uploadFile);

// DELETE /api/storage/delete
router.delete('/delete', deleteFile);

// POST /api/storage/signed-url
router.post('/signed-url', getSignedUrl);

export default router;
