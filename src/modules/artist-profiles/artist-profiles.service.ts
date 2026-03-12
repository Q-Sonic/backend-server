import { getFirestore, admin } from '../../config/firebase';
import {
    ArtistProfileRecord,
    CreateOrUpdateArtistProfileInput,
    SocialNetworks,
} from '../../types';

const COLLECTION = 'artist_profiles';

const emptySocialNetworks: SocialNetworks = {};

export class ArtistProfilesService {
    private db: admin.firestore.Firestore;

    constructor() {
        this.db = getFirestore();
    }

    async getByUid(uid: string): Promise<ArtistProfileRecord | null> {
        const doc = await this.db.collection(COLLECTION).doc(uid).get();
        if (!doc.exists) return null;
        return { uid: doc.id, ...doc.data() } as ArtistProfileRecord;
    }

    /** List all artist profiles (for client/admin browse). */
    async listAll(): Promise<ArtistProfileRecord[]> {
        const snapshot = await this.db.collection(COLLECTION).get();
        return snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() } as ArtistProfileRecord));
    }

    async createOrUpdate(
        uid: string,
        input: CreateOrUpdateArtistProfileInput
    ): Promise<ArtistProfileRecord> {
        const ref = this.db.collection(COLLECTION).doc(uid);
        const now = admin.firestore.Timestamp.now();
        const doc = await ref.get();
        const existing = doc.exists ? (doc.data() as ArtistProfileRecord) : null;

        const socialNetworks: SocialNetworks = {
            ...(existing?.socialNetworks ?? emptySocialNetworks),
            ...(input.socialNetworks ?? {}),
        };

        const media = input.media !== undefined ? input.media : existing?.media;

        const data = {
            biography: (input.biography ?? existing?.biography ?? '').trim(),
            socialNetworks,
            photo: (input.photo ?? existing?.photo ?? '').trim(),
            city: (input.city ?? existing?.city ?? '').trim(),
            ...(media !== undefined && { media }),
            updatedAt: now,
        };

        if (!doc.exists) {
            await ref.set({ ...data, uid, createdAt: now });
        } else {
            await ref.update(data);
        }

        const updated = await ref.get();
        return { uid: updated.id!, ...updated.data() } as ArtistProfileRecord;
    }
}
