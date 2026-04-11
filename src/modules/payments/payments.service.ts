import crypto from 'crypto';
import axios from 'axios';
import { getEnv } from '../../config/env';
import { Logger } from '../../utils/logger.util';

const {
    NUVEI_LTP_SERVER_KEY,
    NUVEI_LTP_SERVER_SECRET,
    NUVEI_API_ENDPOINT
} = getEnv();

/**
 * Payments Service - Nuvei Integration (Paymentez Ecuador)
 * Handles "Link to Pay" (LTP) initialization based on official documentation.
 */
export class PaymentsService {
    /**
     * Generates the Nuvei Auth-Token for Server-to-Server requests.
     */
    private static generateAuthToken(): string {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        // Alternative formula for some LTP versions: sha256(app_key + timestamp)
        const hashPayload = `${NUVEI_LTP_SERVER_SECRET}${timestamp}`;
        const hash = crypto.createHash('sha256').update(hashPayload).digest('hex');

        return Buffer.from(`${NUVEI_LTP_SERVER_KEY};${timestamp};${hash}`).toString('base64');
    }

    /**
     * Initializes a Link to Pay (LTP) session.
     * Following the exact format provided in the official Nuvei/Paymentez email.
     */
    static async createLinkToPay(payload: {
        amount: number;
        description: string;
        dev_reference: string;
        user_email: string;
        user_id: string;
    }) {
        if (!NUVEI_API_ENDPOINT) {
            throw new Error('NUVEI_API_ENDPOINT no está configurado en el servidor');
        }

        const token = this.generateAuthToken();
        // Exact URL from official email: https://noccapi-stg.paymentez.com/linktopay/init_order/
        const url = `${NUVEI_API_ENDPOINT}/linktopay/init_order/`;

        // Calculate basic taxes for compliance (assuming 0 for now as per previous logic, but structured)
        const taxableAmount = payload.amount;
        const vat = 0;

        const requestBody = {
            user: {
                id: payload.user_id,
                email: payload.user_email,
                name: "Cliente", // Default placeholders as first/last name are not in payload but required
                last_name: "Q-Music"
            },
            order: {
                dev_reference: payload.dev_reference,
                description: payload.description,
                amount: payload.amount,
                vat: vat,
                tax_percentage: 0,
                taxable_amount: taxableAmount,
                installments_type: 0,
                currency: "USD"
            },
            configuration: {
                partial_payment: false,
                expiration_time: 36000,
                allowed_payment_methods: ["All"],
                success_url: 'https://q-sonic.vercel.app/payments/success',
                failure_url: 'https://q-sonic.vercel.app/payments/failure',
                pending_url: 'https://q-sonic.vercel.app/payments/pending',
                review_url: 'https://q-sonic.vercel.app/payments/review'
            }
        };

        try {
            Logger.info(`[Nuvei] Initializing LTP order for: ${payload.dev_reference} at ${url}`);
            const response = await axios.post(url, requestBody, {
                headers: {
                    'Auth-Token': token,
                    'Content-Type': 'application/json',
                },
            });

            // According to documentation, response structure has 'data.payment.payment_url'
            if (response.data && response.data.success && response.data.data?.payment?.payment_url) {
                return {
                    id: response.data.data.order.id,
                    payment_url: response.data.data.payment.payment_url
                };
            }

            const errorMsg = response.data.error || response.data.message || response.data.detail || 'Error al obtener el link de pago de Nuvei';
            throw new Error(errorMsg);
        } catch (error: any) {
            const remoteErrorMessage = error.response?.data?.error || error.response?.data?.message || error.response?.data?.detail || error.message;
            Logger.error('[Nuvei] Error in createLinkToPay:', error.response?.data || error.message);
            throw new Error(remoteErrorMessage || 'Error de conexión con el proveedor de pagos');
        }
    }

    /**
     * Processes the incoming webhook from Nuvei to update transaction status.
     * Status "success" and detail "3" mean "Approved".
     */
    static async processWebhook(payload: any) {
        const { transaction, order } = payload;

        const isApproved = payload.status === 'success' || transaction?.status_detail === 3;
        const orderId = order?.dev_reference || payload.order?.dev_reference;

        Logger.info(`[Nuvei Webhook] Received status for order ${orderId}: ${payload.status} / ${transaction?.status_detail}`);

        if (isApproved && orderId) {
            return { orderId, isApproved: true };
        }

        return { orderId, isApproved: false };
    }
}
