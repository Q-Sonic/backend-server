import { getFirestore, admin } from '../../config/firebase';
import { ClientProfileRecord, CreateOrUpdateClientProfileInput } from '../../types';

const COLLECTION = 'client_profiles';

export class ClientProfilesService {
    private db: admin.firestore.Firestore;

    constructor() {
        this.db = getFirestore();
    }

    async getByUid(uid: string): Promise<ClientProfileRecord | null> {
        const doc = await this.db.collection(COLLECTION).doc(uid).get();
        if (!doc.exists) return null;
        return { uid: doc.id, ...doc.data() } as ClientProfileRecord;
    }

    async createOrUpdate(uid: string, input: CreateOrUpdateClientProfileInput): Promise<ClientProfileRecord> {
        const ref = this.db.collection(COLLECTION).doc(uid);
        const now = admin.firestore.Timestamp.now();
        const doc = await ref.get();
        const existing = doc.exists ? (doc.data() as ClientProfileRecord) : null;

        const data = {
            name: (input.name ?? existing?.name ?? '').trim(),
            phone: (input.phone ?? existing?.phone ?? '').trim(),
            location: (input.location ?? existing?.location ?? '').trim(),
            photo: (input.photo ?? existing?.photo ?? '').trim(),
            updatedAt: now,
        };

        if (!doc.exists) {
            await ref.set({ ...data, uid, createdAt: now });
        } else {
            await ref.update(data);
        }

        const updated = await ref.get();
        return { uid: updated.id!, ...updated.data() } as ClientProfileRecord;
    }
}
