import crypto from 'crypto';
import axios from 'axios';
import { getFirestore, admin } from '../../config/firebase';
import { MailService } from '../mail/mail.service';
import { Logger } from '../../utils/logger.util';
import { getEnv } from '../../config/env';

const COLLECTION_ORDERS = 'orders';

export type WithdrawalStatus = 'PENDING' | 'COMPLETED' | 'REJECTED';

interface WithdrawalRequest {
    id: string;
    artistId: string;
    amount: number;
    status: WithdrawalStatus;
    bankDetails: any;
    createdAt: Date;
    updatedAt: Date;
    reason?: string;
    processedBy?: string;
}

export class PaymentsService {
    private static getAuthHeader(): string {
        const { NUVEI_LTP_SERVER_KEY, NUVEI_LTP_SERVER_SECRET } = getEnv();
        const unixTimestamp = Math.floor(Date.now() / 1000).toString();
        // El hash (UNIQ-TOKEN) se genera solo con SECRET + TIMESTAMP
        const uniqToken = crypto.createHash('sha256').update(NUVEI_LTP_SERVER_SECRET + unixTimestamp).digest('hex');
        const authString = `${NUVEI_LTP_SERVER_KEY};${unixTimestamp};${uniqToken}`;
        return Buffer.from(authString).toString('base64');
    }


    static async createPaymentLink(payload: any) {
        const { NUVEI_API_ENDPOINT, FRONT_DNS } = getEnv();
        const db = getFirestore();
        try {
            const url = `${NUVEI_API_ENDPOINT}/linktopay/init_order/`;
            const body = {
                user: payload.user,
                order: { currency: 'USD', installments_type: 0, vat: 0, taxable_amount: payload.order.amount, tax_percentage: 0, ...payload.order },
                configuration: {
                    partial_payment: false,
                    expiration_time: 86400,
                    allowed_payment_methods: ['All'],
                    success_url: payload.configuration?.success_url || `${FRONT_DNS}/payments/success`,
                    failure_url: payload.configuration?.failure_url || `${FRONT_DNS}/payments/failure`,
                    pending_url: payload.configuration?.pending_url || `${FRONT_DNS}/payments/pending`,
                    review_url: payload.configuration?.review_url || `${FRONT_DNS}/payments/review`,
                }

            };
            const response = await axios.post(url, body, { headers: { 'Content-Type': 'application/json', 'Auth-Token': this.getAuthHeader() } });
            if (response.data.success) {
                await db.collection(COLLECTION_ORDERS).doc(payload.order.dev_reference).set({ ...response.data.data, userId: payload.user.id, status: 'PENDING', createdAt: admin.firestore.Timestamp.now(), updatedAt: admin.firestore.Timestamp.now() });
                return response.data.data;
            }
            throw new Error(response.data.detail);
        } catch (error: any) {
            throw new Error(error.message);
        }
    }

    static async handleWebhook(data: any) {
        const { transaction, user } = data;
        const db = getFirestore();
        const isApproved = transaction.status === 'success' && (transaction.status_detail === 3 || transaction.status_detail === '3');
        const orderId = transaction.dev_reference;
        await db.collection(COLLECTION_ORDERS).doc(orderId).update({ status: isApproved ? 'SUCCESS' : 'FAILURE', nuveiTransactionId: transaction.id, authorizationCode: transaction.authorization_code, updatedAt: admin.firestore.Timestamp.now() });
        if (isApproved) {
            await MailService.sendPaymentConfirmationEmail(user.email, { userName: `${user.name} ${user.last_name}`, orderId, amount: transaction.amount, transactionId: transaction.id, authorizationCode: transaction.authorization_code });
        }
        return { orderId, isApproved };
    }

    static async requestWithdraw(artistId: string, payload: { amount: number; bankDetails: any }) {
        const db = getFirestore();
        const artistRef = db.collection('artist_profiles').doc(artistId);
        return await db.runTransaction(async (t) => {
            const doc = await t.get(artistRef);
            const currentBalance = doc.exists ? (doc.data()?.totalBalance || 0) : 0;
            if (currentBalance < payload.amount) throw new Error('Saldo insuficiente');
            const newBalance = currentBalance - payload.amount;
            t.set(artistRef, { totalBalance: newBalance, updatedAt: admin.firestore.Timestamp.now() }, { merge: true });
            const withdrawRef = db.collection('withdrawal_requests').doc();
            const withdrawData: WithdrawalRequest = { id: withdrawRef.id, artistId, amount: payload.amount, status: 'PENDING', bankDetails: payload.bankDetails, createdAt: new Date(), updatedAt: new Date() };
            t.set(withdrawRef, withdrawData);
            return withdrawData;
        });
    }

    static async updateWithdrawalStatus(adminId: string, requestId: string, status: WithdrawalStatus, reason?: string) {
        const db = getFirestore();
        const withdrawRef = db.collection('withdrawal_requests').doc(requestId);
        return await db.runTransaction(async (t) => {
            const withdrawDoc = await t.get(withdrawRef);
            if (!withdrawDoc.exists) throw new Error('Solicitud no encontrada');
            const data = withdrawDoc.data() as WithdrawalRequest;
            t.update(withdrawRef, { status, reason: reason || null, updatedAt: new Date(), processedBy: adminId });
            return { id: requestId, status };
        });
    }

    static async getArtistWithdrawals(artistId: string) {
        const db = getFirestore();
        const snapshot = await db.collection('withdrawal_requests').where('artistId', '==', artistId).orderBy('createdAt', 'desc').get();
        return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    }

    static async getArtistTransactions(artistId: string) {
        const db = getFirestore();
        const snapshot = await db.collection('wallet_transactions').where('artistId', '==', artistId).orderBy('createdAt', 'desc').get();
        return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    }

    static async getAllWithdrawals(status?: string) {
        const db = getFirestore();
        let query: any = db.collection('withdrawal_requests');
        if (status) query = query.where('status', '==', status);
        const snapshot = await query.orderBy('createdAt', 'desc').get();
        return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    }

    static async refund(transactionId: string, amount?: number, description: string = 'Refund requested') {
        const { NUVEI_API_ENDPOINT } = getEnv();
        const url = `${NUVEI_API_ENDPOINT}/v2/transaction/${transactionId}/refund/`;
        const response = await axios.post(url, { amount, description }, { headers: { 'Content-Type': 'application/json', 'Auth-Token': this.getAuthHeader() } });
        return response.data;
    }
}
