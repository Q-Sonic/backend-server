import { Router } from 'express';
import { register, getMe, login, googleLogin, verifyEmail, forgotPassword, verifyResetCode, resetPassword } from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     tags: [Auth]
 */
router.post('/register', register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Auth]
 */
router.post('/login', login);

/**
 * @swagger
 * /auth/google:
 *   post:
 *     summary: Login con Google
 *     tags: [Auth]
 */
router.post('/google', googleLogin);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Solicitar recuperación de contraseña
 *     tags: [Auth]
 */
router.post('/forgot-password', forgotPassword);

/**
 * @swagger
 * /auth/verify-reset-code:
 *   post:
 *     summary: Verificar código de recuperación
 *     tags: [Auth]
 */
router.post('/verify-reset-code', verifyResetCode);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Restablecer contraseña
 *     tags: [Auth]
 */
router.post('/reset-password', resetPassword);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Obtener perfil actual (auth)
 *     tags: [Auth]
 */
router.get('/me', authMiddleware, getMe);

export default router;
