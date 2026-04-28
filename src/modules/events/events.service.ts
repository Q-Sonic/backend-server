import { getFirestore, admin } from '../../config/firebase';
import { ContractRecord, ExtendedContractDetail } from '../../types';
import { ContractStatus } from '../../enum/contract.enum';
import { ClientProfilesService } from '../client-profiles/client-profiles.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { extractFilePathFromStorageUrl } from '../../helper/storage';

const CONTRACTS_COLLECTION = 'contracts';

export class EventsService {
    private db: admin.firestore.Firestore;
    private clientProfilesService: ClientProfilesService;
    private storageService: StorageService;
    private usersService: UsersService;

    constructor() {
        this.db = getFirestore();
        this.clientProfilesService = new ClientProfilesService();
        this.storageService = new StorageService();
        this.usersService = new UsersService();
    }
    async getCalendarEvents(artistUid: string, startDate?: Date, endDate?: Date): Promise<ContractRecord[]> {
        let query = this.db.collection(CONTRACTS_COLLECTION)
            .where('artistId', '==', artistUid)
            .where('status', 'in', [ContractStatus.ACCEPTED, ContractStatus.COMPLETED]);

        // Filter by date if provided
        if (startDate) {
            query = query.where('eventDetails.date', '>=', admin.firestore.Timestamp.fromDate(startDate));
        }
        if (endDate) {
            query = query.where('eventDetails.date', '<=', admin.firestore.Timestamp.fromDate(endDate));
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ContractRecord))
            .sort((a, b) => {
                const at = a.eventDetails?.date?.toMillis?.() || 0;
                const bt = b.eventDetails?.date?.toMillis?.() || 0;
                return at - bt;
            });
    }

    async getClientCalendarEvents(clientUid: string, startDate?: Date, endDate?: Date): Promise<ContractRecord[]> {
        let query = this.db.collection(CONTRACTS_COLLECTION)
            .where('clientId', '==', clientUid)
            .where('status', 'in', [ContractStatus.ACCEPTED, ContractStatus.COMPLETED]);

        if (startDate) {
            query = query.where('eventDetails.date', '>=', admin.firestore.Timestamp.fromDate(startDate));
        }
        if (endDate) {
            query = query.where('eventDetails.date', '<=', admin.firestore.Timestamp.fromDate(endDate));
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ContractRecord))
            .sort((a, b) => {
                const at = a.eventDetails?.date?.toMillis?.() || 0;
                const bt = b.eventDetails?.date?.toMillis?.() || 0;
                return at - bt;
            });
    }

    async getExtendedEventDetail(contractId: string, userUid: string): Promise<ExtendedContractDetail> {
        const doc = await this.db.collection(CONTRACTS_COLLECTION).doc(contractId).get();
        if (!doc.exists) throw new Error('Contract not found');

        const data = doc.data() as ContractRecord;
        if (data.artistId !== userUid && data.clientId !== userUid) {
            throw new Error('Unauthorized access to this event');
        }

        const detail = { ...data, id: doc.id } as ExtendedContractDetail;

        // 1. Get Client Contact Info
        try {
            const clientProfile = await this.clientProfilesService.getByUid(data.clientId);
            const clientUser = await this.usersService.findById(data.clientId);

            detail.clientContact = {
                name: clientProfile?.name || clientUser?.displayName || 'Unknown',
                email: clientUser?.email || '',
                phone: clientProfile?.phone || '',
            };
        } catch (e) {
            console.error('Error fetching client contact info:', e);
        }

        // 2. Get Service Info
        try {
            const serviceDoc = await this.db.collection('artist_services').doc(data.serviceId).get();
            if (serviceDoc.exists) {
                detail.serviceName = serviceDoc.data()?.name || 'Servicio Musical';
            }
        } catch (e) {
            console.error('Error fetching service info:', e);
        }

        // 3. Get Artist Info
        try {
            const artistUser = await this.usersService.findById(data.artistId);
            detail.artistName = artistUser?.displayName || 'Artista';
        } catch (e) {
            console.error('Error fetching artist info:', e);
        }

        // 4. Generate Temporary Download Links
        if (data.riderUrl) {
            const riderPath = extractFilePathFromStorageUrl(data.riderUrl);
            if (riderPath) {
                detail.riderDownloadUrl = await this.storageService.getSignedUrl(riderPath);
            }
        }

        if (data.contractUrl) {
            const contractPath = extractFilePathFromStorageUrl(data.contractUrl);
            if (contractPath) {
                detail.contractDownloadUrl = await this.storageService.getSignedUrl(contractPath);
            }
        }

        return detail;
    }
}
