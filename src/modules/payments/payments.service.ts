import crypto from 'crypto';
import axios from 'axios';
import { getFirestore, admin } from '../../config/firebase';
import { sendPaymentConfirmationEmail } from '../mail/mail.service';
import { Logger } from '../../utils/logger.util';

const COLLECTION_ORDERS = 'orders';

export class PaymentsService {
    private db: admin.firestore.Firestore;
    private readonly apiUrl: string;
    private readonly clientKey: string;
    private readonly serverKey: string;
    private readonly serverSecret: string;

    constructor() {
        this.db = getFirestore();
        this.apiUrl = process.env.NUVEI_API_ENDPOINT || 'https://noccapi-stg.paymentez.com';
        this.clientKey = process.env.NUVEI_LTP_CLIENT_KEY || '';
        this.serverKey = process.env.NUVEI_LTP_SERVER_KEY || '';
        this.serverSecret = process.env.NUVEI_LTP_SERVER_SECRET || '';
    }

    /**
     * Generates the Auth-Token required for Nuvei/Paymentez Server-to-Server API calls.
     */
    private getAuthHeader(): string {
        const unixTimestamp = Math.floor(Date.now() / 1000).toString();
        const uniqToken = crypto
            .createHash('sha256')
            .update(this.serverSecret + unixTimestamp)
            .digest('hex');
        
        const authString = `${this.serverKey};${unixTimestamp};${uniqToken}`;
        return Buffer.from(authString).toString('base64');
    }

