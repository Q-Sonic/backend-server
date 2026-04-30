import axios from 'axios';
import crypto from 'crypto';
import { getEnv } from '../../config/env';
import { getFirestore, admin } from '../../config/firebase';
import { Logger } from '../../utils/logger.util';

/**
 * Payout Request status type
 */
export type WithdrawalStatus = 'PENDING' | 'COMPLETED' | 'REJECTED';

/**
 * Interface for payout requests in Firestore
 */
interface WithdrawalRequest {
    id: string;
    artistId: string;
    amount: number;
    status: WithdrawalStatus;
    bankDetails: any;
    createdAt: Date;
    updatedAt: Date;
    reason?: string;
}

/**
 * Nuvei (Paymentez) Payments Service
 */
export class PaymentsService {
    /**
     * Generates a Nuvei (Paymentez) payment link.
     */
    static async createLinkToPay(payload: { amount: number; description: string; dev_reference: string; user_email: string; user_id: string }) {
        const { NUVEI_LTP_SERVER_KEY, NUVEI_LTP_SERVER_SECRET, NUVEI_API_ENDPOINT, FRONT_DNS } = getEnv();
        const url = `${NUVEI_API_ENDPOINT}/linktopay/init_order/`;

        const unixTimestamp = Math.floor(Date.now() / 1000).toString();
        const token = this.generateAuthToken(NUVEI_LTP_SERVER_KEY, NUVEI_LTP_SERVER_SECRET, unixTimestamp);

        const requestBody = {
            user: { 
                id: payload.user_id, 
                email: payload.user_email, 
                name: "Cliente", 
                last_name: "Q-Music" 
            },
            order: { 
                dev_reference: payload.dev_reference, 
                description: payload.description, 
                amount: payload.amount, 
                vat: 0, 
                tax_percentage: 0, 
                taxable_amount: payload.amount, 
                currency: "USD",
                installments_type: 0
            },
            configuration: { 
                partial_payment: false,
                expiration_time: 36000,
                allowed_payment_methods: ["All"],
                success_url: `${FRONT_DNS}/payments/success`,
                failure_url: `${FRONT_DNS}/payments/failure`,
                pending_url: `${FRONT_DNS}/payments/pending`,
                review_url: `${FRONT_DNS}/payments/review`
            }
        };

        try {
            const response = await axios.post(url, requestBody, { 
                headers: { 
                    'Auth-Token': token, 
                    'Content-Type': 'application/json' 
                } 
            });
            if (response.data?.success && response.data.data?.payment?.payment_url) {
                return { id: response.data.data.order.id, payment_url: response.data.data.payment.payment_url };
            }
            throw new Error(response.data.error || 'Error Nuvei');
        } catch (error: any) {
            const nuveiError = error.response?.data?.error;
            Logger.error('[PaymentsService] Nuvei Error Detail:', JSON.stringify(nuveiError || error.message));
            
            if (nuveiError) {
                throw new Error(`Nuvei: ${nuveiError.type || JSON.stringify(nuveiError)}`);
            }
            throw new Error(error.message);
        }
    }

    /**
     * Process a Nuvei (Paymentez) webhook callback.
     */
    static async processWebhook(body: any) {
        const { transaction, order } = body;
        
        if (body.status === 'success' || transaction?.status === 'success') {
            const db = getFirestore();
            const amount = transaction.amount;
            const dev_reference = order.dev_reference;

            const serviceSnap = await db.collection('artist_services').doc(dev_reference).get();
            if (serviceSnap.exists) {
                const serviceData = serviceSnap.data();
                const artistId = serviceData?.artistId;
                if (artistId) {
                    await this.updateArtistBalance(artistId, amount, `Pago por servicio: ${serviceData.name}`);
                    return { success: true, message: 'Balance actualizado (Servicio)' };
                }
            }

            const contractSnap = await db.collection('contracts').doc(dev_reference).get();
            if (contractSnap.exists) {
                const contractData = contractSnap.data();
                const artistId = contractData?.artistId;
                if (artistId) {
                    await this.updateArtistBalance(artistId, amount, `Pago por contrato: ${contractSnap.id}`);
                    return { success: true, message: 'Balance actualizado (Contrato)' };
                }
            }

            const artistSnap = await db.collection('artist_profiles').doc(dev_reference).get();
            if (artistSnap.exists) {
                await this.updateArtistBalance(dev_reference, amount, `Pago directo o no identificado: ${order.description}`);
                return { success: true, message: 'Balance actualizado (Artista Directo)' };
            }

            throw new Error('No se pudo encontrar el destinatario del pago (ServiceId, ContractId o ArtistId)');
        }

        return { success: false, message: 'Transacción no exitosa o ignorada' };
    }

