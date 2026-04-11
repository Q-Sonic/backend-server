import { Router } from 'express';
import { PaymentsController } from './payments.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

/**
 * Payments Endpoints
 * 
 * POST /api/payments/link-to-pay - Protected (requires logged-in user)
 * POST /api/payments/webhook    - Public (received from Nuvei)
 */
router.post('/link-to-pay', authMiddleware, PaymentsController.createLinkToPay);
router.post('/webhook', PaymentsController.handleWebhook);

export default router;
