import { Router } from 'express';
import multer from 'multer';
import {
    listMyServices,
    getServiceById,
    createService,
    updateService,
    deleteService,
    listAllServicesByArtistId,
} from './artist-services.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/role.middleware';
import { UserRoleEnum } from '../../enum/roles.enum';
import { MAX_IMAGE_SIZE } from '../../helper/storage';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_SIZE },
});

router.use(authMiddleware);

/**
 * @swagger
 * /artist-services:
 *   get:
 *     tags: [Artist Services]
 *     summary: Listar mis servicios (solo artistas)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', listMyServices);

/**
 * @swagger
 * /artist-services/all/{artistId}:
 *   get:
 *     tags: [Artist Services]
 *     summary: Listar servicios por ID de artista (público)
 *     parameters:
 *       - in: path
 *         name: artistId
 *         required: true
 *         schema: { type: string }
 */
router.get('/all/:artistId', listAllServicesByArtistId);

/**
 * @swagger
 * /artist-services/{id}:
 *   get:
 *     tags: [Artist Services]
 *     summary: Obtener detalle de un servicio
 */
router.get('/:id', getServiceById);

/**
 * @swagger
 * /artist-services:
 *   post:
 *     tags: [Artist Services]
 *     summary: Crear un nuevo servicio musical
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price]
 *             properties:
 *               name: { type: string, example: 'Show en vivo' }
 *               price: { type: number, example: 500 }
 *               description: { type: string, example: 'Presentación completa...' }
 *               duration: { type: string, example: '60-90 min' }
 *               features: { type: array, items: { type: string }, example: ['Equipo de sonido incluido', 'Luces'] }
 */
router.post('/', roleGuard(UserRoleEnum.ARTISTA), upload.single('image'), createService);

/**
 * @swagger
 * /artist-services/{id}:
 *   put:
 *     tags: [Artist Services]
 *     summary: Actualizar un servicio existente
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               price: { type: number }
 *               description: { type: string }
 *               duration: { type: string }
 *               features: { type: array, items: { type: string } }
 */
router.put('/:id', roleGuard(UserRoleEnum.ARTISTA), upload.single('image'), updateService);

/**
 * @swagger
 * /artist-services/{id}:
 *   delete:
 *     tags: [Artist Services]
 *     summary: Eliminar un servicio
 *     security: [{ bearerAuth: [] }]
 */
router.delete('/:id', roleGuard(UserRoleEnum.ARTISTA, UserRoleEnum.ADMIN), deleteService);

export default router;
