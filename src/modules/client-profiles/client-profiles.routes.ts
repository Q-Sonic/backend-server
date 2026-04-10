import { Router } from 'express';
import multer from 'multer';
import { getMyProfile, getClientProfileById, createOrUpdateProfile } from './client-profiles.controller';
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
 * tags:
 *   name: Client Profile
 *   description: Perfil privado del cliente (US-6, US-7)
 */

/**
 * @swagger
 * /client-profiles/me:
 *   get:
 *     tags: [Client Profile]
 *     summary: Obtener mi perfil de cliente
 *     security: [{ bearerAuth: [] }]
 */
router.get('/me', roleGuard(UserRoleEnum.CLIENTE), getMyProfile);

/**
 * @swagger
 * /client-profiles/{id}:
 *   get:
 *     tags: [Client Profile]
 *     summary: Obtener perfil de cliente por ID (Admin/Soporte)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Datos del perfil del cliente
 */
router.get('/:id', roleGuard(UserRoleEnum.ADMIN, UserRoleEnum.SOPORTE), getClientProfileById);

/**
 * @swagger
 * /client-profiles:
 *   put:
 *     tags: [Client Profile]
 *     summary: Crear o actualizar mi perfil de cliente
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: 'Comprador Anonimo' }
 *               phone: { type: string, example: '+54 11 1234-5678' }
 *               location: { type: string, example: 'CABA' }
 *               photo: { type: string, format: binary }
 */
router.put('/', roleGuard(UserRoleEnum.CLIENTE), upload.single('photo'), createOrUpdateProfile);

export default router;
