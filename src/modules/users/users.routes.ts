import { Router } from 'express';
import { getAllUsers, getUserById, updateUser, deleteUser, createArtist } from './users.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/role.middleware';
import { UserRoleEnum } from '../../enum/roles.enum';

const router = Router();

// Todas las rutas de users requieren auth
router.use(authMiddleware);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Listar todos los usuarios (Admin/Soporte)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de usuarios
 */
router.get('/', roleGuard(UserRoleEnum.ADMIN, UserRoleEnum.SOPORTE), getAllUsers);

/**
 * @swagger
 * /users/artists:
 *   post:
 *     summary: El Admin crea un nuevo perfil de artista manualmente
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, displayName]
 *             properties:
 *               email: { type: string }
 *               displayName: { type: string }
 */
router.post('/artists', roleGuard(UserRoleEnum.ADMIN), createArtist);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Obtener datos de un usuario por ID
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Datos del usuario
 */
router.get('/:id', getUserById);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Actualizar datos de un usuario
 *     tags: [Users]
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
 *               displayName: { type: string }
 *               email: { type: string }
 *               role: { type: string, enum: [admin, soporte, artista, cliente, organizacion] }
 *     responses:
 *       200:
 *         description: Usuario actualizado
 */
router.put('/:id', updateUser);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Eliminar un usuario
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
router.delete('/:id', deleteUser);

export default router;
