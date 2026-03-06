import { Router } from 'express';
import { getAllUsers, getUserById, updateUser, deleteUser, createArtist } from './users.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/role.middleware';
import { UserRoleEnum } from '../../enum/roles.enum';

const router = Router();

// Todas las rutas de users requieren auth
router.use(authMiddleware);

// GET /api/users - Solo admin y soporte pueden ver todos los usuarios
router.get('/', roleGuard(UserRoleEnum.ADMIN, UserRoleEnum.SOPORTE), getAllUsers);

/**
 * @swagger
 * /users/artists:
 *   post:
 *     summary: Admin creates a new artist profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.post('/artists', roleGuard(UserRoleEnum.ADMIN), createArtist);

// GET /api/users/:id
router.get('/:id', getUserById);

// PUT /api/users/:id
router.put('/:id', updateUser);

// DELETE /api/users/:id
router.delete('/:id', deleteUser);

export default router;
