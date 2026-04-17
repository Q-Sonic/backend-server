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
        const user = (req as any).user;

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

    /**
     * POST /api/payments/withdraw
     * Process a withdrawal request from an artist.
     */
    static async withdraw(req: Request, res: Response) {
        const { amount, bankDetails } = req.body;
        const user = (req as any).user;

        if (!amount || !bankDetails) {
            return sendError({ res, error: 'Faltan parámetros (amount, bankDetails)', statusCode: 400 });
        }

        try {
            const data = await PaymentsService.requestWithdraw(user.uid, {
                amount,
                bankDetails
            });

            return sendSuccess(res, data, 'Solicitud de retiro procesada exitosamente');
        } catch (error: any) {
            return sendError({ res, error: error.message || 'Error al procesar el retiro', statusCode: 500 });
        }
    }

    /**
     * PUT /api/payments/admin/withdrawals/:id
     * Update status (COMPLETED/REJECTED) - Admin Only.
     */
    static async updateWithdrawalStatus(req: Request, res: Response) {
        const { id } = req.params;
        const { status, reason } = req.body;
        const user = (req as any).user;

        if (!status) {
            return sendError({ res, error: 'Faltan parámetros (status)', statusCode: 400 });
        }

        try {
            const data = await PaymentsService.updateWithdrawalStatus(
                user.uid, 
                id as string, 
                status as any, 
                reason as string
            );
            return sendSuccess(res, data, `Solicitud de retiro actualizada a ${status}`);
        } catch (error: any) {
            Logger.error('[PaymentsController Admin] Error:', error.message);
            return sendError({ res, error: error.message || 'Error al actualizar el retiro', statusCode: 500 });
        }
    }

    /**
     * GET /api/payments/withdrawals
     * Get withdrawal requests for the authenticated artist.
     */
    static async getArtistWithdrawals(req: Request, res: Response) {
        const user = (req as any).user;
        try {
            const data = await PaymentsService.getArtistWithdrawals(user.uid);
            return sendSuccess(res, data, 'Historial de retiros obtenido');
        } catch (error: any) {
            return sendError({ res, error: error.message, statusCode: 500 });
        }
    }

    /**
     * GET /api/payments/transactions
     * Get wallet transactions for the authenticated artist.
     */
    static async getArtistTransactions(req: Request, res: Response) {
        const user = (req as any).user;
        try {
            const data = await PaymentsService.getArtistTransactions(user.uid);
            return sendSuccess(res, data, 'Historial de transacciones obtenido');
        } catch (error: any) {
            return sendError({ res, error: error.message, statusCode: 500 });
        }
    }

    /**
     * GET /api/payments/admin/withdrawals
     * Get all withdrawal requests (Admin Only).
     */
    static async getAllWithdrawals(req: Request, res: Response) {
        const { status } = req.query;
        try {
            const data = await PaymentsService.getAllWithdrawals(status as string);
            return sendSuccess(res, data, 'Listado de solicitudes obtenido');
        } catch (error: any) {
            return sendError({ res, error: error.message, statusCode: 500 });
        }
    }
}
