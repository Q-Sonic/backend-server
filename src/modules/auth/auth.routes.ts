import { Router } from 'express';
import {
    register,
    getMe,
    login,
    googleLogin,
    verifyEmail,
    forgotPassword,
    verifyResetCode,
    resetPassword,
    changePassword,
    changeEmail,
    requestAccountChangeCode,
    verifyAccountChangeCode,
    getAccountChangeStatus,
} from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validate.middleware';
import { registerRequestSchema, loginRequestSchema } from '../../schemas/auth.schema';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario (Cliente/Artista/Soporte)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterBody' }
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/LoginResponse' }
 */
router.post('/register', validateRequest(registerRequestSchema), register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión con email y contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginBody' }
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/LoginResponse' }
 */
router.post('/login', validateRequest(loginRequestSchema), login);

/**
 * @swagger
 * /auth/google:
 *   post:
 *     summary: Iniciar sesión o registrarse con Google OAuth
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken: { type: string, description: 'ID Token obtenido de Google Auth SDK en el cliente' }
 *     responses:
 *       200:
 *         description: Autenticación exitosa. Devuelve un Custom Token para el cliente Firebase.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     customToken: { type: string, description: 'Usar con signInWithCustomToken de Firebase SDK' }
 *                     uid: { type: string }
 *                     role: { type: string }
 *                     isNewUser: { type: boolean }
 *                     user: { $ref: '#/components/schemas/UserRecord' }
 */
router.post('/google', googleLogin);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Solicitar código de recuperación de contraseña al email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Código enviado
 */
router.post('/forgot-password', forgotPassword);

/**
 * @swagger
 * /auth/verify-reset-code:
 *   post:
 *     summary: Verificar si el código de recuperación es válido
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string }
 *               code: { type: string }
 *     responses:
 *       200:
 *         description: Código válido
 */
router.post('/verify-reset-code', verifyResetCode);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Establecer nueva contraseña usando el código verificado
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code, newPassword]
 *             properties:
 *               email: { type: string }
 *               code: { type: string }
 *               newPassword: { type: string, minLength: 6 }
 */
router.post('/reset-password', resetPassword);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Obtener datos del usuario autenticado (desde el token)
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Datos de sesión
 */
router.get('/me', authMiddleware, getMe);

router.post('/change-password', authMiddleware, changePassword);
router.post('/change-email', authMiddleware, changeEmail);

router.post('/account-change/request-code', authMiddleware, requestAccountChangeCode);
router.post('/account-change/verify-code', authMiddleware, verifyAccountChangeCode);
router.get('/account-change/status', authMiddleware, getAccountChangeStatus);

export default router;
