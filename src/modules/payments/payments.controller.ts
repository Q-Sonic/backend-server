import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthRequest } from '../../types';

const paymentsService = new PaymentsService();

/**
 * Initiates a Link To Pay session.
 */
export async function createLinkToPay(req: Request, res: Response): Promise<void> {
    try {
        const { uid, email, displayName } = (req as AuthRequest).user!;
        const { amount, description, dev_reference } = req.body;

        if (!amount || !description || !dev_reference) {
            sendError({ res, error: 'amount, description and dev_reference are required', statusCode: 400 });
            return;
        }

        const nameParts = (displayName || 'User').split(' ');
        const name = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || 'N/A';

        const result = await paymentsService.createPaymentLink({
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

        sendSuccess(res, result, 'Payment link generated successfully');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate payment link';
        sendError({ res, error: message, statusCode: 400 });
    }
}

/**
 * Handle incoming webhooks from Nuvei/Paymentez.
 */
export async function handleWebhook(req: Request, res: Response): Promise<void> {
    try {
        const payload = req.body;
        
        // Basic check to ensure it's from Nuvei (you can add more IP/Signature validation later)
        if (!payload.transaction || !payload.transaction.dev_reference) {
            sendError({ res, error: 'Invalid webhook payload', statusCode: 400 });
            return;
        }

        const result = await paymentsService.handleWebhook(payload);
        
        // Nuvei expects a success response to stop retrying
        sendSuccess(res, result, 'Webhook processed');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Webhook processing failed';
        sendError({ res, error: message, statusCode: 500 });
    }
}

/**
 * Handle refund requests.
 */
export async function refund(req: Request, res: Response): Promise<void> {
    try {
        const { transactionId, amount, description } = req.body;

        if (!transactionId) {
            sendError({ res, error: 'transactionId is required', statusCode: 400 });
            return;
        }

        const result = await paymentsService.refund(transactionId, amount, description);
        sendSuccess(res, result, 'Refund processed successfully');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Refund failed';
        sendError({ res, error: message, statusCode: 400 });
    }
}
/**
 * Handle withdrawal requests from artists.
 */
export async function withdraw(req: Request, res: Response): Promise<void> {
    try {
        const { uid } = (req as AuthRequest).user!;
        const { amount } = req.body;

        if (!amount || Number(amount) <= 0) {
            sendError({ res, error: 'Amount must be greater than 0', statusCode: 400 });
            return;
        }

        const result = await paymentsService.withdraw(uid, Number(amount));
        sendSuccess(res, result, 'Withdrawal processed successfully');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Withdrawal failed';
        sendError({ res, error: message, statusCode: 400 });
    }
}
