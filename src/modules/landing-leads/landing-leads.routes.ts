import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { sendError } from '../../utils/response.util';
import { LandingLeadsController } from './landing-leads.controller';

const router = Router();
const controller = new LandingLeadsController();

const landingLeadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Demasiadas solicitudes desde esta dirección. Intente más tarde.',
    handler: (req, res, _next, options) => {
        sendError({
            res,
            error: (options.message as string) || 'Too many requests',
            statusCode: 429,
        });
    },
});

/**
 * @swagger
 * /landing-leads:
 *   post:
 *     summary: Registrar interés desde la landing (sin autenticación)
 *     tags: [Landing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email]
 *             properties:
 *               fullName: { type: string, minLength: 2, maxLength: 120 }
 *               email: { type: string, format: email }
 *               inquiryType: { type: string, enum: [artist, client] }
 *     responses:
 *       201:
 *         description: Lead creado
 *       400:
 *         description: Validación fallida
 *       429:
 *         description: Rate limit
 */
router.post('/', landingLeadLimiter, (req, res) => controller.create(req, res));

export default router;
