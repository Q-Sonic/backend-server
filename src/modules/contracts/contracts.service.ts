import { getFirestore, admin } from '../../config/firebase';
import { ContractRecord, CreateContractInput, AddPaymentInput, PaymentItem, UserRecord } from '../../types';
import { ContractStatus, PaymentStatus } from '../../enum/contract.enum';
import { PdfService } from '../pdf/pdf.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { ArtistProfilesService } from '../artist-profiles/artist-profiles.service';

import { Logger } from '../../utils/logger.util';
import { sendContractSignedNotification } from '../mail/mail.service';

const COLLECTION = 'contracts';

export class ContractsService {
    private db: admin.firestore.Firestore;
    private pdfService: PdfService;
    private storageService: StorageService;
    private usersService: UsersService;
    private artistProfilesService: ArtistProfilesService;

    constructor() {
        this.db = getFirestore();
        this.pdfService = new PdfService();
        this.storageService = new StorageService();
        this.usersService = new UsersService();
        this.artistProfilesService = new ArtistProfilesService();
    }

    async findClientHistory(clientId: string): Promise<ContractRecord[]> {
        const snapshot = await this.db.collection(COLLECTION).where('clientId', '==', clientId).get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ContractRecord)).sort((a, b) => {
            const at = a.createdAt?.toMillis?.() ?? 0;
            const bt = b.createdAt?.toMillis?.() ?? 0;
            return bt - at;
        });
    }

    async findArtistHistory(artistId: string): Promise<ContractRecord[]> {
        const snapshot = await this.db.collection(COLLECTION).where('artistId', '==', artistId).get();
        return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ContractRecord)).sort((a, b) => {
            const at = a.createdAt?.toMillis?.() ?? 0;
            const bt = b.createdAt?.toMillis?.() ?? 0;
            return bt - at;
        });
    }

    async findById(id: string, userId: string): Promise<ContractRecord> {
        const doc = await this.db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) throw new Error('Contract not found');
        const data = doc.data() as ContractRecord;
        if (data.clientId !== userId && data.artistId !== userId) {
            throw new Error('Access denied');
        }
        const { id: _, ...rest } = data;
        return { id: doc.id, ...rest };
    }

    async create(clientId: string, input: CreateContractInput): Promise<ContractRecord> {
        const now = admin.firestore.Timestamp.now();
        const eventDate = admin.firestore.Timestamp.fromDate(new Date(input.eventDetails.date));

        // Validation: Artist service MUST have a contract linked
        const serviceDoc = await this.db.collection('artist_services').doc(input.serviceId).get();
        if (!serviceDoc.exists) throw new Error('El servicio seleccionado no existe');
        
        const serviceData = serviceDoc.data();
        if (!serviceData?.contractId) {
            throw new Error('Este servicio no puede ser contratado porque el artista aún no ha vinculado un contrato legal al mismo.');
        }

        // Get artist rider if available
        let riderUrl: string | undefined;
        try {
            const artistProfile = await this.artistProfilesService.getByUid(input.artistId);
            riderUrl = artistProfile?.technicalRiderUrl;
        } catch { /* ignore if not found */ }

        const record: any = {
            clientId,
            artistId: input.artistId,
            serviceId: input.serviceId,
            status: ContractStatus.PENDING,
            eventDetails: { ...input.eventDetails, date: eventDate },
            financials: {
                totalAmount: Number(input.totalAmount),
                paidAmount: 0,
                paymentStatus: PaymentStatus.UNPAID,
            },
            payments: [],
            createdAt: now,
            updatedAt: now,
        };

        if (riderUrl) record.riderUrl = riderUrl;

        const ref = await this.db.collection(COLLECTION).add(record);
        Logger.success(`Contract created: ${ref.id} for artist ${input.artistId} ($${input.totalAmount})`);
        return { id: ref.id, ...record } as ContractRecord;
    }

    async updateStatus(id: string, userId: string, status: ContractStatus): Promise<ContractRecord> {
        const result = await this.db.runTransaction(async (transaction) => {
            const ref = this.db.collection(COLLECTION).doc(id);
            const doc = await transaction.get(ref);
            if (!doc.exists) throw new Error('Contract not found');
            const data = doc.data() as ContractRecord;

            if (status === ContractStatus.CANCELLED) {
                if (data.clientId !== userId) throw new Error('Unauthorized to cancel this contract');
            } else {
                if (data.artistId !== userId) throw new Error('Only the artist can change the status');
            }

            // Evitar re-procesar si ya está en el estado deseado
            if (data.status === status) return { ...data, id } as ContractRecord;

            const updateData: any = { status, updatedAt: admin.firestore.Timestamp.now() };

            // Si es aceptado, incrementamos contador de contrataciones
            if (status === ContractStatus.ACCEPTED && data.status !== ContractStatus.ACCEPTED) {
                const profileRef = this.db.collection('artist_profiles').doc(data.artistId);
                transaction.update(profileRef, {
                    totalHires: admin.firestore.FieldValue.increment(1)
                });
            }

            transaction.update(ref, updateData);
            return { ...data, ...updateData, id } as ContractRecord;
        });

        // Efectos secundarios asíncronos (No bloquean la respuesta inmediata pero se ejecutan tras el commit)
        if (status === ContractStatus.ACCEPTED && !result.contractUrl) {
            void this.processPostAcceptance(id, result);
        }

        Logger.info(`Contract ${id} status changed to ${status}`);
        return result;
    }

    private async processPostAcceptance(id: string, data: ContractRecord): Promise<void> {
        try {
            const artist = await this.usersService.findById(data.artistId);
            const client = await this.usersService.findById(data.clientId);
            
            const pdfBuffer = await this.pdfService.generateContractPdf(
                data, 
                artist as UserRecord, 
                client as UserRecord
            );
            
            const fileName = `contract_${id}.pdf`;
            const contractUrl = await this.storageService.uploadFile(
                pdfBuffer,
                fileName,
                'application/pdf',
                `contracts/${id}`
            );
            
            await this.db.collection(COLLECTION).doc(id).update({ contractUrl });

            // Notificaciones
            const serviceDoc = await this.db.collection('artist_services').doc(data.serviceId).get();
            const serviceName = serviceDoc.data()?.name || 'Servicio Musical';

            const details = {
                contractId: id,
                serviceName,
                eventName: data.eventDetails.name,
                artistName: artist?.displayName || 'Artista',
                clientName: client?.displayName || 'Cliente'
            };

            if (artist?.email) await sendContractSignedNotification(artist.email, 'artist', details);
            if (client?.email) await sendContractSignedNotification(client.email, 'client', details);

            Logger.success(`Post-acceptance processing complete for contract ${id}`);
        } catch (err) {
            Logger.error(`Error in post-acceptance for contract ${id}:`, err);
        }
    }

    async bulkSignAccepted(artistId: string): Promise<{ successCount: number; errors: string[] }> {
        const pendingSnapshot = await this.db.collection(COLLECTION)
            .where('artistId', '==', artistId)
            .where('status', '==', ContractStatus.PENDING)
            .get();

        if (pendingSnapshot.empty) {
            return { successCount: 0, errors: ['No hay contratos pendientes para firmar'] };
        }

        let successCount = 0;
        const errors: string[] = [];

        for (const doc of pendingSnapshot.docs) {
            try {
                // Cada actualización ahora es atómica por sí misma
                await this.updateStatus(doc.id, artistId, ContractStatus.ACCEPTED);
                successCount++;
            } catch (err: any) {
                errors.push(`Error en contrato ${doc.id}: ${err.message}`);
                Logger.error(`Bulk sign error for contract ${doc.id}:`, err);
            }
        }

        return { successCount, errors };
    }

    async addPayment(id: string, userId: string, input: AddPaymentInput): Promise<ContractRecord> {
        const amount = Number(input.amount);
        if (isNaN(amount) || amount <= 0) {
            throw new Error('El monto del pago debe ser un número positivo');
        }

        const now = admin.firestore.Timestamp.now();
        const newPayment: PaymentItem = {
            amount,
            date: now,
            reference: input.reference || '',
            method: input.method || 'cash',
        };

        const result = await this.db.runTransaction(async (transaction) => {
            const ref = this.db.collection(COLLECTION).doc(id);
            const doc = await transaction.get(ref);
            
            if (!doc.exists) throw new Error('Contrato no encontrado');
            
            const data = doc.data() as ContractRecord;
            if (data.artistId !== userId) {
                throw new Error('No autorizado para registrar pagos en este contrato');
            }

            const currentPaid = Number(data.financials.paidAmount) || 0;
            const totalToPay = Number(data.financials.totalAmount) || 0;
            const updatedPaidAmount = currentPaid + amount;
            
            let newPaymentStatus = PaymentStatus.PARTIAL;
            if (updatedPaidAmount >= totalToPay) {
                newPaymentStatus = PaymentStatus.PAID;
            } else if (updatedPaidAmount <= 0) {
                newPaymentStatus = PaymentStatus.UNPAID;
            }

            const updateData = {
                payments: admin.firestore.FieldValue.arrayUnion(newPayment),
                'financials.paidAmount': updatedPaidAmount,
                'financials.paymentStatus': newPaymentStatus,
                updatedAt: now,
            };

            transaction.update(ref, updateData);
            
            Logger.success(`Payment added atomically to contract ${id}: $${amount} (Total paid: $${updatedPaidAmount})`);

            // Retornamos el registro actualizado manualmente para evitar una lectura extra
            return { 
                ...data,
                id: doc.id, 
                payments: [...(data.payments || []), newPayment],
                financials: { 
                    ...data.financials, 
                    paidAmount: updatedPaidAmount, 
                    paymentStatus: newPaymentStatus 
                },
                updatedAt: now
            } as ContractRecord;
        });

        return result;
    }

    /**
     * Returns an array of date strings (YYYY-MM-DD) that are already booked (Accepted/Completed)
     */
    async getBookedDates(artistId: string): Promise<string[]> {
        const snapshot = await this.db.collection(COLLECTION)
            .where('artistId', '==', artistId)
            .where('status', 'in', [ContractStatus.ACCEPTED, ContractStatus.COMPLETED])
            .get();

        const dates = snapshot.docs.map(doc => {
            const data = doc.data() as ContractRecord;
            const eventDate = data.eventDetails.date;
            let dateStr = '';
            
            if (eventDate instanceof admin.firestore.Timestamp) {
                dateStr = eventDate.toDate().toISOString();
            } else if (typeof eventDate === 'string') {
                dateStr = eventDate;
            } else if (eventDate && typeof eventDate === 'object' && '_seconds' in eventDate) {
                dateStr = new Date((eventDate as any)._seconds * 1000).toISOString();
            }
            
            return dateStr.split('T')[0];
        }).filter(d => !!d);

        return [...new Set(dates)];
    }
}
