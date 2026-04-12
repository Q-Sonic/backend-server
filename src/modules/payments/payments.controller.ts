import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { Logger } from '../../utils/logger.util';

/**
 * Payments Controller
 * Handles HTTP requests for payment initialization and webhook callbacks.
 */
export class PaymentsController {
    /**
     * POST /api/payments/link-to-pay
     * Generates a payment link to redirect the user to Nuvei (Paymentez).
     */
    static async createLinkToPay(req: Request, res: Response) {
        const { amount, description, dev_reference } = req.body;
        const user = (req as any).user; // From authenticate middleware

        if (!amount || !description || !dev_reference) {
            return sendError({ res, error: 'Faltan parámetros de pago (amount, description, dev_reference)', statusCode: 400 });
        }

        try {
            const data = await PaymentsService.createLinkToPay({
                amount,
                description,
                dev_reference,
                user_email: user.email,
                user_id: user.uid,
            });

            return sendSuccess(res, data, 'Link de pago generado exitosamente');
        } catch (error: any) {
            Logger.error('[PaymentsController] Error:', error.message);
            return sendError({ res, error: error.message || 'Error al generar el link de pago', statusCode: 500 });
        }
    }

    /**
     * POST /api/payments/webhook
     * Callback received from Nuvei for transaction status updates.
     */
    static async handleWebhook(req: Request, res: Response) {
        try {
            // Nuvei sends the data in the body
            const result = await PaymentsService.processWebhook(req.body);
            
            // Nuvei expects a 200 OK to stop retrying the webhook
            return sendSuccess(res, result, 'Webhook procesado exitosamente');
        } catch (error: any) {
            Logger.error('[PaymentsController Webhook] Error:', error.message);
            // We still return 200 or 204 to Nuvei to avoid redundant retries
            return res.status(200).send('Webhook error handled');
        }
    }
}
