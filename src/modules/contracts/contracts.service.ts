import { getFirestore, admin } from '../../config/firebase';
import { ContractRecord, CreateContractInput, AddPaymentInput, PaymentItem, UserRecord } from '../../types';
import { ContractStatus, PaymentStatus } from '../../enum/contract.enum';
import { PdfService } from '../pdf/pdf.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { ArtistProfilesService } from '../artist-profiles/artist-profiles.service';

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
            } catch (pdfErr) {
                console.error('Failed to generate/upload contract PDF:', pdfErr);
                // We proceed with status change even if PDF fails, 
                // but usually you want to inform or retry.
            }
        }

        await ref.update(updateData);
        const updated = await ref.get();
        return { id: updated.id, ...updated.data() } as ContractRecord;
    }

    async addPayment(id: string, userId: string, input: AddPaymentInput): Promise<ContractRecord> {
        const ref = this.db.collection(COLLECTION).doc(id);
        const doc = await ref.get();
        if (!doc.exists) throw new Error('Contract not found');
        const data = doc.data() as ContractRecord;

        if (data.artistId !== userId) throw new Error('Unauthorized to register payment');

        const now = admin.firestore.Timestamp.now();
        const newPayment: PaymentItem = {
            amount: Number(input.amount),
            date: now,
            reference: input.reference || '',
            method: input.method || 'cash',
        };

        const updatedPaidAmount = Number(data.financials.paidAmount) + newPayment.amount;
        let newPaymentStatus = PaymentStatus.PARTIAL;

        if (updatedPaidAmount >= data.financials.totalAmount) {
            newPaymentStatus = PaymentStatus.PAID;
        } else if (updatedPaidAmount <= 0) {
            newPaymentStatus = PaymentStatus.UNPAID;
        }

        await ref.update({
            payments: admin.firestore.FieldValue.arrayUnion(newPayment),
            'financials.paidAmount': updatedPaidAmount,
            'financials.paymentStatus': newPaymentStatus,
            updatedAt: now,
        });

        const updated = await ref.get();
        return { id: updated.id, ...updated.data() } as ContractRecord;
    }
}
