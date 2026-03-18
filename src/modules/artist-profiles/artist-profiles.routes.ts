import { Router } from 'express';
import multer from 'multer';
import { getMyProfile, listArtistProfiles, getArtistProfileById, getArtistAvailability, createOrUpdateProfile } from './artist-profiles.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/role.middleware';
import { UserRoleEnum } from '../../enum/roles.enum';
import { MAX_IMAGE_SIZE } from '../../helper/storage';
import { validateRequest } from '../../middleware/validate.middleware';
import { artistProfileSchema } from './artist-profiles.schema';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_SIZE },
});

router.use(authMiddleware);

/**
 * @swagger
 * /artist-profiles/me:
 *   get:
 *     tags: [Artist Profile]
 *     summary: Obtener mi perfil de artista
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: El perfil del artista
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiResponse' }
 */
router.get('/me', roleGuard(UserRoleEnum.ARTISTA), getMyProfile);

/**
 * @swagger
 * /artist-profiles:
 *   get:
 *     tags: [Artist Profile]
 *     summary: Listar todos los perfiles de artistas
 *     responses:
 *       200:
 *         description: Lista de perfiles
 */
router.get('/', roleGuard(UserRoleEnum.CLIENTE, UserRoleEnum.ADMIN, UserRoleEnum.ORGANIZACION, UserRoleEnum.SOPORTE), listArtistProfiles);

/**
 * @swagger
 * /artist-profiles/{id}:
 *   get:
 *     tags: [Artist Profile]
 *     summary: Obtener perfil por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
router.get('/:id', roleGuard(UserRoleEnum.ARTISTA, UserRoleEnum.CLIENTE, UserRoleEnum.ADMIN, UserRoleEnum.SOPORTE), getArtistProfileById);

/**
 * @swagger
 * /artist-profiles/{id}/availability:
 *   get:
 *     tags: [Artist Profile]
 *     summary: Obtener disponibilidad del artista
 */
router.get('/:id/availability', (req: any, res: any) => getArtistAvailability(req, res));

/**
 * @swagger
 * /artist-profiles:
 *   put:
 *     tags: [Artist Profile]
 *     summary: Crear o actualizar mi perfil
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema: { $ref: '#/components/schemas/CreateOrUpdateArtistProfileBody' }
 */
router.put(
    '/',
    roleGuard(UserRoleEnum.ARTISTA),
    upload.single('photo'),
    validateRequest(artistProfileSchema),
    createOrUpdateProfile
);

export default router;
