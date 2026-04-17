import crypto from 'crypto';
import axios from 'axios';
import { getFirestore, admin } from '../../config/firebase';
import { getEnv } from '../../config/env';
import { Logger } from '../../utils/logger.util';
import { TransactionType, WithdrawalStatus } from '../../enum/payment.enum';
import { WithdrawalRequestInput } from '../../types';
import { sendWithdrawalRequestNotification } from '../mail/mail.service';

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

    static async requestWithdraw(artistId: string, input: WithdrawalRequestInput) {
        const db = getFirestore();
        const artistRef = db.collection('artist_profiles').doc(artistId);

        return await db.runTransaction(async (transaction) => {
            const artistDoc = await transaction.get(artistRef);
            if (!artistDoc.exists) throw new Error('Perfil de artista no encontrado');

            const artistData = artistDoc.data() as any;
            const currentBalance = artistData.balance || 0;

            if (currentBalance < input.amount) {
                throw new Error('Saldo insuficiente para realizar el retiro');
            }

            // 1. Restar del balance (Atómico dentro de la transacción)
            transaction.update(artistRef, {
                balance: admin.firestore.FieldValue.increment(-input.amount),
                updatedAt: admin.firestore.Timestamp.now()
            });

            // 2. Crear Registro de Solicitud de Retiro
            const requestRef = db.collection('withdrawal_requests').doc();
            const withdrawalRequest = {
                id: requestRef.id,
                artistId,
                amount: input.amount,
                status: WithdrawalStatus.PENDING,
                bankDetails: input.bankDetails,
                createdAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now()
            };
            transaction.set(requestRef, withdrawalRequest);

            // 3. Crear Transacción de Billetera (Tipo WITHDRAWAL)
            const walletTxRef = db.collection('wallet_transactions').doc();
            const walletTx = {
                id: walletTxRef.id,
                artistId,
                amount: input.amount,
                type: TransactionType.WITHDRAWAL,
                description: `Retiro solicitado a ${input.bankDetails.bankName}`,
                createdAt: admin.firestore.Timestamp.now()
            };
            transaction.set(walletTxRef, walletTx);

            // 4. Notificar al Admin (Fuera de la transacción para no bloquear)
            const artistName = artistData.displayName || 'Artista';
            sendWithdrawalRequestNotification(artistName, input.amount, input.bankDetails)
                .catch(err => Logger.error('[Withdrawal Mail] Error:', err.message));

            return withdrawalRequest;
        });
    }

    /**
     * Updates the status of a withdrawal request (Admin Only).
     * If REJECTED, the amount is reverted to the artist's balance.
     */
    static async updateWithdrawalStatus(
        adminId: string,
        requestId: string,
        newStatus: WithdrawalStatus,
        reason?: string
    ) {
        const db = getFirestore();
        const requestRef = db.collection('withdrawal_requests').doc(requestId);

        return await db.runTransaction(async (transaction) => {
            const requestSnap = await transaction.get(requestRef);
            if (!requestSnap.exists) {
                throw new Error('La solicitud de retiro no existe.');
            }

            const requestData = requestSnap.data() as any;
            const currentStatus = requestData.status as WithdrawalStatus;
            const artistId = requestData.artistId;
            const amount = requestData.amount;

            if (currentStatus !== WithdrawalStatus.PENDING) {
                throw new Error(`No se puede cambiar el estado de una solicitud que no esté PENDIENTE. (Estado actual: ${currentStatus})`);
            }

            // 1. Actualizar la solicitud
            transaction.update(requestRef, {
                status: newStatus,
                handledBy: adminId,
                rejectionReason: reason || null,
                updatedAt: admin.firestore.Timestamp.now()
            });

            // 2. Si es RECHAZADO, revertir balance
            if (newStatus === WithdrawalStatus.REJECTED) {
                const artistProfileRef = db.collection('artist_profiles').doc(artistId);
                transaction.update(artistProfileRef, {
                    balance: admin.firestore.FieldValue.increment(amount),
                    updatedAt: admin.firestore.Timestamp.now()
                });

                // Registrar transacción de reversión
                const walletTxRef = db.collection('wallet_transactions').doc();
                transaction.set(walletTxRef, {
                    id: walletTxRef.id,
                    artistId,
                    orderId: requestId,
                    type: TransactionType.WITHDRAWAL_REVERT,
                    amount: amount,
                    status: 'success',
                    description: `Reversión de retiro rechazado: ${reason || 'Sin motivo especificado'}`,
                    createdAt: admin.firestore.Timestamp.now(),
                    updatedAt: admin.firestore.Timestamp.now()
                });
            }

            return { id: requestId, status: newStatus };
        });
    }

    /**
     * Get withdrawals for an artist
     */
    static async getArtistWithdrawals(artistId: string) {
        const db = getFirestore();
        const snapshot = await db.collection('withdrawal_requests')
            .where('artistId', '==', artistId)
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    /**
     * Get transactions for an artist (Wallet history)
     */
    static async getArtistTransactions(artistId: string) {
        const db = getFirestore();
        const snapshot = await db.collection('wallet_transactions')
            .where('artistId', '==', artistId)
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    /**
     * Get all withdrawals (Admin)
     */
    static async getAllWithdrawals(status?: string) {
        const db = getFirestore();
        let query: any = db.collection('withdrawal_requests');

        if (status) {
            query = query.where('status', '==', status);
        }

        const snapshot = await query.orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
}
