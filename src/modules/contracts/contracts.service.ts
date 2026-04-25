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

        const record: Omit<ContractRecord, 'id'> = {
            clientId,
            artistId: input.artistId,
            serviceId: input.serviceId,
            status: ContractStatus.PENDING,
            eventDetails: { ...input.eventDetails, date: eventDate } as any,
            financials: {
                totalAmount: Number(input.totalAmount),
                paidAmount: 0,
                paymentStatus: PaymentStatus.UNPAID,
            },
            payments: [],
            riderUrl, // Snapshotted rider
            createdAt: now,
            updatedAt: now,
        };

        const ref = await this.db.collection(COLLECTION).add(record);
        Logger.success(`Contract created: ${ref.id} for artist ${input.artistId} ($${input.totalAmount})`);
        return { id: ref.id, ...record } as ContractRecord;
    }

    async updateStatus(id: string, userId: string, status: ContractStatus): Promise<ContractRecord> {
        const ref = this.db.collection(COLLECTION).doc(id);
        const doc = await ref.get();
        if (!doc.exists) throw new Error('Contract not found');
        const data = doc.data() as ContractRecord;

        if (status === ContractStatus.CANCELLED) {
            if (data.clientId !== userId) throw new Error('Unauthorized to cancel this contract');
        } else {
            if (data.artistId !== userId) throw new Error('Only the artist can change the status');
        }

        const updateData: any = { status, updatedAt: admin.firestore.Timestamp.now() };

        // --- Generate PDF only when ACCEPTED ---
        if (status === ContractStatus.ACCEPTED && !data.contractUrl) {
            try {
                const artist = await this.usersService.findById(data.artistId);
                const client = await this.usersService.findById(data.clientId);
                
                const { id: _, ...rest } = data;
                const pdfBuffer = await this.pdfService.generateContractPdf(
                    { id, ...rest } as ContractRecord, 
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
                
                updateData.contractUrl = contractUrl;

                // --- Send Notifications ---
                const serviceDoc = await this.db.collection('artist_services').doc(data.serviceId).get();
                const serviceName = serviceDoc.data()?.name || 'Servicio Musical';

                const details = {
                    contractId: id,
                    serviceName,
                    eventName: data.eventDetails.name,
                    artistName: artist?.displayName || 'Artista',
                    clientName: client?.displayName || 'Cliente'
                };

                // Notification to Artist
                if (artist?.email) {
                    await sendContractSignedNotification(artist.email, 'artist', details);
                }

                // Notification to Client
                if (client?.email) {
                    await sendContractSignedNotification(client.email, 'client', details);
                }

                // --- Increment totalHires ---
                await this.db.collection('artist_profiles').doc(data.artistId).update({
                    totalHires: admin.firestore.FieldValue.increment(1)
                });

            } catch (pdfErr) {
                console.error('Failed to generate PDF or send notifications:', pdfErr);
            }
        }

        await ref.update(updateData);
        Logger.info(`Contract ${id} status changed: ${data.status} -> ${status}`);
        const updated = await ref.get();
        return { id: updated.id, ...updated.data() } as ContractRecord;
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
                // Here we would ideally check if terms are accepted in the doc data
                // For now, mirroring single updateStatus logic
                await this.updateStatus(doc.id, artistId, ContractStatus.ACCEPTED);
                successCount++;
            } catch (err: any) {
                errors.push(`Error en contrato ${doc.id}: ${err.message}`);
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
}