    /**
     * Helper: Updates artist wallet balance and records transaction.
     */
    private static async updateArtistBalance(artistId: string, amount: number, description: string) {
        const db = getFirestore();
        const artistRef = db.collection('artist_profiles').doc(artistId);
        
        await db.runTransaction(async (t: admin.firestore.Transaction) => {
            const doc = await t.get(artistRef);
            const currentBalance = doc.exists ? (doc.data()?.totalBalance || 0) : 0;
            const newBalance = currentBalance + amount;

            t.set(artistRef, { totalBalance: newBalance }, { merge: true });

            const txRef = db.collection('wallet_transactions').doc();
            t.set(txRef, {
                artistId,
                amount,
                type: 'DEPOSIT',
                description,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                balanceAfter: newBalance
            });
        });
    }

    /**
     * Request a withdrawal (payout).
     */
    static async requestWithdraw(artistId: string, payload: { amount: number; bankDetails: any }) {
        const db = getFirestore();
        const artistRef = db.collection('artist_profiles').doc(artistId);

        return await db.runTransaction(async (t: admin.firestore.Transaction) => {
            const doc = await t.get(artistRef);
            const currentBalance = doc.exists ? (doc.data()?.totalBalance || 0) : 0;

            if (currentBalance < payload.amount) {
                throw new Error('Saldo insuficiente para realizar el retiro');
            }

            const newBalance = currentBalance - payload.amount;
            t.set(artistRef, { totalBalance: newBalance }, { merge: true });

            const withdrawRef = db.collection('withdrawal_requests').doc();
            const withdrawData: WithdrawalRequest = {
                id: withdrawRef.id,
                artistId,
                amount: payload.amount,
                status: 'PENDING',
                bankDetails: payload.bankDetails,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            t.set(withdrawRef, withdrawData);

            const txRef = db.collection('wallet_transactions').doc();
            t.set(txRef, {
                artistId,
                amount: -payload.amount,
                type: 'WITHDRAWAL_REQUEST',
                description: 'Solicitud de retiro de fondos',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                balanceAfter: newBalance,
                requestId: withdrawRef.id
            });

            return withdrawData;
        });
    }

    /**
     * Update withdrawal status (Admin Only).
     */
    static async updateWithdrawalStatus(adminId: string, requestId: string, status: WithdrawalStatus, reason?: string) {
        const db = getFirestore();
        const withdrawRef = db.collection('withdrawal_requests').doc(requestId);

        return await db.runTransaction(async (t: admin.firestore.Transaction) => {
            const withdrawDoc = await t.get(withdrawRef);
            if (!withdrawDoc.exists) throw new Error('Solicitud no encontrada');

            const data = withdrawDoc.data() as WithdrawalRequest;
            if (data.status !== 'PENDING') throw new Error('La solicitud ya fue procesada');

            t.update(withdrawRef, { 
                status, 
                reason: reason || null, 
                updatedAt: new Date(),
                processedBy: adminId
            });

            if (status === 'REJECTED') {
                const artistRef = db.collection('artist_profiles').doc(data.artistId);
                const artistDoc = await t.get(artistRef);
                const currentBalance = artistDoc.exists ? (artistDoc.data()?.totalBalance || 0) : 0;
                const newBalance = currentBalance + data.amount;

                t.update(artistRef, { totalBalance: newBalance });

                const txRef = db.collection('wallet_transactions').doc();
                t.set(txRef, {
                    artistId: data.artistId,
                    amount: data.amount,
                    type: 'WITHDRAWAL_REVERSAL',
                    description: `Reintegro por retiro rechazado: ${reason || 'S/M'}`,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    balanceAfter: newBalance,
                    requestId
                });
            }

            return { id: requestId, status };
        });
    }

    /**
     * Generates Paymentez Auth Token.
     */
    private static generateAuthToken(serverKey: string, serverSecret: string, unixTimestamp: string): string {
        const stringToHash = `${serverSecret}${unixTimestamp}`;
        const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
        
        const authData = `${serverKey};${unixTimestamp};${sha256}`;
        return Buffer.from(authData).toString('base64');
    }

    /**
     * Get withdrawals for an artist.
     */
    static async getArtistWithdrawals(artistId: string) {
        const db = getFirestore();
        const snapshot = await db.collection('withdrawal_requests')
            .where('artistId', '==', artistId)
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }));
    }

    /**
     * Get transactions for an artist.
     */
    static async getArtistTransactions(artistId: string) {
        const db = getFirestore();
        const snapshot = await db.collection('wallet_transactions')
            .where('artistId', '==', artistId)
            .orderBy('createdAt', 'desc')
            .get();

        return snapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }));
    }

    /**
     * Get all withdrawals (for Admin).
     */
    static async getAllWithdrawals(status?: string) {
        const db = getFirestore();
        let query: any = db.collection('withdrawal_requests');
        if (status) {
            query = query.where('status', '==', status);
        }

        const snapshot = await query.orderBy('createdAt', 'desc').get();
        return snapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }));
    }
}
