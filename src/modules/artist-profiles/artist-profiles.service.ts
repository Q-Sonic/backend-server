import { getFirestore, admin } from '../../config/firebase';
import {
    ArtistProfileRecord,
    CreateOrUpdateArtistProfileInput,
    SocialNetworks,
    ArtistAvailability,
    ArtistProfileMediaItem,
} from '../../types';
import { ContractStatus } from '../../enum/contract.enum';

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
        const blockedDates = input.blockedDates !== undefined ? input.blockedDates : existing?.blockedDates;
        const featuredSong = input.featuredSong !== undefined ? input.featuredSong : existing?.featuredSong;
        const technicalRiderUrl = input.technicalRiderUrl !== undefined ? input.technicalRiderUrl : existing?.technicalRiderUrl;

        const data = {
            biography: (input.biography ?? existing?.biography ?? '').trim(),
            socialNetworks,
            photo: (input.photo ?? existing?.photo ?? '').trim(),
            city: (input.city ?? existing?.city ?? '').trim(),
            ...(media !== undefined && { media }),
            ...(blockedDates !== undefined && { blockedDates }),
            ...(featuredSong !== undefined && { featuredSong }),
            ...(technicalRiderUrl !== undefined && { technicalRiderUrl }),
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

    /** Helper: get format YYYY-MM-DD from Timestamp or Date */
    private formatDate(date: any): string {
        try {
            const d = date?.toDate ? date.toDate() : new Date(date);
            return d.toISOString().split('T')[0];
        } catch {
            return '';
        }
    }

    /** Get availability status (blocked, reserved, pending). */
    async getAvailability(uid: string): Promise<ArtistAvailability> {
        const profile = await this.getByUid(uid);
        const availability: ArtistAvailability = {
            blocked: profile?.blockedDates || [],
            reserved: [],
            pending: [],
        };

        // Query all contracts for this artist
        const contractsSnapshot = await this.db.collection('contracts')
            .where('artistId', '==', uid)
            .where('status', 'in', [ContractStatus.ACCEPTED, ContractStatus.PENDING, ContractStatus.COMPLETED])
            .get();

        contractsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const dateStr = this.formatDate(data.eventDetails?.date);
            if (!dateStr) return;

            if (data.status === ContractStatus.ACCEPTED || data.status === ContractStatus.COMPLETED) {
                availability.reserved.push(dateStr);
            } else if (data.status === ContractStatus.PENDING) {
                availability.pending.push(dateStr);
            }
        });

        // Deduplicate strings
        availability.reserved = [...new Set(availability.reserved)];
        availability.pending = [...new Set(availability.pending)];

        return availability;
    }

    /** Increment visit count and daily history. */
    async incrementVisits(uid: string): Promise<void> {
        const ref = this.db.collection(COLLECTION).doc(uid);
        const todayStr = new Date().toISOString().split('T')[0];

        await this.db.runTransaction(async (transaction) => {
            const doc = await transaction.get(ref);
            if (!doc.exists) return;

            const data = doc.data() as ArtistProfileRecord;
            const currentTotal = (data as any).totalVisits || 0;
            const currentHistory = (data as any).visitsHistory || {};
            const todayCount = currentHistory[todayStr] || 0;

            transaction.update(ref, {
                totalVisits: currentTotal + 1,
                [`visitsHistory.${todayStr}`]: todayCount + 1,
                updatedAt: admin.firestore.Timestamp.now(),
            });
        });
    }

    async addMedia(uid: string, items: ArtistProfileMediaItem[]): Promise<void> {
        const ref = this.db.collection(COLLECTION).doc(uid);
        await ref.update({
            media: admin.firestore.FieldValue.arrayUnion(...items),
            updatedAt: admin.firestore.Timestamp.now(),
        });
    }

    async removeMedia(uid: string, item: ArtistProfileMediaItem): Promise<void> {
        const ref = this.db.collection(COLLECTION).doc(uid);
        await ref.update({
            media: admin.firestore.FieldValue.arrayRemove(item),
            updatedAt: admin.firestore.Timestamp.now(),
        });
    }
}
