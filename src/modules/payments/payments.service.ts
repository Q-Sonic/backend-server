import crypto from 'crypto';
import axios from 'axios';
import { getFirestore, admin } from '../../config/firebase';
import { PaymentStatus } from '../../enum/contract.enum';
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

/**
 * Nuvei auth token: base64( APP_CODE ; UNIX_TIMESTAMP ; sha256(SECRET + UNIX_TIMESTAMP) )
 */
function buildAuthHeader(appCode: string, secret: string): string {
    const ts = Math.floor(Date.now() / 1000).toString();
    const hash = crypto.createHash('sha256').update(secret + ts).digest('hex');
    return Buffer.from(`${appCode};${ts};${hash}`).toString('base64');
}

export class PaymentsService {
    /** Auth header for Link-to-Pay (LINKTOPAY01 credentials) */
    private static getLtpAuthHeader(): string {
        const { NUVEI_LTP_SERVER_KEY, NUVEI_LTP_SERVER_SECRET } = getEnv();
        return buildAuthHeader(NUVEI_LTP_SERVER_KEY, NUVEI_LTP_SERVER_SECRET);
    }

    /** Auth header for Cards / Checkout (TESTNUVEISTG credentials) */
    private static getCardsAuthHeader(): string {
        const { NUVEI_SERVER_KEY, NUVEI_SERVER_SECRET } = getEnv();
        return buildAuthHeader(NUVEI_SERVER_KEY, NUVEI_SERVER_SECRET);
    }

    // ─── Link-to-Pay ──────────────────────────────────────────────────────────

    static async createPaymentLink(payload: any) {
        const { NUVEI_API_ENDPOINT, FRONT_DNS } = getEnv();
        const db = getFirestore();
        try {
            const url = `${NUVEI_API_ENDPOINT}/linktopay/init_order/`;
            const body = {
                user: payload.user,
                order: {
                    currency: 'USD',
                    installments_type: 0,
                    vat: 0,
                    taxable_amount: payload.order.amount,
                    tax_percentage: 0,
                    ...payload.order,
                },
                configuration: {
                    partial_payment: false,
                    expiration_time: 86400,
                    allowed_payment_methods: ['All'],
                    success_url: payload.configuration?.success_url || `${FRONT_DNS}/payment/success`,
                    failure_url: payload.configuration?.failure_url || `${FRONT_DNS}/payment/failure`,
                    pending_url: payload.configuration?.pending_url || `${FRONT_DNS}/payment/pending`,
                    review_url:  payload.configuration?.review_url  || `${FRONT_DNS}/payment/review`,
                },
            };
            const response = await axios.post(url, body, {
                headers: { 'Content-Type': 'application/json', 'Auth-Token': this.getLtpAuthHeader() },
            });
            if (response.data.success) {
                await db.collection(COLLECTION_ORDERS).doc(payload.order.dev_reference).set({
                    ...response.data.data,
                    userId: payload.user.id,
                    status: 'PENDING',
                    createdAt: admin.firestore.Timestamp.now(),
                    updatedAt: admin.firestore.Timestamp.now(),
                });
                return response.data.data;
            }
            throw new Error(response.data.detail);
        } catch (error: any) {
            const detail = error?.response?.data ? JSON.stringify(error.response.data) : null;
            const message = detail ? `Nuvei LTP error (${error?.response?.status}): ${detail}` : error.message;
            Logger.error('[PaymentsService] LTP request failed:', message);
            throw new Error(message);
        }
    }

    // ─── Checkout (Cards SDK) ─────────────────────────────────────────────────

