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
 *     summary: Obtener mi perfil de artista (Solo artistas)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Mi perfil de artista
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ArtistProfileRecord' }
 */
router.get('/me', roleGuard(UserRoleEnum.ARTISTA), getMyProfile);

/**
 * @swagger
 * /artist-profiles:
 *   get:
 *     tags: [Artist Profile]
 *     summary: Listar y filtrar perfiles de artistas
 *     parameters:
 *       - name: genre
 *         in: query
 *         schema: { type: string }
 *         description: Filtrar por género musical
 *       - name: city
 *         in: query
 *         schema: { type: string }
 *         description: Filtrar por ciudad
 *       - name: minPrice
 *         in: query
 *         schema: { type: number }
 *       - name: maxPrice
 *         in: query
 *         schema: { type: number }
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *         description: Búsqueda por nombre o biografía
 *       - name: availableToday
 *         in: query
 *         schema: { type: string, enum: [true, false] }
 *         description: Mostrar solo artistas disponibles hoy
 *       - name: date
 *         in: query
 *         schema: { type: string, example: '2026-04-26' }
 *         description: Fecha local del usuario (YYYY-MM-DD) para evaluar disponibilidad
 *     responses:
 *       200:
 *         description: Lista de perfiles de artistas filtrada
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/ArtistProfileRecord' }
 */
router.get('/', listArtistProfiles);

/**
 * @swagger
 * /artist-profiles/{id}:
 *   get:
 *     tags: [Artist Profile]
 *     summary: Obtener perfil por ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Perfil detallado del artista
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ArtistProfileRecord' }
 */
router.get('/:id', getArtistProfileById);

/**
 * @swagger
 * /artist-profiles/{id}/availability:
 *   get:
 *     tags: [Artist Profile]
 *     summary: Obtener disponibilidad del artista
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Estados de fechas (blocked, reserved, pending)
 */
router.get('/:id/availability', getArtistAvailability);

/**
 * @swagger
 * /artist-profiles:
 *   put:
 *     tags: [Artist Profile]
 *     summary: Crear o actualizar mi perfil (Form-Data)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               biography: { type: string }
 *               genre: { type: string }
 *               city: { type: string }
 *               photo: { type: string, format: binary }
 *               rider: { type: string, format: binary }
 *               socialNetworks: { type: string, description: 'JSON stringified social networks object' }
 *               media: { type: string, description: 'JSON stringified media items array' }
 *               songs: { type: string, description: 'JSON stringified songs array' }
 *     responses:
 *       200:
 *         description: Perfil guardado exitosamente
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
 *     summary: Añadir archivos a la galería (Solo artistas)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               media:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Archivos subidos y añadidos a la galería
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
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url]
 *             properties:
 *               url: { type: string, example: 'https://storage.../gallery_123.jpg' }
 *     responses:
 *       200:
 *         description: Archivo eliminado de la galería y del storage
 */
router.delete(
    '/media',
    roleGuard(UserRoleEnum.ARTISTA),
    removeMediaFromGallery
);

export default router;
