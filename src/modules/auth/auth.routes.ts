import { Router } from 'express';
import { register, getMe, login, googleLogin, verifyEmail, forgotPassword, verifyResetCode, resetPassword } from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/google  ← Login / Registro con Google OAuth
router.post('/google', googleLogin);

// POST /api/auth/verify-email (STUB)
router.post('/verify-email', verifyEmail);

// --- Recuperar Contraseña ---
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-code', verifyResetCode);
router.post('/reset-password', resetPassword);

// GET /api/auth/me  (protegida)
router.get('/me', authMiddleware, getMe);

export default router;
