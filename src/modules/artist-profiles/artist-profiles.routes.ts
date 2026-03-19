import { Router } from 'express';
import multer from 'multer';
import { 
    getMyProfile, 
    listArtistProfiles, 
    getArtistProfileById, 
    getArtistAvailability, 
    createOrUpdateProfile,
    addMediaToGallery,
    removeMediaFromGallery
} from './artist-profiles.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/role.middleware';
import { UserRoleEnum } from '../../enum/roles.enum';
import { MAX_VIDEO_SIZE } from '../../helper/storage';
import { validateRequest } from '../../middleware/validate.middleware';
import { artistProfileSchema } from './artist-profiles.schema';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_VIDEO_SIZE }, // Max limit (videos)
});

router.use(authMiddleware);

/**
 * @swagger
 * /artist-profiles/me:
 *   get:
 *     tags: [Artist Profile]
 *     summary: Obtener mi perfil de artista
 *     security: [{ bearerAuth: [] }]
 */
router.get('/me', roleGuard(UserRoleEnum.ARTISTA), getMyProfile);

/**
 * @swagger
 * /artist-profiles:
 *   get:
 *     tags: [Artist Profile]
 *     summary: Listar todos los perfiles de artistas
 */
router.get('/', listArtistProfiles);

/**
 * @swagger
 * /artist-profiles/{id}:
 *   get:
 *     tags: [Artist Profile]
 *     summary: Obtener perfil por ID
 */
router.get('/:id', getArtistProfileById);

/**
 * @swagger
 * /artist-profiles/{id}/availability:
 *   get:
 *     tags: [Artist Profile]
 *     summary: Obtener disponibilidad del artista
 */
router.get('/:id/availability', getArtistAvailability);

/**
 * @swagger
 * /artist-profiles:
 *   put:
 *     tags: [Artist Profile]
 *     summary: Crear o actualizar mi perfil
 */
router.put(
    '/',
    roleGuard(UserRoleEnum.ARTISTA),
    upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'rider', maxCount: 1 }]),
    validateRequest(artistProfileSchema),
    createOrUpdateProfile
);

/**
 * @swagger
 * /artist-profiles/media:
 *   post:
 *     tags: [Artist Profile]
 *     summary: Añadir archivos a la galería
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               media:
 *                 type: array
 *                 items: { type: string, format: binary }
 */
router.post(
    '/media',
    roleGuard(UserRoleEnum.ARTISTA),
    upload.array('media', 10),
    addMediaToGallery
);

/**
 * @swagger
 * /artist-profiles/media:
 *   delete:
 *     tags: [Artist Profile]
 *     summary: Eliminar archivo de la galería
 */
router.delete(
    '/media',
    roleGuard(UserRoleEnum.ARTISTA),
    removeMediaFromGallery
);

export default router;
