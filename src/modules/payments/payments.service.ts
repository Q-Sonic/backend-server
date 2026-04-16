import crypto from 'crypto';
import axios from 'axios';
import { getFirestore, admin } from '../../config/firebase';
import { getEnv } from '../../config/env';
import { Logger } from '../../utils/logger.util';

const {
    NUVEI_LTP_SERVER_KEY,
    NUVEI_LTP_SERVER_SECRET,
    NUVEI_API_ENDPOINT
} = getEnv();

export class PaymentsService {
    private static generateAuthToken(): string {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const hashPayload = `${NUVEI_LTP_SERVER_SECRET}${timestamp}`;
        const hash = crypto.createHash('sha256').update(hashPayload).digest('hex');
        return Buffer.from(`${NUVEI_LTP_SERVER_KEY};${timestamp};${hash}`).toString('base64');
    }

    static async createLinkToPay(payload: {
        amount: number;
        description: string;
        dev_reference: string;
        user_email: string;
        user_id: string;
    }) {
        if (!NUVEI_API_ENDPOINT) throw new Error('NUVEI_API_ENDPOINT no configurado');
        const token = this.generateAuthToken();
        const url = `${NUVEI_API_ENDPOINT}/linktopay/init_order/`;

        const requestBody = {
            user: { id: payload.user_id, email: payload.user_email, name: "Cliente", last_name: "Q-Music" },
            order: { dev_reference: payload.dev_reference, description: payload.description, amount: payload.amount, currency: "USD" },
            configuration: { success_url: 'https://q-sonic.vercel.app/payments/success' }
        };

        try {
            const response = await axios.post(url, requestBody, { headers: { 'Auth-Token': token, 'Content-Type': 'application/json' } });
            if (response.data?.success && response.data.data?.payment?.payment_url) {
                return { id: response.data.data.order.id, payment_url: response.data.data.payment.payment_url };
            }
            throw new Error(response.data.error || 'Error Nuvei');
        } catch (error: any) {
            throw new Error(error.response?.data?.error || error.message);
        }
    }

    static async processWebhook(payload: any) {
        const { transaction, order } = payload;
        const isApproved = payload.status === 'success' || transaction?.status_detail === 3;
        const orderId = order?.dev_reference || payload.order?.dev_reference;

        Logger.info(`[Webhook] Procesando orden ${orderId}. Aprobado: ${isApproved}`);

        if (isApproved && orderId) {
            const db = getFirestore();
            
            // 1. Actualizar estado de la orden en la colección 'orders'
            await db.collection('orders').doc(orderId).update({
                status: 'SUCCESS',
                updatedAt: admin.firestore.Timestamp.now(),
                nuveiTransactionId: transaction?.id || 'manual'
            }).catch(() => Logger.warn(`Orden ${orderId} no encontrada en 'orders'`));

            // 2. Buscar quién es el artista de esta orden en 'wallet_transactions'
            const txSnapshot = await db.collection('wallet_transactions')
                .where('orderId', '==', orderId)
                .limit(1)
                .get();

            if (!txSnapshot.empty) {
                const txDoc = txSnapshot.docs[0];
                const { artistId, amount } = txDoc.data();
                
                Logger.info(`[Webhook] Incrementando saldo de artista ${artistId} en $${amount}`);

                // 3. Incrementar el balance en el perfil del artista
                await db.collection('artist_profiles').doc(artistId).update({
                    balance: admin.firestore.FieldValue.increment(amount),
                    updatedAt: admin.firestore.Timestamp.now()
                });

                Logger.success(`[Webhook] ¡SALDO ACTUALIZADO! Artista: ${artistId}`);
                return { orderId, isApproved: true };
            } else {
                Logger.error(`[Webhook] No se encontró el artista en 'wallet_transactions' para la orden ${orderId}`);
            }
        }
        return { orderId, isApproved: false };
    }
}
