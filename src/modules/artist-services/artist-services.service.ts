import { getFirestore, admin } from '../../config/firebase';
import {
    ArtistServiceRecord,
    CreateArtistServiceInput,
    UpdateArtistServiceInput,
} from '../../types';

const COLLECTION = 'artist_services';

export class ArtistServicesService {
    private db: admin.firestore.Firestore;

    constructor() {
        this.db = getFirestore();
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

    async create(artistId: string, input: CreateArtistServiceInput): Promise<ArtistServiceRecord> {
        const now = admin.firestore.Timestamp.now();
        const record = {
            artistId,
            name: input.name.trim(),
            price: Number(input.price),
            description: (input.description ?? '').trim(),
            createdAt: now,
            updatedAt: now,
        };

        const ref = await this.db.collection(COLLECTION).add(record);
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

        await ref.update(updates);
        const updated = await ref.get();
        return { id: updated.id, ...updated.data() } as ArtistServiceRecord;
    }

    async delete(id: string, artistId: string): Promise<void> {
        const doc = await this.db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) throw new Error(`Artist service ${id} not found`);

        const data = doc.data() as { artistId: string };
        if (data.artistId !== artistId) throw new Error('Artist service not found');

        await this.db.collection(COLLECTION).doc(id).delete();
    }
}
