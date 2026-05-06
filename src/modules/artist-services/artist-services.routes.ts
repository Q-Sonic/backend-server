import { Router } from 'express';
import multer from 'multer';
import {
    listMyServices,
    getServiceById,
    createService,
    updateService,
    deleteService,
    listAllServicesByArtistId,
    listBookableServicesForClientByArtistId,
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
 *     summary: Listar mis servicios (incluye contract y technicalRider)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de servicios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ArtistServiceRecord' }
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
 *     responses:
 *       200:
 *         description: Lista de servicios del artista
 */
router.get('/all/:artistId', listAllServicesByArtistId);

/**
 * Client-visible catalog: services that have both contract and technical rider documents linked.
 * Must be registered before `/:id` so `client` is not captured as a service id.
 */
router.get('/client/:artistId', listBookableServicesForClientByArtistId);

/**
 * @swagger
 * /artist-services/{id}:
 *   get:
 *     tags: [Artist Services]
 *     summary: Obtener detalle de un servicio (incluye contract y technicalRider)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Detalle del servicio
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/ArtistServiceRecord' }
 */
router.get('/:id', getServiceById);

/**
 * @swagger
 * /artist-services:
 *   post:
 *     tags: [Artist Services]
 *     summary: Crear un nuevo servicio musical (solo name y price son obligatorios)
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
 *               contractId: { type: string, example: 'fileContract123' }
 *               technicalRiderId: { type: string, example: 'fileRider123' }
 *     responses:
 *       201:
 *         description: Servicio creado
 */
router.post('/', roleGuard(UserRoleEnum.ARTISTA), upload.single('image'), createService);

/**
 * @swagger
 * /artist-services/{id}:
 *   put:
 *     tags: [Artist Services]
 *     summary: Actualizar un servicio existente (valida ownership/tipo de archivos si envias IDs)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
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
 *               contractId: { type: string, example: 'fileContract123' }
 *               technicalRiderId: { type: string, example: 'fileRider123' }
 *     responses:
 *       200:
 *         description: Servicio actualizado
 */
router.put('/:id', roleGuard(UserRoleEnum.ARTISTA), upload.single('image'), updateService);

/**
 * @swagger
 * /artist-services/{id}:
 *   delete:
 *     tags: [Artist Services]
 *     summary: Eliminar un servicio
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Servicio eliminado
 */
router.delete('/:id', roleGuard(UserRoleEnum.ARTISTA, UserRoleEnum.ADMIN), deleteService);

export default router;