    /**
     * Creates a checkout reference to be used by the Paymentez JS SDK modal.
     * Returns the `reference` string that the frontend passes to paymentCheckout.open().
     * Endpoint: POST https://ccapi-stg.paymentez.com/v2/transaction/init_reference/
     */
    static async createCheckoutReference(payload: {
        userId: string;
        userEmail: string;
        amount: number;
        description: string;
        devReference: string;
        /** IVA rate: 0 = 0%, 0.15 = 15%. Defaults to 0 (artistic services). */
        taxRate?: number;
    }): Promise<{ reference: string; checkoutUrl: string; orderKey: string }> {
        const { NUVEI_CARDS_API_ENDPOINT } = getEnv();
        const db = getFirestore();
        // Unique key per attempt so Nuvei never sees a duplicate dev_reference
        const orderKey = `${payload.devReference}-${Date.now()}`;
        try {
            const url = `${NUVEI_CARDS_API_ENDPOINT}/v2/transaction/init_reference/`;
            // Ecuador tax rules for Q-Sonic:
            // - Artistic / cultural services (SRI Res. NAC-DGERCGC24) → IVA 0%
            // - General commercial services → IVA 15% (since Apr 2024)
            // Q-Sonic primarily contracts artistic performances → IVA 0%
            // taxRate can be overridden per-order if needed.
            const taxRate = payload.taxRate ?? 0; // 0 = IVA 0%, 0.15 = IVA 15%
            const taxPercentage = Math.round(taxRate * 100);
            const taxableAmount = taxRate > 0
                ? parseFloat((payload.amount / (1 + taxRate)).toFixed(2))
                : payload.amount;
            const vat = taxRate > 0
                ? parseFloat((payload.amount - taxableAmount).toFixed(2))
                : 0;

            const body = {
                locale: 'es',
                user: { id: payload.userId, email: payload.userEmail },
                order: {
                    amount: payload.amount,
                    taxable_amount: taxableAmount,
                    vat,
                    tax_percentage: taxPercentage,
                    description: payload.description,
                    dev_reference: orderKey,
                    installments_type: 0,
                    currency: 'USD',
                },
            };
            const response = await axios.post(url, body, {
                headers: { 'Content-Type': 'application/json', 'Auth-Token': this.getCardsAuthHeader() },
            });
            const { reference, checkout_url } = response.data;
            await db.collection(COLLECTION_ORDERS).doc(orderKey).set({
                reference,
                contractId: payload.devReference,
                userId: payload.userId,
                amount: payload.amount,
                description: payload.description,
                status: 'PENDING',
                createdAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now(),
            });
            return { reference, checkoutUrl: checkout_url, orderKey };
        } catch (error: any) {
            const detail = error?.response?.data ? JSON.stringify(error.response.data) : null;
            const message = detail ? `Nuvei Checkout error (${error?.response?.status}): ${detail}` : error.message;
            Logger.error('[PaymentsService] Checkout init_reference failed:', message);
            throw new Error(message);
        }
    }

    /**
     * Creates a single Nuvei Checkout reference for multiple contracts at once (group payment).
     * Stores contractIds[] in the order document; on confirmation all contracts are marked PAID.
     */
    static async createGroupCheckoutReference(payload: {
        userId: string;
        userEmail: string;
        contractIds: string[];
        description: string;
        taxRate?: number;
    }): Promise<{ reference: string; checkoutUrl: string; orderKey: string; totalAmount: number }> {
        const { NUVEI_CARDS_API_ENDPOINT } = getEnv();
        const db = getFirestore();

        // Fetch all contracts and sum their amounts
        const contractDocs = await Promise.all(
            payload.contractIds.map((id) => db.collection('contracts').doc(id).get())
        );
        const totalAmount = contractDocs.reduce((sum, doc) => {
            return sum + (doc.exists ? (doc.data()?.financials?.totalAmount || 0) : 0);
        }, 0);

        if (totalAmount <= 0) throw new Error('El monto total del grupo es inválido');

        const orderKey = `group-${payload.userId}-${Date.now()}`;
        const taxRate = payload.taxRate ?? 0;
        const taxPercentage = Math.round(taxRate * 100);
        const taxableAmount = taxRate > 0 ? parseFloat((totalAmount / (1 + taxRate)).toFixed(2)) : totalAmount;
        const vat = taxRate > 0 ? parseFloat((totalAmount - taxableAmount).toFixed(2)) : 0;

        const url = `${NUVEI_CARDS_API_ENDPOINT}/v2/transaction/init_reference/`;
        const body = {
            locale: 'es',
            user: { id: payload.userId, email: payload.userEmail },
            order: {
                amount: totalAmount,
                taxable_amount: taxableAmount,
                vat,
                tax_percentage: taxPercentage,
                description: payload.description,
                dev_reference: orderKey,
                installments_type: 0,
                currency: 'USD',
            },
        };

        try {
            const response = await axios.post(url, body, {
                headers: { 'Content-Type': 'application/json', 'Auth-Token': this.getCardsAuthHeader() },
            });
            const { reference, checkout_url } = response.data;
            await db.collection(COLLECTION_ORDERS).doc(orderKey).set({
                reference,
                contractIds: payload.contractIds,     // array for group payment
                contractId: null,                     // single-contract field not used here
                userId: payload.userId,
                amount: totalAmount,
                description: payload.description,
                status: 'PENDING',
                createdAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now(),
            });
            return { reference, checkoutUrl: checkout_url, orderKey, totalAmount };
        } catch (error: any) {
            const detail = error?.response?.data ? JSON.stringify(error.response.data) : null;
            const message = detail ? `Nuvei Group Checkout error (${error?.response?.status}): ${detail}` : error.message;
            Logger.error('[PaymentsService] Group checkout init_reference failed:', message);
            throw new Error(message);
        }
    }

    // ─── Helpers: mark contracts as PAID ─────────────────────────────────────

