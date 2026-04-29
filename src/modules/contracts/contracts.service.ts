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
const ARTIST_FILES_COLLECTION = 'artist_files';
const ARTIST_SIGNATURE_DEADLINE_DAYS = 3;

type UpdateStatusOptions = {
    artistSignatureDataUrl?: string;
    acceptedTerms?: boolean;
    rejectionReason?: string;
};

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

    private parseContractStatus(rawStatus: string | ContractStatus): ContractStatus {
        const normalized = String(rawStatus || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_');
        const allowed = Object.values(ContractStatus) as string[];
        if (!allowed.includes(normalized)) {
            throw new Error('Invalid contract status');
        }
        return normalized as ContractStatus;
    }

    private decodeSignatureDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string; extension: string } {
        const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
        if (!match) throw new Error('Invalid signature format');
        const mimeType = match[1]!;
        const base64 = match[2]!;
        const buffer = Buffer.from(base64, 'base64');
        if (!buffer.length) throw new Error('Empty signature');
        const extension = mimeType.includes('png') ? 'png' : mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'img';
        return { buffer, mimeType, extension };
    }

    private async uploadSignature(
        contractId: string,
        actor: 'client' | 'artist',
        signatureDataUrl: string,
    ): Promise<string> {
        const { buffer, mimeType, extension } = this.decodeSignatureDataUrl(signatureDataUrl);
        const fileName = `${actor}-signature.${extension}`;
        return this.storageService.uploadFile(buffer, fileName, mimeType, `contracts/${contractId}/signatures`);
    }

    private async hydrateSignedSourceContract(record: ContractRecord): Promise<ContractRecord> {
        const signedFileId = String(record.sourceContractFileId || '').trim();
        if (!signedFileId || record.sourceContractUrl) return record;
        const fileDoc = await this.db.collection(ARTIST_FILES_COLLECTION).doc(signedFileId).get();
        if (!fileDoc.exists) return record;
        const fileData = fileDoc.data() as { url?: string; originalName?: string };
        return {
            ...record,
            sourceContractUrl: String(fileData.url || '').trim() || undefined,
            sourceContractOriginalName: String(fileData.originalName || '').trim() || undefined,
        };
    }

    async findClientHistory(clientId: string): Promise<ContractRecord[]> {
        const snapshot = await this.db.collection(COLLECTION).where('clientId', '==', clientId).get();
        const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ContractRecord)).sort((a, b) => {
            const at = a.createdAt?.toMillis?.() ?? 0;
            const bt = b.createdAt?.toMillis?.() ?? 0;
            return bt - at;
        });
        const hydrated = await Promise.all(rows.map((row) => this.hydrateSignedSourceContract(row)));
        return hydrated;
    }

    async findArtistHistory(artistId: string): Promise<ContractRecord[]> {
        const snapshot = await this.db.collection(COLLECTION).where('artistId', '==', artistId).get();
        const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ContractRecord)).sort((a, b) => {
            const at = a.createdAt?.toMillis?.() ?? 0;
            const bt = b.createdAt?.toMillis?.() ?? 0;
            return bt - at;
        });
        const hydrated = await Promise.all(rows.map((row) => this.hydrateSignedSourceContract(row)));
        return hydrated;
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
        if (!input.clientSignatureDataUrl || input.acceptedTerms !== true) {
            throw new Error('Client signature and accepted terms are required');
        }

        // Validation: Artist service MUST have a contract linked
        const serviceDoc = await this.db.collection('artist_services').doc(input.serviceId).get();
        if (!serviceDoc.exists) throw new Error('El servicio seleccionado no existe');
        
        const serviceData = serviceDoc.data();
        if (!serviceData?.contractId) {
            throw new Error('Este servicio no puede ser contratado porque el artista aún no ha vinculado un contrato legal al mismo.');
        }
        const sourceContractFileId = String(serviceData?.contractId || '').trim();
        let sourceContractUrl = String(
            serviceData?.contractUrl || serviceData?.contractPdfUrl || serviceData?.documentUrl || '',
        ).trim();
        let sourceContractOriginalName: string | undefined;
        if (sourceContractFileId) {
            const signedContractFileDoc = await this.db.collection(ARTIST_FILES_COLLECTION).doc(sourceContractFileId).get();
            if (signedContractFileDoc.exists) {
                const signedContractFile = signedContractFileDoc.data() as { url?: string; originalName?: string };
                sourceContractUrl = String(signedContractFile.url || sourceContractUrl || '').trim();
                sourceContractOriginalName = String(signedContractFile.originalName || '').trim() || undefined;
            }
        }

        // Get artist rider if available
        let riderUrl: string | undefined;
        try {
            const artistProfile = await this.artistProfilesService.getByUid(input.artistId);
            riderUrl = artistProfile?.technicalRiderUrl;
        } catch { /* ignore if not found */ }

        const ref = this.db.collection(COLLECTION).doc();
        const clientSignatureUrl = await this.uploadSignature(ref.id, 'client', input.clientSignatureDataUrl);
        const artistDecisionDeadlineAt = admin.firestore.Timestamp.fromMillis(
            now.toMillis() + ARTIST_SIGNATURE_DEADLINE_DAYS * 24 * 60 * 60 * 1000,
        );

        const record: Omit<ContractRecord, 'id'> = {
            clientId,
            artistId: input.artistId,
            serviceId: input.serviceId,
            status: ContractStatus.PENDING_ARTIST_SIGNATURE,
            eventDetails: { ...input.eventDetails, date: eventDate } as any,
            financials: {
                totalAmount: Number(input.totalAmount),
                paidAmount: 0,
                paymentStatus: PaymentStatus.UNPAID,
            },
            payments: [],
            clientSignatureUrl,
            clientAcceptedTerms: true,
            clientSignedAt: now,
            artistAcceptedTerms: false,
            artistDecisionDeadlineAt,
            ...(sourceContractFileId ? { sourceContractFileId } : {}),
            ...(sourceContractUrl ? { sourceContractUrl } : {}),
            ...(sourceContractOriginalName ? { sourceContractOriginalName } : {}),
            ...(riderUrl ? { riderUrl } : {}), // Snapshotted rider only when present
            createdAt: now,
            updatedAt: now,
        };

        await ref.set(record);
        Logger.success(`Contract created: ${ref.id} for artist ${input.artistId} ($${input.totalAmount})`);
        return { id: ref.id, ...record } as ContractRecord;
    }

    async updateStatus(
        id: string,
        userId: string,
        rawStatus: string | ContractStatus,
        options: UpdateStatusOptions = {},
    ): Promise<ContractRecord> {
        const status = this.parseContractStatus(rawStatus);
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
        if (status === ContractStatus.ACCEPTED) {
            if (data.status !== ContractStatus.PENDING_ARTIST_SIGNATURE && data.status !== ContractStatus.PENDING) {
                throw new Error('Contract is not awaiting artist signature');
            }
            if (data.financials?.paymentStatus !== PaymentStatus.PAID) {
                throw new Error('Contract payment is pending. The artist can sign only after full payment.');
            }
            if (!options.artistSignatureDataUrl || options.acceptedTerms !== true) {
                throw new Error('Artist signature and accepted terms are required');
            }
            try {
                const artist = await this.usersService.findById(data.artistId);
                const client = await this.usersService.findById(data.clientId);
                const artistSignatureUrl = await this.uploadSignature(id, 'artist', options.artistSignatureDataUrl);
                const signedAt = admin.firestore.Timestamp.now();
                updateData.artistSignatureUrl = artistSignatureUrl;
                updateData.artistAcceptedTerms = true;
                updateData.artistSignedAt = signedAt;
                
                const { id: _, ...rest } = data;
                const finalContractPdf = await this.pdfService.generateContractPdf(
                    { id, ...rest, ...updateData } as ContractRecord,
                    artist as UserRecord, 
                    client as UserRecord
                );
                const signatureReceiptPdf = await this.pdfService.generateSignatureReceiptPdf(
                    { id, ...rest, ...updateData } as ContractRecord,
                    artist as UserRecord,
                    client as UserRecord,
                );
                
                const fileName = `stagego-signed-contract_${id}.pdf`;
                const contractUrl = await this.storageService.uploadFile(
                    finalContractPdf,
                    fileName,
                    'application/pdf',
                    `contracts/${id}`
                );
                const signatureReceiptUrl = await this.storageService.uploadFile(
                    signatureReceiptPdf,
                    `stagego-signature-receipt_${id}.pdf`,
                    'application/pdf',
                    `contracts/${id}`,
                );
                
                updateData.contractUrl = contractUrl;
                updateData.signatureReceiptUrl = signatureReceiptUrl;

                // --- Send Notifications ---
                const serviceDoc = await this.db.collection('artist_services').doc(data.serviceId).get();
                const serviceName = serviceDoc.data()?.name || 'Servicio Musical';

                const details = {
                    contractId: id,
                    contractUrl,
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
                throw new Error('Failed to complete artist acceptance workflow');
            }
        }

        if (status === ContractStatus.REJECTED) {
            if (data.status !== ContractStatus.PENDING_ARTIST_SIGNATURE && data.status !== ContractStatus.PENDING) {
                throw new Error('Contract cannot be rejected in current status');
            }
            const reason = String(options.rejectionReason || '').trim();
            if (reason) updateData.artistRejectionReason = reason;
            updateData.artistAcceptedTerms = false;
        }

        await ref.update(updateData);
        Logger.info(`Contract ${id} status changed: ${data.status} -> ${status}`);
        const updated = await ref.get();
        return { id: updated.id, ...updated.data() } as ContractRecord;
    }

    async bulkSignAccepted(artistId: string): Promise<{ successCount: number; errors: string[] }> {
        return {
            successCount: 0,
            errors: ['Bulk auto-sign disabled for legal compliance: artist signature is required per contract'],
        };
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
