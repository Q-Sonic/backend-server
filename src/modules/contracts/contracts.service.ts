import { admin } from '../../config/firebase';
import { ContractRecord, CreateContractInput, AddPaymentInput, PaymentItem, UserRecord } from '../../types';
import { ContractStatus, PaymentStatus } from '../../enum/contract.enum';
import { PdfService } from '../pdf/pdf.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { ArtistProfilesService } from '../artist-profiles/artist-profiles.service';
import { Logger } from '../../utils/logger.util';
import { BaseFirestoreService, PaginateOptions, PaginatedResult } from '../../helper/base.service';

const COLLECTION = 'contracts';

export class ContractsService extends BaseFirestoreService<ContractRecord> {
    private pdfService: PdfService;
    private storageService: StorageService;
    private usersService: UsersService;
    private artistProfilesService: ArtistProfilesService;

    constructor() {
        super(COLLECTION);
        this.pdfService = new PdfService();
        this.storageService = new StorageService();
        this.usersService = new UsersService();
        this.artistProfilesService = new ArtistProfilesService();
    }

    /**
     * Get client history with pagination
     */
    async findClientHistory(clientId: string, options: PaginateOptions = {}): Promise<PaginatedResult<ContractRecord>> {
        return this.paginate({
            ...options,
            tagField: 'clientId',
            tagValue: clientId
        });
    }

    /**
     * Get artist history with pagination
     */
    async findArtistHistory(artistId: string, options: PaginateOptions = {}): Promise<PaginatedResult<ContractRecord>> {
        return this.paginate({
            ...options,
            tagField: 'artistId',
            tagValue: artistId
        });
    }

    /**
     * Detailed findById with security checks
     */
    async findByIdAndUser(id: string, userId: string): Promise<ContractRecord> {
        const contract = await this.findById(id);
        if (!contract) throw new Error('Contract not found');
        
        if (contract.clientId !== userId && contract.artistId !== userId) {
            throw new Error('Access denied');
        }
        return contract;
    }

    async createContract(clientId: string, input: CreateContractInput): Promise<ContractRecord> {
        const eventDate = admin.firestore.Timestamp.fromDate(new Date(input.eventDetails.date));

        // Get artist rider if available
        let riderUrl: string | undefined;
        try {
            const artistProfile = await this.artistProfilesService.getByUid(input.artistId);
            riderUrl = artistProfile?.technicalRiderUrl;
        } catch { /* ignore if not found */ }

        const record: Omit<ContractRecord, 'id' | 'createdAt' | 'updatedAt'> = {
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
            riderUrl,
        };

        const created = await this.create(record);
        Logger.success(`Contract created: ${created.id} for artist ${input.artistId} ($${input.totalAmount})`);
        return created;
    }

    async updateStatus(id: string, userId: string, status: ContractStatus): Promise<ContractRecord> {
        const contract = await this.findByIdAndUser(id, userId);

        if (status === ContractStatus.CANCELLED) {
            if (contract.clientId !== userId) throw new Error('Unauthorized to cancel this contract');
        } else {
            if (contract.artistId !== userId) throw new Error('Only the artist can change the status');
        }

        const updateData: Partial<ContractRecord> & { contractUrl?: string } = { status };

        // --- Generate PDF only when ACCEPTED ---
        if (status === ContractStatus.ACCEPTED && !contract.contractUrl) {
            try {
                const artist = await this.usersService.findById(contract.artistId);
                const client = await this.usersService.findById(contract.clientId);
                
                const pdfBuffer = await this.pdfService.generateContractPdf(
                    contract, 
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
            }
        }

        const updated = await this.update(id, updateData);
        Logger.info(`Contract ${id} status changed: ${contract.status} -> ${status}`);
        return updated;
    }

    async addPayment(id: string, userId: string, input: AddPaymentInput): Promise<ContractRecord> {
        const contract = await this.findByIdAndUser(id, userId);
        if (contract.artistId !== userId) throw new Error('Unauthorized to register payment');

        const now = admin.firestore.Timestamp.now();
        const newPayment: PaymentItem = {
            amount: Number(input.amount),
            date: now,
            reference: input.reference || '',
            method: input.method || 'cash',
        };

        const updatedPaidAmount = Number(contract.financials.paidAmount) + newPayment.amount;
        let newPaymentStatus = PaymentStatus.PARTIAL;

        if (updatedPaidAmount >= contract.financials.totalAmount) {
            newPaymentStatus = PaymentStatus.PAID;
        } else if (updatedPaidAmount <= 0) {
            newPaymentStatus = PaymentStatus.UNPAID;
        }

        // Use standard update for metadata, but we need special arrayUnion for payments
        const ref = this.db.collection(COLLECTION).doc(id);
        await ref.update({
            payments: admin.firestore.FieldValue.arrayUnion(newPayment),
            'financials.paidAmount': updatedPaidAmount,
            'financials.paymentStatus': newPaymentStatus,
            updatedAt: now,
        });

        Logger.success(`Payment added to contract ${id}: $${newPayment.amount} (Total paid: $${updatedPaidAmount})`);
        return this.findByIdAndUser(id, userId);
    }
}
