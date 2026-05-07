import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthRequest } from '../../types';
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
        try {
            const { uid, email, displayName } = (req as AuthRequest).user!;
            const { amount, description, dev_reference } = req.body;

            if (!amount || !description || !dev_reference) {
                return sendError({ res, error: 'Faltan parámetros de pago (amount, description, dev_reference)', statusCode: 400 });
            }

            const nameParts = (displayName || 'User').split(' ');
            const name = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || 'N/A';

            const result = await PaymentsService.createPaymentLink({
                user: { 
                    id: uid, 
                    email: email || '', 
                    name, 
                    last_name: lastName 
                },
                order: {
                    dev_reference,
                    description,
                    amount: Number(amount)
                }
            });

            return sendSuccess(res, result, 'Link de pago generado exitosamente');
        } catch (error: any) {
            Logger.error('[PaymentsController] Error:', error.message);
            return sendError({ res, error: error.message || 'Error al generar el link de pago', statusCode: 500 });
        }
    }

    /**
     * POST /api/payments/checkout-reference
     * Initializes a Nuvei Checkout reference for the frontend SDK modal.
     */
    static async createCheckoutReference(req: Request, res: Response) {
        try {
            const { uid, email } = (req as AuthRequest).user!;
            const { amount, description, dev_reference } = req.body;

            if (!amount || !description || !dev_reference) {
                return sendError({ res, error: 'Faltan parámetros (amount, description, dev_reference)', statusCode: 400 });
            }

            const result = await PaymentsService.createCheckoutReference({
                userId: uid,
                userEmail: email || '',
                amount: Number(amount),
                description,
                devReference: dev_reference,
            });

            return sendSuccess(res, result, 'Referencia de checkout generada');
        } catch (error: any) {
            Logger.error('[PaymentsController] createCheckoutReference error:', error.message);
            return sendError({ res, error: error.message || 'Error al generar la referencia de pago', statusCode: 500 });
        }
    }

    /**
     * POST /api/payments/checkout-group-reference
     * Creates a single Nuvei Checkout reference for multiple contracts.
     */
    static async createGroupCheckoutReference(req: Request, res: Response) {
        try {
            const { uid, email } = (req as AuthRequest).user!;
            const { contractIds, description } = req.body;

            if (!Array.isArray(contractIds) || contractIds.length < 2) {
                return sendError({ res, error: 'Se requieren al menos 2 contratos para el pago grupal', statusCode: 400 });
            }

            const result = await PaymentsService.createGroupCheckoutReference({
                userId: uid,
                userEmail: email || '',
                contractIds,
                description: description || `Pago grupal de ${contractIds.length} contratos`,
            });

            return sendSuccess(res, result, 'Referencia de pago grupal generada');
        } catch (error: any) {
            Logger.error('[PaymentsController] createGroupCheckoutReference error:', error.message);
            return sendError({ res, error: error.message || 'Error al generar la referencia de pago grupal', statusCode: 500 });
        }
    }

    /**
     * POST /api/payments/confirm-checkout
     * Called by the frontend SDK onResponse callback after a successful payment.
     * Marks the order and contract as PAID without waiting for the webhook.
     */
    static async confirmCheckout(req: Request, res: Response) {
        try {
            const { orderKey, transactionId, amount } = req.body;
            if (!orderKey || !transactionId) {
                return sendError({ res, error: 'orderKey y transactionId son requeridos', statusCode: 400 });
            }
            await PaymentsService.confirmCheckout(orderKey, transactionId, Number(amount) || 0);
            return sendSuccess(res, { orderKey, transactionId }, 'Pago confirmado');
        } catch (error: any) {
            Logger.error('[PaymentsController] confirmCheckout error:', error.message);
            return sendError({ res, error: error.message || 'Error al confirmar el pago', statusCode: 500 });
        }
    }

    /**
     * POST /api/payments/webhook
     * Callback received from Nuvei for transaction status updates.
     */
    static async handleWebhook(req: Request, res: Response) {
        try {
            const result = await PaymentsService.handleWebhook(req.body);
            return sendSuccess(res, result, 'Webhook procesado exitosamente');
        } catch (error: any) {
            Logger.error('[PaymentsController Webhook] Error:', error.message);
            return res.status(200).send('Webhook error handled');
        }
    }

    /**
     * POST /api/payments/withdraw
     * Process a withdrawal request from an artist.
     */
    static async withdraw(req: Request, res: Response) {
        try {
            const { uid } = (req as AuthRequest).user!;
            const { amount, bankDetails } = req.body;

            if (!amount || !bankDetails || Number(amount) <= 0) {
                return sendError({ res, error: 'Parámetros inválidos (amount > 0, bankDetails requerido)', statusCode: 400 });
            }

            const result = await PaymentsService.requestWithdraw(uid, {
                amount: Number(amount),
                bankDetails
            });

            return sendSuccess(res, result, 'Solicitud de retiro procesada exitosamente');
        } catch (error: any) {
            Logger.error('[PaymentsController Withdraw] Error:', error.message);
            return sendError({ res, error: error.message || 'Error al procesar el retiro', statusCode: 500 });
        }
    }

    /**
     * PUT /api/payments/admin/withdrawals/:id
     * Update status (COMPLETED/REJECTED) - Admin Only.
     */
    static async updateWithdrawalStatus(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { status, reason } = req.body;
            const { uid: adminId } = (req as AuthRequest).user!;

            if (!status) {
                return sendError({ res, error: 'Faltan parámetros (status)', statusCode: 400 });
            }

            const data = await PaymentsService.updateWithdrawalStatus(
                adminId, 
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
     * POST /api/payments/refund
     */
    static async refund(req: Request, res: Response): Promise<void> {
        try {
            const { transactionId, amount } = req.body;

            if (!transactionId) {
                sendError({ res, error: 'transactionId is required', statusCode: 400 });
                return;
            }

            const result = await PaymentsService.refundCardTransaction(transactionId, amount);
            sendSuccess(res, result, 'Reembolso procesado exitosamente');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al procesar el reembolso';
            sendError({ res, error: message, statusCode: 400 });
        }
    }

    /**
     * GET /api/payments/withdrawals
     */
    static async getArtistWithdrawals(req: Request, res: Response) {
        try {
            const { uid } = (req as AuthRequest).user!;
            const data = await PaymentsService.getArtistWithdrawals(uid);
            return sendSuccess(res, data, 'Historial de retiros obtenido');
        } catch (error: any) {
            return sendError({ res, error: error.message, statusCode: 500 });
        }
    }

    /**
     * GET /api/payments/transactions
     */
    static async getArtistTransactions(req: Request, res: Response) {
        try {
            const { uid } = (req as AuthRequest).user!;
            const data = await PaymentsService.getArtistTransactions(uid);
            return sendSuccess(res, data, 'Historial de transacciones obtenido');
        } catch (error: any) {
            return sendError({ res, error: error.message, statusCode: 500 });
        }
    }

    /**
     * GET /api/payments/admin/withdrawals
     */
    static async getAllWithdrawals(req: Request, res: Response) {
        try {
            const { status } = req.query;
            const data = await PaymentsService.getAllWithdrawals(status as string);
            return sendSuccess(res, data, 'Listado de solicitudes obtenido');
        } catch (error: any) {
            return sendError({ res, error: error.message, statusCode: 500 });
        }
    }
}
