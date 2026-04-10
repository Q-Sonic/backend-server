import { Router } from 'express';
import * as paymentsController from './payments.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/payments/link-to-pay:
 *   post:
 *     summary: Generate a payment link via Nuvei Link To Pay
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, description, dev_reference]
 *             properties:
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *               dev_reference:
 *                 type: string
 *     responses:
 *       200:
 *         description: Link generated
 */
router.post('/link-to-pay', authMiddleware, paymentsController.createLinkToPay);

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Webhook callback for Nuvei
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Callback received
 */
router.post('/webhook', paymentsController.handleWebhook);

/**
 * @swagger
 * /api/payments/refund:
 *   post:
 *     summary: Process a refund for a transaction
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [transactionId]
 *             properties:
 *               transactionId:
 *                 type: string
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Refund processed
 */
router.post('/refund', authMiddleware, paymentsController.refund);

/**
 * @swagger
 * /api/payments/withdraw:
 *   post:
 *     summary: Request a withdrawal of artist balance
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Withdrawal successful
 */
router.post('/withdraw', authMiddleware, paymentsController.withdraw);

export default router;
