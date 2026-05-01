import * as admin from 'firebase-admin';
import { 
    ContractRecord, 
    CreateContractInput, 
    ContractStatus, 
    PaymentStatus
} from '../../types';
import { MailService } from '../mail/mail.service';
import { Logger } from '../../utils/logger.util';

/**
 * Contracts Service
 * Handles booking logic, legal signatures, and payment tracking.
 */
export class ContractsService {
    private static db = admin.firestore();

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
                description: input.eventDetails.description
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
            sourceContractOriginalName,
            riderUrl: serviceData?.riderUrl || serviceData?.technicalRiderUrl || '',
            artistDecisionDeadlineAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + (48 * 60 * 60 * 1000)),
            createdAt: now,
            updatedAt: now
        };

        const docRef = await this.db.collection('contracts').add(contractData);
        
        // Fix: Call with 3 arguments (legacy wrapper or full)
        try {
            const artistDoc = await this.db.collection('users').doc(input.artistId).get();
            const artistEmail = artistDoc.data()?.email;
            if (artistEmail) {
                // Using the simpler wrapper I added to MailService
                await MailService.sendSimpleContractNotification(artistEmail, {
                    contractId: docRef.id,
                    clientName: 'Un cliente',
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
        }

        if (status === ContractStatus.REJECTED) {
            updates.artistRejectionReason = options.rejectionReason || 'No especificado';
        }

        await this.db.collection('contracts').doc(id).update(updates);
        return { ...contract, ...updates };
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
