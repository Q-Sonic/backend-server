import { Router } from 'express';
import { register, getMe, login } from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me  (protegida)
router.get('/me', authMiddleware, getMe);

export default router;
