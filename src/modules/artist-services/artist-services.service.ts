import { getFirestore, admin } from '../../config/firebase';
import {
    ArtistFileRecord,
    ArtistFileType,
    ArtistServiceRecord,
    CreateArtistServiceInput,
    UpdateArtistServiceInput,
} from '../../types';
import { StorageService } from '../storage/storage.service';
import { extractFilePathFromStorageUrl } from '../../helper/storage';

const COLLECTION = 'artist_services';
const ARTIST_FILES_COLLECTION = 'artist_files';

export class ArtistServicesService {
    private db: admin.firestore.Firestore;
    private storageService: StorageService;

    constructor() {
        this.db = getFirestore();
        this.storageService = new StorageService();
    }

    private async validateArtistFileOwnership(
        fileId: string,
        artistId: string,
        expectedType: ArtistFileType
    ): Promise<ArtistFileRecord> {
        const fileDoc = await this.db.collection(ARTIST_FILES_COLLECTION).doc(fileId).get();
        if (!fileDoc.exists) {
            throw new Error(`Referenced ${expectedType} file does not exist`);
        }

        const fileData = { id: fileDoc.id, ...fileDoc.data() } as ArtistFileRecord;
        if (fileData.artistId !== artistId) {
            throw new Error(`Referenced ${expectedType} file does not belong to the artist`);
        }
        if (fileData.type !== expectedType) {
            throw new Error(`Referenced file is not a valid ${expectedType}`);
        }

        return fileData;
    }

    private async hydrateServiceFiles(services: ArtistServiceRecord[]): Promise<ArtistServiceRecord[]> {
        const ids = new Set<string>();
        for (const service of services) {
            if (service.contractId) ids.add(service.contractId);
            if (service.technicalRiderId) ids.add(service.technicalRiderId);
        }

        if (ids.size === 0) {
            return services.map((service) => ({
                ...service,
                contract: null,
                technicalRider: null,
            }));
        }

        const refs = [...ids].map((id) => this.db.collection(ARTIST_FILES_COLLECTION).doc(id));
        const docs = await this.db.getAll(...refs);
        const filesById = new Map<string, ArtistFileRecord>();
        for (const doc of docs) {
            if (!doc.exists) continue;
            const file = { id: doc.id, ...doc.data() } as ArtistFileRecord;
            filesById.set(file.id, file);
        }

        return services.map((service) => ({
            ...service,
            contract: service.contractId ? filesById.get(service.contractId) ?? null : null,
            technicalRider: service.technicalRiderId
                ? filesById.get(service.technicalRiderId) ?? null
                : null,
        }));
    }

    async findAllByArtistId(artistId: string): Promise<ArtistServiceRecord[]> {
        // Firestore: composite index on (artistId, createdAt) may be required; create via console if needed
        const snapshot = await this.db
            .collection(COLLECTION)
            .where('artistId', '==', artistId)
            .get();

        const services = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() } as ArtistServiceRecord))
            .sort((a, b) => {
                const at = a.createdAt?.toMillis?.() ?? 0;
                const bt = b.createdAt?.toMillis?.() ?? 0;
                return bt - at;
            });

        return this.hydrateServiceFiles(services);
    }

    async findById(id: string, artistId: string): Promise<ArtistServiceRecord> {
        const doc = await this.db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) throw new Error(`Artist service ${id} not found`);

        const data = doc.data() as Omit<ArtistServiceRecord, 'id'>;
        if (data.artistId !== artistId) {
            throw new Error('Artist service not found');
        }

        const [hydrated] = await this.hydrateServiceFiles([{ id: doc.id, ...data } as ArtistServiceRecord]);
        return hydrated;
    }

    private async syncMinPrice(artistId: string): Promise<void> {
        const services = await this.findAllByArtistId(artistId);
        const minPrice = services.length > 0 
            ? Math.min(...services.map(s => s.price))
            : 0;
        
        await this.db.collection('artist_profiles').doc(artistId).set({ minPrice }, { merge: true });
    }

    async create(artistId: string, input: CreateArtistServiceInput): Promise<ArtistServiceRecord> {
        if (!input.contractId) {
            throw new Error('contractId is required');
        }
        if (!input.technicalRiderId) {
            throw new Error('technicalRiderId is required');
        }
        await this.validateArtistFileOwnership(input.contractId, artistId, 'contract');
        await this.validateArtistFileOwnership(input.technicalRiderId, artistId, 'technical_rider');

        const now = admin.firestore.Timestamp.now();
        const record: Record<string, unknown> = {
            artistId,
            name: input.name.trim(),
            price: Number(input.price),
            description: (input.description ?? '').trim(),
            duration: (input.duration ?? '').trim(),
            features: input.features ?? [],
            imageUrl: (input.imageUrl ?? '').trim(),
            isPinned: Boolean(input.isPinned),
            contractId: input.contractId,
            technicalRiderId: input.technicalRiderId,
            createdAt: now,
            updatedAt: now,
        };

        const ref = await this.db.collection(COLLECTION).add(record);
        await this.syncMinPrice(artistId);
        const [hydrated] = await this.hydrateServiceFiles([{ id: ref.id, ...record } as ArtistServiceRecord]);
        return hydrated;
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

        if (input.contractId !== undefined) {
            if (!input.contractId) throw new Error('contractId cannot be empty');
            await this.validateArtistFileOwnership(input.contractId, artistId, 'contract');
        }
        if (input.technicalRiderId !== undefined) {
            if (!input.technicalRiderId) throw new Error('technicalRiderId cannot be empty');
            await this.validateArtistFileOwnership(input.technicalRiderId, artistId, 'technical_rider');
        }

        const updates: Record<string, unknown> = {
            updatedAt: admin.firestore.Timestamp.now(),
        };
        if (input.name !== undefined) updates.name = input.name.trim();
        if (input.price !== undefined) updates.price = Number(input.price);
        if (input.description !== undefined) updates.description = input.description.trim();
        if (input.duration !== undefined) updates.duration = input.duration.trim();
        if (input.features !== undefined) updates.features = input.features;
        if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl.trim();
        if (input.isPinned !== undefined) updates.isPinned = Boolean(input.isPinned);
        if (input.contractId !== undefined) updates.contractId = input.contractId;
        if (input.technicalRiderId !== undefined) updates.technicalRiderId = input.technicalRiderId;

        await ref.update(updates);
        await this.syncMinPrice(artistId);
        const updated = await ref.get();
        const [hydrated] = await this.hydrateServiceFiles([
            { id: updated.id, ...updated.data() } as ArtistServiceRecord,
        ]);
        return hydrated;
    }

    async detachFileReferences(artistId: string, fileId: string, fileType: ArtistFileType): Promise<void> {
        const fieldToUnset = fileType === 'contract' ? 'contractId' : 'technicalRiderId';
        const snapshot = await this.db
            .collection(COLLECTION)
            .where('artistId', '==', artistId)
            .where(fieldToUnset, '==', fileId)
            .get();

        if (snapshot.empty) return;

        const batch = this.db.batch();
        snapshot.docs.forEach((doc) => {
            batch.update(doc.ref, {
                [fieldToUnset]: admin.firestore.FieldValue.delete(),
                updatedAt: admin.firestore.Timestamp.now(),
            });
        });
        await batch.commit();
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