    /**
     * Initializes a Link To Pay order.
     */
    async createPaymentLink(payload: {
        user: { id: string; email: string; name: string; last_name: string };
        order: { 
            dev_reference: string; 
            description: string; 
            amount: number; 
            vat?: number; 
            tax_percentage?: number; 
            taxable_amount?: number; 
            installments_type?: number; 
            currency?: string; 
        };
        configuration?: {
            success_url?: string;
            failure_url?: string;
            pending_url?: string;
            review_url?: string;
        };
    }) {
        try {
            const url = `${this.apiUrl}/linktopay/init_order/`;
            
            // Standard values for Ecuador taxes if not provided
            const body = {
                user: payload.user,
                order: {
                    currency: 'USD',
                    installments_type: 0,
                    vat: payload.order.vat ?? 0,
                    taxable_amount: payload.order.taxable_amount ?? payload.order.amount,
                    tax_percentage: payload.order.tax_percentage ?? 0,
                    ...payload.order
                },
                configuration: {
                    partial_payment: false,
                    expiration_time: 86400, // 24h
                    allowed_payment_methods: ['All'],
                    success_url: 'https://q-music.app/payment/success',
                    failure_url: 'https://q-music.app/payment/failure',
                    pending_url: 'https://q-music.app/payment/pending',
                    review_url: 'https://q-music.app/payment/review',
                }
            };

            const headers = {
                'Content-Type': 'application/json',
                'Auth-Token': this.getAuthHeader(),
            };

            Logger.info('Nuvei Request Body:', body);

            const response = await axios.post(url, body, { headers });

            if (response.data.success) {
                // Store order snapshot in DB
                await this.db.collection(COLLECTION_ORDERS).doc(payload.order.dev_reference).set({
                    ...response.data.data,
                    userId: payload.user.id,
                    status: 'PENDING',
                    createdAt: admin.firestore.Timestamp.now(),
                    updatedAt: admin.firestore.Timestamp.now(),
                });

                Logger.success(`Payment link generated for order ${payload.order.dev_reference}`);
                return response.data.data;
            } else {
                const detail = typeof response.data.detail === 'object' ? JSON.stringify(response.data.detail) : response.data.detail;
                Logger.error(`Nuvei error: ${detail}`);
                throw new Error(detail);
            }
        } catch (error: any) {
            const errorData = error.response ? error.response.data : {};
            let msg = error.message;
            if (errorData) {
                const detail = errorData.detail || errorData.error?.description || errorData.error;
                msg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || error.message);
            }
            Logger.error(`Failed to create payment link: ${msg}`, { errorData });
            throw new Error(msg);
        }



    }

    /**
     * Handles the webhook callback from Nuvei.
     */
    async handleWebhook(data: any) {
        const { transaction, user } = data;
        
        // Nuvei returns success = true and status_detail = 3 for approved transactions
        const isApproved = transaction.status === 'success' && (transaction.status_detail === 3 || transaction.status_detail === '3');
        const orderId = transaction.dev_reference;

        const updateData: any = {
            status: isApproved ? 'SUCCESS' : 'FAILURE',
            nuveiTransactionId: transaction.id,
            authorizationCode: transaction.authorization_code,
            updatedAt: admin.firestore.Timestamp.now(),
        };

        // 1. Update the order status
        await this.db.collection(COLLECTION_ORDERS).doc(orderId).update(updateData);
        
        Logger.info(`Webhook received for order ${orderId}. Status: ${updateData.status}`);
        
        if (isApproved) {
            try {
                // 2. Acreditación de saldo al artista
                // La referencia de la orden es el ID del servicio (según el front)
                const serviceRef = this.db.collection('artist_services').doc(orderId);
                const serviceDoc = await serviceRef.get();
                
                if (serviceDoc.exists) {
                    const serviceData = serviceDoc.data();
                    const artistId = serviceData?.artistId;
                    const amount = Number(transaction.amount);

                    if (artistId) {
                        // Actualizar el saldo del artista (campo 'balance')
                        await this.db.collection('artist_profiles').doc(artistId).set({
                            balance: admin.firestore.FieldValue.increment(amount),
                            updatedAt: admin.firestore.Timestamp.now()
                        }, { merge: true });
                        
                        Logger.success(`Credited $${amount} to artist ${artistId}`);
                        
                        // 3. Registrar el movimiento en una colección de transacciones (opcional pero recomendado)
                        await this.db.collection('wallet_transactions').add({
                            artistId,
                            amount,
                            type: 'INCOME',
                            description: `Pago por servicio: ${serviceData?.name || 'Varios'}`,
                            orderId: orderId,
                            transactionId: transaction.id,
                            createdAt: admin.firestore.Timestamp.now()
                        });
                    }
                }

                // 4. Enviar mail de confirmación
                await sendPaymentConfirmationEmail(user.email, {
                    userName: `${user.name} ${user.last_name}`,
                    orderId: orderId,
                    amount: transaction.amount,
                    transactionId: transaction.id,
                    authorizationCode: transaction.authorization_code
                });
            } catch (err) {
                Logger.error(`Error in post-payment processing for order ${orderId}: ${err}`);
            }
        }

        return { orderId, isApproved };
    }

    /**
     * Processes a withdrawal request for an artist.
     */
    async withdraw(artistUid: string, amount: number) {
        if (amount <= 0) throw new Error('Invalid withdrawal amount');

        return await this.db.runTransaction(async (transaction) => {
            const artistRef = this.db.collection('artist_profiles').doc(artistUid);
            const artistDoc = await transaction.get(artistRef);

            if (!artistDoc.exists) throw new Error('Artist profile not found');
            
            const currentBalance = (artistDoc.data() as any).balance || 0;
            if (currentBalance < amount) {
                throw new Error('Insufficient balance');
            }

            // 1. Decrement balance
            transaction.update(artistRef, {
                balance: admin.firestore.FieldValue.increment(-amount),
                updatedAt: admin.firestore.Timestamp.now()
            });

            // 2. Register transaction
            const transRef = this.db.collection('wallet_transactions').doc();
            transaction.set(transRef, {
                artistId: artistUid,
                amount: amount,
                type: 'WITHDRAWAL',
                status: 'PENDING', // Now requires admin approval
                description: 'Retiro de fondos',
                createdAt: admin.firestore.Timestamp.now()
            });

            Logger.info(`Withdrawal processed for artist ${artistUid}: $${amount}`);
            return { newBalance: currentBalance - amount };
        });
    }

    /**
     * Processes a refund for a transaction.
     */
    async refund(transactionId: string, amount?: number, description: string = 'Refund requested by administrator') {
        try {
            const url = `${this.apiUrl}/v2/transaction/${transactionId}/refund/`;
            const body = amount ? { amount, description } : { description };

            const response = await axios.post(url, body, {
                headers: {
                    'Content-Type': 'application/json',
                    'Auth-Token': this.getAuthHeader(),
                },
            });

            Logger.info(`Refund processed for transaction ${transactionId}`);
            return response.data;
        } catch (error: any) {
            const msg = error.response?.data?.detail || error.message;
            Logger.error(`Failed to process refund: ${msg}`);
            throw new Error(msg);
        }
    }
}
