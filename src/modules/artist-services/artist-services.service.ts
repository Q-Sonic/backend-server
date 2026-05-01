import { admin } from '../../config/firebase';
import {
    ArtistFileRecord,
    ArtistFileType,
    ArtistServiceRecord,
    CreateArtistServiceInput,
    UpdateArtistServiceInput,
} from '../../types';
import { StorageService } from '../storage/storage.service';
import { extractFilePathFromStorageUrl } from '../../helper/storage';
import { BaseFirestoreService, PaginateOptions, PaginatedResult } from '../../helper/base.service';

const COLLECTION = 'artist_services';
const ARTIST_FILES_COLLECTION = 'artist_files';

export class ArtistServicesService extends BaseFirestoreService<ArtistServiceRecord> {
    private storageService: StorageService;

    constructor() {
        super(COLLECTION);
        this.storageService = new StorageService();
    }

    private async validateArtistFileOwnership(
        fileId: string,
        artistId: string,
        expectedType: ArtistFileType
    ): Promise<ArtistFileRecord | null> {
        if (!fileId) return null;
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
                contract: service.contract || null,
                technicalRider: service.technicalRider || null,
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

    /**
     * Get all services for a specific artist with pagination and file hydration
     */
    async findAllByArtistId(artistId: string, options: PaginateOptions = {}): Promise<PaginatedResult<ArtistServiceRecord>> {
        const result = await this.paginate({
            ...options,
            tagField: 'artistId',
            tagValue: artistId
        });

        result.data = await this.hydrateServiceFiles(result.data);
        return result;
    }

    /**
     * Specialized findById with artist ownership check
     */
    async findByIdAndArtist(id: string, artistId: string): Promise<ArtistServiceRecord> {
        const service = await this.findById(id);
        if (!service || service.artistId !== artistId) {
            throw new Error('Artist service not found');
        }
        const [hydrated] = await this.hydrateServiceFiles([service]);
        return hydrated;
    }

    /**
     * Logic to sync the minimum price in the artist profile
     */
    private async syncMinPrice(artistId: string): Promise<void> {
        const result = await this.findAllByArtistId(artistId, { take: 100 }); 
        const minPrice = result.data.length > 0 
            ? Math.min(...result.data.map(s => s.price))
            : 0;
        
        await this.db.collection('artist_profiles').doc(artistId).set({ minPrice }, { merge: true });
    }

    async createService(artistId: string, input: CreateArtistServiceInput): Promise<ArtistServiceRecord> {
        if (input.contractId) {
            await this.validateArtistFileOwnership(input.contractId, artistId, 'contract');
        }
        if (input.technicalRiderId) {
            await this.validateArtistFileOwnership(input.technicalRiderId, artistId, 'technical_rider');
        }

        const service = await this.create({
            artistId,
            name: input.name.trim(),
            price: Number(input.price),
            description: (input.description ?? '').trim(),
            duration: (input.duration ?? '').trim(),
            features: input.features ?? [],
            imageUrl: (input.imageUrl ?? '').trim(),
            isPinned: Boolean(input.isPinned),
            contractId: input.contractId || undefined,
            technicalRiderId: input.technicalRiderId || undefined,
        });

        await this.syncMinPrice(artistId);
        const [hydrated] = await this.hydrateServiceFiles([service]);
        return hydrated;
    }

    async updateService(
        id: string,
        artistId: string,
        input: UpdateArtistServiceInput
    ): Promise<ArtistServiceRecord> {
        // Verify ownership first
        await this.findByIdAndArtist(id, artistId);

        if (input.contractId) {
            await this.validateArtistFileOwnership(input.contractId, artistId, 'contract');
        }
        if (input.technicalRiderId) {
            await this.validateArtistFileOwnership(input.technicalRiderId, artistId, 'technical_rider');
        }

        const updates: Partial<ArtistServiceRecord> = {
            updatedAt: admin.firestore.Timestamp.now() as any
        };

        if (input.name !== undefined) updates.name = input.name.trim();
        if (input.price !== undefined) updates.price = Number(input.price);
        if (input.description !== undefined) updates.description = input.description.trim();
        if (input.duration !== undefined) updates.duration = input.duration.trim();
        if (input.features !== undefined) updates.features = input.features;
        if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl.trim();
        if (input.isPinned !== undefined) updates.isPinned = Boolean(input.isPinned);
        
        if (input.contractId !== undefined) {
            updates.contractId = input.contractId || (admin.firestore.FieldValue.delete() as any);
        }
        if (input.technicalRiderId !== undefined) {
            updates.technicalRiderId = input.technicalRiderId || (admin.firestore.FieldValue.delete() as any);
        }

        const updated = await this.update(id, updates);
        await this.syncMinPrice(artistId);
        const [hydrated] = await this.hydrateServiceFiles([updated]);
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

    async deleteService(id: string, artistId: string): Promise<void> {
        const service = await this.findByIdAndArtist(id, artistId);

        if (service.imageUrl) {
            const oldPath = extractFilePathFromStorageUrl(service.imageUrl);
            if (oldPath) {
                try {
                    await this.storageService.deleteFile(oldPath);
                } catch { /* ignore cleanup errors */ }
            }
        }

        await this.delete(id);
        await this.syncMinPrice(artistId);
    }
}
