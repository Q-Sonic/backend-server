import { Router } from 'express';
import { getAllUsers, getUserById, updateUser, deleteUser } from './users.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/role.middleware';

const router = Router();

// Todas las rutas de users requieren auth
router.use(authMiddleware);

// GET /api/users - Solo admin y soporte pueden ver todos los usuarios
router.get('/', roleGuard('admin', 'soporte'), getAllUsers);

// GET /api/users/:id
router.get('/:id', getUserById);

// PUT /api/users/:id
router.put('/:id', updateUser);

// DELETE /api/users/:id
router.delete('/:id', deleteUser);

export default router;
