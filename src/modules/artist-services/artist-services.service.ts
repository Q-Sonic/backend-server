import { getFirestore, admin } from '../../config/firebase';
import {
    ArtistServiceRecord,
    CreateArtistServiceInput,
    UpdateArtistServiceInput,
} from '../../types';
import { StorageService } from '../storage/storage.service';
import { extractFilePathFromStorageUrl } from '../../helper/storage';

const COLLECTION = 'artist_services';

export class ArtistServicesService {
    private db: admin.firestore.Firestore;
    private storageService: StorageService;

    constructor() {
        this.db = getFirestore();
        this.storageService = new StorageService();
    }

    async findAllByArtistId(artistId: string): Promise<ArtistServiceRecord[]> {
        // Firestore: composite index on (artistId, createdAt) may be required; create via console if needed
        const snapshot = await this.db
            .collection(COLLECTION)
            .where('artistId', '==', artistId)
            .get();

        return snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() } as ArtistServiceRecord))
            .sort((a, b) => {
                const at = a.createdAt?.toMillis?.() ?? 0;
                const bt = b.createdAt?.toMillis?.() ?? 0;
                return bt - at;
        });
    }

    async findById(id: string, artistId: string): Promise<ArtistServiceRecord> {
        const doc = await this.db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) throw new Error(`Artist service ${id} not found`);

        const data = doc.data() as Omit<ArtistServiceRecord, 'id'>;
        if (data.artistId !== artistId) {
            throw new Error('Artist service not found');
        }

        return { id: doc.id, ...data };
    }

    private async syncMinPrice(artistId: string): Promise<void> {
        const services = await this.findAllByArtistId(artistId);
        const minPrice = services.length > 0 
            ? Math.min(...services.map(s => s.price))
            : 0;
        
        await this.db.collection('artist_profiles').doc(artistId).set({ minPrice }, { merge: true });
    }

    async create(artistId: string, input: CreateArtistServiceInput): Promise<ArtistServiceRecord> {
        const now = admin.firestore.Timestamp.now();
        const record = {
            artistId,
            name: input.name.trim(),
            price: Number(input.price),
            description: (input.description ?? '').trim(),
            duration: (input.duration ?? '').trim(),
            features: input.features ?? [],
            imageUrl: (input.imageUrl ?? '').trim(),
            createdAt: now,
            updatedAt: now,
        };

        const ref = await this.db.collection(COLLECTION).add(record);
        await this.syncMinPrice(artistId);
        return { id: ref.id, ...record } as ArtistServiceRecord;
    }

    async update(
        id: string,
        artistId: string,
        input: UpdateArtistServiceInput
    ): Promise<ArtistServiceRecord> {
        const ref = this.db.collection(COLLECTION).doc(id);
        const doc = await ref.get();
        if (!doc.exists) throw new Error(`Artist service ${id} not found`);

        const data = doc.data() as { artistId: string };
        if (data.artistId !== artistId) throw new Error('Artist service not found');

        const updates: Record<string, unknown> = {
            updatedAt: admin.firestore.Timestamp.now(),
        };
        if (input.name !== undefined) updates.name = input.name.trim();
        if (input.price !== undefined) updates.price = Number(input.price);
        if (input.description !== undefined) updates.description = input.description.trim();
        if (input.duration !== undefined) updates.duration = input.duration.trim();
        if (input.features !== undefined) updates.features = input.features;
        if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl.trim();

        await ref.update(updates);
        await this.syncMinPrice(artistId);
        const updated = await ref.get();
        return { id: updated.id, ...updated.data() } as ArtistServiceRecord;
    }

    async delete(id: string, artistId: string): Promise<void> {
        const doc = await this.db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) throw new Error(`Artist service ${id} not found`);

        const data = doc.data() as { artistId: string; imageUrl?: string };
        if (data.artistId !== artistId) throw new Error('Artist service not found');

        if (data.imageUrl) {
            const oldPath = extractFilePathFromStorageUrl(data.imageUrl);
            if (oldPath) {
                try {
                    await this.storageService.deleteFile(oldPath);
                } catch {
                    // Ignore cleanup errors during delete flow.
                }
            }
        }

        await this.db.collection(COLLECTION).doc(id).delete();
        await this.syncMinPrice(artistId);
    }
}
