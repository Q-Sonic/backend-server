import * as admin from 'firebase-admin';
import { 
    ContractRecord, 
    CreateContractInput, 
    ContractStatus, 
    PaymentStatus
} from '../../types';
import { MailService } from '../mail/mail.service';
import { PaymentsService } from '../payments/payments.service';
import { Logger } from '../../utils/logger.util';

/**
 * Contracts Service
 * Handles booking logic, legal signatures, and payment tracking.
 */
export class ContractsService {
    private static db = admin.firestore();

    private static formatDateEs(raw: admin.firestore.Timestamp | Date | string | null | undefined): string {
        let ms = 0;
        if (!raw) return '';
        if (raw instanceof admin.firestore.Timestamp) ms = raw.toMillis();
        else if (raw instanceof Date) ms = raw.getTime();
        else if (typeof raw === 'string') ms = Date.parse(raw);
        if (!ms) return '';
        try {
            return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms));
        } catch {
            return new Date(ms).toISOString().slice(0, 10);
        }
    }

    /**
     * Find a contract by ID.
     */
    static async findById(id: string, userId?: string): Promise<ContractRecord | null> {
        const doc = await this.db.collection('contracts').doc(id).get();
        if (!doc.exists) return null;
        
        const data = { id: doc.id, ...doc.data() } as ContractRecord;
        
        if (userId && data.clientId !== userId && data.artistId !== userId) {
            throw new Error('No tienes permiso para ver este contrato');
        }
        
        return data;
    }

    /**
     * Find contracts for a client with pagination.
     */
    static async findClientHistory(clientId: string, options: { skip: number; take: number; filterField?: string; filterValue?: string }) {
        let query = this.db.collection('contracts')
            .where('clientId', '==', clientId)
            .orderBy('createdAt', 'desc');

        if (options.filterField && options.filterValue) {
            query = query.where(options.filterField, '==', options.filterValue);
        }

        const snapshot = await query.limit(options.take).offset(options.skip).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    /**
     * Find contracts for an artist with pagination.
     */
    static async findArtistHistory(artistId: string, options: { skip: number; take: number; filterField?: string; filterValue?: string }) {
        let query = this.db.collection('contracts')
            .where('artistId', '==', artistId)
            .orderBy('createdAt', 'desc');

        if (options.filterField && options.filterValue) {
            query = query.where(options.filterField, '==', options.filterValue);
        }

        const snapshot = await query.limit(options.take).offset(options.skip).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    /**
     * Create a new contract (Booking Request).
     */
    static async createContract(clientId: string, input: CreateContractInput): Promise<ContractRecord> {
        const now = admin.firestore.Timestamp.now();
        
        let eventDate: admin.firestore.Timestamp;
        const rawDate = input.eventDetails.date;
        if (rawDate instanceof admin.firestore.Timestamp) {
            eventDate = rawDate;
        } else if (rawDate instanceof Date) {
            eventDate = admin.firestore.Timestamp.fromDate(rawDate);
        } else if (typeof rawDate === 'string' || typeof rawDate === 'number') {
            eventDate = admin.firestore.Timestamp.fromDate(new Date(rawDate));
        } else {
            eventDate = now;
        }

        if (!input.clientSignatureDataUrl || input.acceptedTerms !== true) {
            throw new Error('La firma del cliente y la aceptación de términos son obligatorias');
        }

        const serviceDoc = await this.db.collection('artist_services').doc(input.serviceId).get();
        if (!serviceDoc.exists) throw new Error('El servicio seleccionado no existe');
        
        const serviceData = serviceDoc.data();
        if (!serviceData?.contractId) {
            throw new Error('Este servicio no puede ser contratado porque el artista aún no ha vinculado un contrato legal al mismo.');
        }

        const sourceContractFileId = String(serviceData?.contractId || '').trim();
        let sourceContractUrl = String(serviceData?.contractUrl || serviceData?.contractPdfUrl || '').trim();
        let sourceContractOriginalName: string | undefined;

        if (sourceContractFileId) {
            const fileDoc = await this.db.collection('artist_files').doc(sourceContractFileId).get();
            if (fileDoc.exists) {
                const fd = fileDoc.data();
                if (!sourceContractUrl) sourceContractUrl = fd?.url || '';
                sourceContractOriginalName = fd?.originalName;
            }
        }

        const contractData: Omit<ContractRecord, 'id'> = {
            clientId,
            artistId: input.artistId,
            serviceId: input.serviceId,
            status: ContractStatus.PENDING,
            eventDetails: {
                name: input.eventDetails.name,
                date: eventDate,
                location: input.eventDetails.location,
                description: input.eventDetails.description ?? '',
                ...(input.eventDetails.eventDates && input.eventDetails.eventDates.length > 1
                    ? { eventDates: input.eventDetails.eventDates }
                    : {}),
            },
            financials: {
                totalAmount: input.totalAmount,
                paidAmount: 0,
                paymentStatus: PaymentStatus.UNPAID
            },
            payments: [],
            clientSignatureUrl: input.clientSignatureDataUrl,
            clientAcceptedTerms: true,
            clientSignedAt: now,
            sourceContractUrl,
            sourceContractFileId,
            sourceContractOriginalName: sourceContractOriginalName ?? '',
            riderUrl: serviceData?.riderUrl || serviceData?.technicalRiderUrl || '',
            artistDecisionDeadlineAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + (48 * 60 * 60 * 1000)),
            createdAt: now,
            updatedAt: now
        };

        const docRef = await this.db.collection('contracts').add(contractData);
        
        try {
            const artistDoc = await this.db.collection('users').doc(input.artistId).get();
            const artistEmail = artistDoc.data()?.email;
            const clientDoc = await this.db.collection('users').doc(clientId).get();
            const clientName = clientDoc.data()?.displayName || 'Un cliente';
            if (artistEmail) {
                await MailService.sendSimpleContractNotification(artistEmail, {
                    contractId: docRef.id,
                    clientName,
                    eventName: input.eventDetails.name,
                    amount: input.totalAmount
                });
            }
        } catch (mailError) {
            Logger.error('[ContractsService] Error sending notification:', mailError);
        }

        return { id: docRef.id, ...contractData } as ContractRecord;
    }

    /**
     * Update contract status (Accept/Reject/Complete).
     */
    static async updateStatus(id: string, userId: string, status: ContractStatus, options: { artistSignatureDataUrl?: string, acceptedTerms?: boolean, rejectionReason?: string }) {
        const contract = await this.findById(id, userId);
        if (!contract) throw new Error('Contract not found');

        const updates: any = { status, updatedAt: admin.firestore.Timestamp.now() };

        if (status === ContractStatus.ACCEPTED) {
            if (!options.artistSignatureDataUrl || options.acceptedTerms !== true) {
                throw new Error('Artist signature and terms acceptance required');
            }
            updates.artistSignatureUrl = options.artistSignatureDataUrl;
            updates.artistAcceptedTerms = true;
            updates.artistSignedAt = admin.firestore.Timestamp.now();

            // Send signed confirmation emails to both parties
            try {
                const [clientDoc, artistDoc] = await Promise.all([
                    this.db.collection('users').doc(contract.clientId).get(),
                    this.db.collection('users').doc(contract.artistId).get(),
                ]);
                const clientEmail = clientDoc.data()?.email;
                const artistEmail = artistDoc.data()?.email;
                const clientName = clientDoc.data()?.displayName || 'Cliente';
                const artistName = artistDoc.data()?.displayName || 'Artista';
                const eventDateLabel = this.formatDateEs(contract.eventDetails?.date as any);

                const sharedDetails = {
                    contractId: id,
                    contractUrl: contract.contractUrl,
                    serviceName: contract.eventDetails?.name || 'Servicio',
                    eventName: contract.eventDetails?.name || 'Evento',
                    artistName,
                    clientName,
                    eventDate: eventDateLabel,
                    eventLocation: contract.eventDetails?.location,
                    amount: contract.financials?.totalAmount,
                };

                if (clientEmail) {
                    await MailService.sendContractSignedNotification(clientEmail, 'client', sharedDetails);
                }
                if (artistEmail) {
                    await MailService.sendContractSignedNotification(artistEmail, 'artist', sharedDetails);
                }
            } catch (mailErr) {
                Logger.error(`[ContractsService] Error sending signed notification for ${id}:`, mailErr);
            }
        }

        if (status === ContractStatus.REJECTED) {
            updates.artistRejectionReason = options.rejectionReason || 'No especificado';

            // Auto-refund the client's payment
            try {
                await PaymentsService.refundByContractId(id);
            } catch (refundErr) {
                Logger.error(`[ContractsService] Auto-refund failed for contract ${id}:`, refundErr);
            }

            // Notify client about rejection and refund
            const rejectionPayStatus = String(contract.financials?.paymentStatus || '').toLowerCase();
            if (rejectionPayStatus === PaymentStatus.PAID) {
                try {
                    const clientDoc = await this.db.collection('users').doc(contract.clientId).get();
                    const clientEmail = clientDoc.data()?.email;
                    const clientName = clientDoc.data()?.displayName || 'Cliente';
                    const artistDoc = await this.db.collection('users').doc(contract.artistId).get();
                    const artistName = artistDoc.data()?.displayName || 'el artista';
                    if (clientEmail) {
                        await MailService.sendRefundNotificationEmail(clientEmail, {
                            userName: clientName,
                            eventName: contract.eventDetails?.name || 'Evento',
                            amount: contract.financials?.paidAmount || contract.financials?.totalAmount || 0,
                            reason: `El artista ${artistName} no pudo aceptar tu reserva`,
                            contractId: id,
                        });
                    }
                } catch (mailErr) {
                    Logger.error(`[ContractsService] Error sending rejection refund email for ${id}:`, mailErr);
                }
            }
        }

        await this.db.collection('contracts').doc(id).update(updates);
        return { ...contract, ...updates };
    }

    /**
     * Cancel a contract initiated by the client, with auto-refund if paid.
     */
    static async cancelByClient(id: string, clientId: string): Promise<ContractRecord> {
        const contract = await this.findById(id, clientId);
        if (!contract) throw new Error('Contract not found');

        if (contract.clientId !== clientId) {
            throw new Error('Solo el cliente puede cancelar este contrato');
        }

        const terminal: ContractStatus[] = [ContractStatus.CANCELLED, ContractStatus.REJECTED, ContractStatus.EXPIRED];
        if (terminal.includes(contract.status)) {
            throw new Error('El contrato ya está cancelado o expirado');
        }

        const rawStatus = String(contract.financials?.paymentStatus || '').toLowerCase();
        const wasPaid = rawStatus === PaymentStatus.PAID; // 'paid'

        const updates = {
            status: ContractStatus.CANCELLED,
            updatedAt: admin.firestore.Timestamp.now(),
        };

        await this.db.collection('contracts').doc(id).update(updates);

        // Auto-refund if the client had paid
        if (wasPaid) {
            try {
                await PaymentsService.refundByContractId(id);
            } catch (refundErr) {
                Logger.error(`[ContractsService] Client cancel refund failed for ${id}:`, refundErr);
            }
        }

        // Notify client via email
        try {
            const clientDoc = await this.db.collection('users').doc(clientId).get();
            const clientEmail = clientDoc.data()?.email;
            const clientName = clientDoc.data()?.displayName || 'Cliente';
            if (clientEmail) {
                await MailService.sendContractCancelledByClientEmail(clientEmail, {
                    userName: clientName,
                    eventName: contract.eventDetails?.name || 'Evento',
                    wasPaid,
                    amount: wasPaid ? (contract.financials?.paidAmount || contract.financials?.totalAmount || 0) : undefined,
                });
            }
        } catch (mailErr) {
            Logger.error(`[ContractsService] Cancel email failed for ${id}:`, mailErr);
        }

        return { ...contract, ...updates } as ContractRecord;
    }

    /**
     * Record a payment for a contract.
     */
    static async addPayment(id: string, userId: string, input: { amount: number; reference?: string; method?: string }) {
        const contract = await this.findById(id, userId);
        if (!contract) throw new Error('Contract not found');

        const newPayment = {
            amount: input.amount,
            reference: input.reference || '',
            method: input.method || 'cash',
            date: admin.firestore.Timestamp.now()
        };

        const newPaidAmount = (contract.financials?.paidAmount || 0) + input.amount;
        let newPaymentStatus = PaymentStatus.PARTIAL;
        if (newPaidAmount >= (contract.financials?.totalAmount || 0)) {
            newPaymentStatus = PaymentStatus.PAID;
        }

        await this.db.collection('contracts').doc(id).update({
            'financials.paidAmount': newPaidAmount,
            'financials.paymentStatus': newPaymentStatus,
            payments: admin.firestore.FieldValue.arrayUnion(newPayment),
            updatedAt: admin.firestore.Timestamp.now()
        });

        return { ...contract, financials: { ...contract.financials, paidAmount: newPaidAmount, paymentStatus: newPaymentStatus } };
    }

    /**
     * Bulk sign all PENDING contracts for an artist.
     */
    static async bulkSignAccepted(artistId: string) {
        const snapshot = await this.db.collection('contracts')
            .where('artistId', '==', artistId)
            .where('status', '==', ContractStatus.PENDING)
            .get();

        const results = snapshot.docs.map(doc => doc.id);
        return results;
    }
}