    private static async markContractsPaid(db: FirebaseFirestore.Firestore, contractIds: string[], amountPerContract: number): Promise<void> {
        await Promise.all(contractIds.map((cid) =>
            db.collection('contracts').doc(cid).update({
                'financials.paymentStatus': PaymentStatus.PAID,   // 'paid' (lowercase, matches enum)
                'financials.paidAmount': amountPerContract,
                updatedAt: admin.firestore.Timestamp.now(),
            })
        ));
        Logger.info(`[Payments] Contracts marked as PAID: ${contractIds.join(', ')}`);
    }

    // ─── Webhook ──────────────────────────────────────────────────────────────

    static async handleWebhook(data: any) {
        const { transaction, user } = data;
        const db = getFirestore();
        const isApproved =
            transaction.status === 'success' &&
            (transaction.status_detail === 3 || transaction.status_detail === '3');
        const orderId = transaction.dev_reference;

        const orderRef = db.collection(COLLECTION_ORDERS).doc(orderId);
        await orderRef.update({
            status: isApproved ? 'SUCCESS' : 'FAILURE',
            nuveiTransactionId: transaction.id,
            authorizationCode: transaction.authorization_code ?? '',
            updatedAt: admin.firestore.Timestamp.now(),
        });

        if (isApproved) {
            const orderDoc = await orderRef.get();
            const orderData = orderDoc.data();
            const contractIds: string[] = Array.isArray(orderData?.contractIds) && orderData!.contractIds.length > 0
                ? orderData!.contractIds
                : orderData?.contractId ? [orderData.contractId] : [];

            // ── 1. Mark contracts as PAID first ───────────────────────────────
            if (contractIds.length > 0) {
                const perContract = parseFloat((transaction.amount / contractIds.length).toFixed(2));
                await this.markContractsPaid(db, contractIds, perContract);
            }

            // ── 2. Send email LAST — failure must not affect payment status ───
            try {
                const formatDate = (raw: any): string => {
                    if (!raw) return '';
                    const ms = typeof raw === 'object' && '_seconds' in raw ? raw._seconds * 1000 : 0;
                    if (!ms) return '';
                    try { return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms)); }
                    catch { return ''; }
                };
                const userName = `${user.name || ''} ${user.last_name || ''}`.trim() || 'Cliente';

                if (contractIds.length <= 1) {
                    const cDoc = contractIds[0] ? await db.collection('contracts').doc(contractIds[0]).get() : null;
                    const cData = cDoc?.exists ? cDoc.data()! : null;
                    await MailService.sendPaymentConfirmationEmail(user.email, {
                        userName,
                        orderId,
                        amount: transaction.amount,
                        transactionId: transaction.id,
                        authorizationCode: transaction.authorization_code ?? '',
                        eventName: cData?.eventDetails?.name,
                        eventDate: cData ? formatDate(cData.eventDetails?.date) : undefined,
                        eventLocation: cData?.eventDetails?.location,
                    });
                } else {
                    const contractDocs = await Promise.all(contractIds.map((id) => db.collection('contracts').doc(id).get()));
                    const perContract = parseFloat((transaction.amount / contractIds.length).toFixed(2));
                    const events = contractDocs
                        .filter((d) => d.exists)
                        .map((d) => {
                            const c = d.data()!;
                            return {
                                name: c.eventDetails?.name || 'Servicio',
                                date: formatDate(c.eventDetails?.date),
                                location: c.eventDetails?.location || '',
                                amount: c.financials?.totalAmount || perContract,
                            };
                        });
                    await MailService.sendPaymentConfirmationEmail(user.email, {
                        userName,
                        orderId,
                        amount: transaction.amount,
                        transactionId: transaction.id,
                        authorizationCode: transaction.authorization_code ?? '',
                        events,
                    });
                }
            } catch (mailErr) {
                Logger.error('[Webhook] Payment confirmed but email failed:', mailErr);
            }
        }
        return { orderId, isApproved };
    }

    // ─── Confirm checkout (client-side fallback) ──────────────────────────────

    /**
     * Called by the frontend immediately after the Checkout SDK onResponse fires.
     * Updates the order and contract in Firestore without waiting for the webhook.
     * The webhook (when it arrives) is idempotent — both paths write the same data.
     */
    static async confirmCheckout(orderKey: string, transactionId: string, amount: number): Promise<void> {
        const db = getFirestore();
        const orderRef = db.collection(COLLECTION_ORDERS).doc(orderKey);
        const orderDoc = await orderRef.get();

        // ── 1. Mark the order as SUCCESS ─────────────────────────────────────
        await orderRef.set({
            status: 'SUCCESS',
            nuveiTransactionId: transactionId,
            updatedAt: admin.firestore.Timestamp.now(),
        }, { merge: true });

        const orderData = orderDoc.exists ? orderDoc.data() : null;
        const contractIds: string[] = Array.isArray(orderData?.contractIds) && orderData!.contractIds.length > 0
            ? orderData!.contractIds
            : orderData?.contractId ? [orderData.contractId] : [];

        if (contractIds.length === 0) return;

        // ── 2. Mark ALL contracts as PAID (must succeed before email) ─────────
        const perContract = parseFloat((amount / contractIds.length).toFixed(2));
        await this.markContractsPaid(db, contractIds, perContract);

        // ── 3. Send confirmation email LAST — failure never affects the above ─
        try {
            // Fetch all contracts in parallel
            const contractDocs = await Promise.all(
                contractIds.map((id) => db.collection('contracts').doc(id).get())
            );
            const validContracts = contractDocs.filter((d) => d.exists).map((d) => d.data()!);
            if (validContracts.length === 0) return;

            // Client info comes from the first contract (all share the same client)
            const clientId = validContracts[0].clientId;
            const clientDoc = await db.collection('users').doc(clientId).get();
            const clientEmail = clientDoc.data()?.email;
            const clientName = clientDoc.data()?.displayName || 'Cliente';
            if (!clientEmail) return;

            const formatDate = (raw: any): string => {
                if (!raw) return '';
                const ms = typeof raw === 'object' && '_seconds' in raw ? raw._seconds * 1000 : 0;
                if (!ms) return '';
                try {
                    return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' })
                        .format(new Date(ms));
                } catch { return ''; }
            };

            if (contractIds.length === 1) {
                // Single payment — show event details
                const c = validContracts[0];
                await MailService.sendPaymentConfirmationEmail(clientEmail, {
                    userName: clientName,
                    orderId: orderKey,
                    amount,
                    transactionId,
                    authorizationCode: '',
                    eventName: c.eventDetails?.name,
                    eventDate: formatDate(c.eventDetails?.date),
                    eventLocation: c.eventDetails?.location,
                    contractId: contractIds[0],
                });
            } else {
                // Group payment — list all services with their dates and individual amounts
                const events = validContracts.map((c) => ({
                    name: c.eventDetails?.name || 'Servicio',
                    date: formatDate(c.eventDetails?.date),
                    location: c.eventDetails?.location || '',
                    amount: c.financials?.totalAmount || perContract,
                }));
                await MailService.sendPaymentConfirmationEmail(clientEmail, {
                    userName: clientName,
                    orderId: orderKey,
                    amount,
                    transactionId,
                    authorizationCode: '',
                    events,
                });
            }
        } catch (mailErr) {
            // Email failure is logged but NEVER propagates — payment is already confirmed above
            Logger.error('[ConfirmCheckout] Payment confirmed but email failed:', mailErr);
        }
    }

    // ─── Refund ───────────────────────────────────────────────────────────────

    /**
     * Refunds a card transaction processed via the Checkout SDK.
     * Endpoint: POST https://ccapi-stg.paymentez.com/v2/transaction/refund/
     */
    static async refundCardTransaction(transactionId: string, amount?: number): Promise<any> {
        const { NUVEI_CARDS_API_ENDPOINT } = getEnv();
        const url = `${NUVEI_CARDS_API_ENDPOINT}/v2/transaction/refund/`;
        const body: any = { transaction: { id: transactionId } };
        if (amount) body.order = { amount };
        try {
            const response = await axios.post(url, body, {
                headers: { 'Content-Type': 'application/json', 'Auth-Token': this.getCardsAuthHeader() },
            });
            Logger.info(`[PaymentsService] Refund for ${transactionId}:`, response.data);
            return response.data;
        } catch (error: any) {
            const detail = error?.response?.data ? JSON.stringify(error.response.data) : null;
            const message = detail ? `Nuvei Refund error (${error?.response?.status}): ${detail}` : error.message;
            Logger.error('[PaymentsService] Refund failed:', message);
            throw new Error(message);
        }
    }

    /**
     * Looks up a Firestore order by contractId and triggers refund if a transaction exists.
     * Called automatically when an artist rejects a contract.
     */
    static async refundByContractId(contractId: string): Promise<any> {
        const db = getFirestore();
        // Orders now use orderKey as doc ID and store contractId as a field
        const snapshot = await db.collection(COLLECTION_ORDERS)
            .where('contractId', '==', contractId)
            .where('status', '==', 'SUCCESS')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
        if (snapshot.empty) return null;
        const orderDoc = snapshot.docs[0];
        const transactionId = orderDoc.data()?.nuveiTransactionId;
        if (!transactionId) return null;
        const result = await this.refundCardTransaction(transactionId);
        await orderDoc.ref.update({ status: 'REFUNDED', updatedAt: admin.firestore.Timestamp.now() });
        return result;
    }

    // ─── Withdrawals ──────────────────────────────────────────────────────────

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
            const withdrawData: WithdrawalRequest = {
                id: withdrawRef.id,
                artistId,
                amount: payload.amount,
                status: 'PENDING',
                bankDetails: payload.bankDetails,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
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
}
