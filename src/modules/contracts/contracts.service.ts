import { getFirestore, admin } from '../../config/firebase';
import { ContractRecord, CreateContractInput, AddPaymentInput, PaymentItem } from '../../types';
import { ContractStatus, PaymentStatus } from '../../enum/contract.enum';

const COLLECTION = 'contracts';

export class ContractsService {
    private db: admin.firestore.Firestore;

    constructor() {
        this.db = getFirestore();
    }

    async findClientHistory(clientId: string): Promise<ContractRecord[]> {
        const snapshot = await this.db
            .collection(COLLECTION)
            .where('clientId', '==', clientId)
            .get();

        return snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() } as ContractRecord))
            .sort((a, b) => {
                const at = a.createdAt?.toMillis?.() ?? 0;
                const bt = b.createdAt?.toMillis?.() ?? 0;
                return bt - at;
            });
    }

    async findById(id: string, userId: string): Promise<ContractRecord> {
        const doc = await this.db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) throw new Error('Contract not found');

        const data = doc.data() as Omit<ContractRecord, 'id'>;

        // Security: only client or artist involved can see the contract
        if (data.clientId !== userId && data.artistId !== userId) {
            throw new Error('Access denied');
        }

        return { id: doc.id, ...data };
    }

    async create(clientId: string, input: CreateContractInput): Promise<ContractRecord> {
        const now = admin.firestore.Timestamp.now();

        // Convert input date to Firestore Timestamp
        const eventDate = admin.firestore.Timestamp.fromDate(new Date(input.eventDetails.date));

        const record: Omit<ContractRecord, 'id'> = {
            clientId,
            artistId: input.artistId,
            serviceId: input.serviceId,
            status: ContractStatus.PENDING,
            eventDetails: {
                ...input.eventDetails,
                date: eventDate,
            } as any,
            financials: {
                totalAmount: Number(input.totalAmount),
                paidAmount: 0,
                paymentStatus: PaymentStatus.UNPAID,
            },
            payments: [],
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

        // Only the artist can accept/reject/complete, or the client can cancel
        if (status === ContractStatus.CANCELLED) {
            if (data.clientId !== userId) throw new Error('Unauthorized to cancel this contract');
        } else {
            if (data.artistId !== userId) throw new Error('Only the artist can change the status');
        }

        await ref.update({
            status,
            updatedAt: admin.firestore.Timestamp.now(),
        });

        const updated = await ref.get();
        return { id: updated.id, ...updated.data() } as ContractRecord;
    }

    async addPayment(id: string, userId: string, input: AddPaymentInput): Promise<ContractRecord> {
        const ref = this.db.collection(COLLECTION).doc(id);
        const doc = await ref.get();
        if (!doc.exists) throw new Error('Contract not found');

        const data = doc.data() as ContractRecord;

        // Security: only the designated artist or admin can register payment
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
        } else if (updatedPaidAmount === 0) {
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
