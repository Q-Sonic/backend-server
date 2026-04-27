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

    private normalizeText(value?: string): string {
        return (value ?? '').trim().toLowerCase();
    }

    private toDateKey(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private chunkArray<T>(arr: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }

    private async getServicesByArtistIds(
        artistIds: string[]
    ): Promise<Map<string, Array<{ price?: number }>>> {
        const result = new Map<string, Array<{ price?: number }>>();
        if (artistIds.length === 0) return result;

        const chunks = this.chunkArray(artistIds, 30);
        for (const ids of chunks) {
            const snapshot = await this.db
                .collection('artist_services')
                .where('artistId', 'in', ids)
                .get();
            snapshot.docs.forEach((doc) => {
                const data = doc.data() as { artistId?: string; price?: number };
                const artistId = data.artistId;
                if (!artistId) return;
                const current = result.get(artistId) ?? [];
                current.push({ price: data.price });
                result.set(artistId, current);
            });
        }

        return result;
    }

    /** List and filter artist profiles (for client/admin browse). */
    async listAll(filters?: { 
        genre?: string; 
        city?: string; 
        minPrice?: number; 
        maxPrice?: number; 
        search?: string;
        availableToday?: boolean;
        date?: string;
    }): Promise<ArtistProfileRecord[]> {
        const snapshot = await this.db.collection(COLLECTION).get();
        let profiles = snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() } as ArtistProfileRecord));

        if (filters?.genre) {
            const normalizedGenre = this.normalizeText(filters.genre);
            profiles = profiles.filter((p) => this.normalizeText(p.genre) === normalizedGenre);
        }

        if (filters?.city) {
            const normalizedCity = this.normalizeText(filters.city);
            profiles = profiles.filter((p) => this.normalizeText(p.city) === normalizedCity);
        }

        if (filters?.search) {
            const s = this.normalizeText(filters.search);
            profiles = profiles.filter(p => 
                this.normalizeText(p.biography).includes(s) || 
                this.normalizeText(p.city).includes(s) ||
                (p as any).name?.toLowerCase().includes(s) ||
                (p as any).displayName?.toLowerCase().includes(s)
            );
        }

        const needsServiceFiltering =
            filters?.minPrice !== undefined || filters?.maxPrice !== undefined || filters?.availableToday === true;
        if (!needsServiceFiltering) return profiles;

        const servicesByArtistId = await this.getServicesByArtistIds(profiles.map((p) => p.uid));
        const dateKey = filters?.date
            ? filters.date
            : this.toDateKey(new Date());
        const availableTodayCache = new Map<string, boolean>();

        const filteredProfiles: ArtistProfileRecord[] = [];
        for (const profile of profiles) {
            const services = servicesByArtistId.get(profile.uid) ?? [];
            const hasServices = services.length > 0;
            if (!hasServices) {
                continue;
            }

            if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
                const hasMatchingService = services.some((service) => {
                    const price = Number(service.price);
                    if (!Number.isFinite(price)) return false;
                    if (filters?.minPrice !== undefined && price < filters.minPrice) return false;
                    if (filters?.maxPrice !== undefined && price > filters.maxPrice) return false;
                    return true;
                });
                if (!hasMatchingService) continue;
            }

            if (filters?.availableToday === true) {
                let isAvailableToday = availableTodayCache.get(profile.uid);
                if (isAvailableToday === undefined) {
                    const availability = await this.getAvailability(profile.uid);
                    const isUnavailable =
                        availability.blocked.includes(dateKey) ||
                        availability.reserved.includes(dateKey) ||
                        availability.pending.includes(dateKey);
                    isAvailableToday = !isUnavailable;
                    availableTodayCache.set(profile.uid, isAvailableToday);
                }
                if (!isAvailableToday) continue;
            }

            filteredProfiles.push(profile);
        }

        profiles = filteredProfiles;
        return profiles;
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
        const songs = input.songs !== undefined ? input.songs : existing?.songs;
        const blockedDates = input.blockedDates !== undefined ? [...new Set(input.blockedDates)] : existing?.blockedDates;
        const featuredSong = input.featuredSong !== undefined ? input.featuredSong : existing?.featuredSong;
        const technicalRiderUrl = input.technicalRiderUrl !== undefined ? input.technicalRiderUrl : existing?.technicalRiderUrl;

        const data = {
            biography: (input.biography ?? existing?.biography ?? '').trim(),
            genre: (input.genre ?? existing?.genre ?? '').trim(),
            socialNetworks,
            photo: (input.photo ?? existing?.photo ?? '').trim(),
            city: (input.city ?? existing?.city ?? '').trim(),
            ...(media !== undefined && { media }),
            ...(songs !== undefined && { songs }),
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
