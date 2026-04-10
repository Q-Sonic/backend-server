import { admin } from '../../config/firebase';
import {
    ArtistServiceRecord,
    CreateArtistServiceInput,
    UpdateArtistServiceInput,
} from '../../types';
import { StorageService } from '../storage/storage.service';
import { extractFilePathFromStorageUrl } from '../../helper/storage';
import { BaseFirestoreService, PaginateOptions, PaginatedResult } from '../../helper/base.service';

const COLLECTION = 'artist_services';

export class ArtistServicesService extends BaseFirestoreService<ArtistServiceRecord> {
    private storageService: StorageService;

    constructor() {
        super(COLLECTION);
        this.storageService = new StorageService();
    }

    /**
     * Get all services for a specific artist with pagination support
     */
    async findAllByArtistId(artistId: string, options: PaginateOptions = {}): Promise<PaginatedResult<ArtistServiceRecord>> {
        return this.paginate({
            ...options,
            tagField: 'artistId',
            tagValue: artistId
        });
    }

    /**
     * Specialized findById with artist ownership check
     */
    async findByIdAndArtist(id: string, artistId: string): Promise<ArtistServiceRecord> {
        const service = await this.findById(id);
        if (!service || service.artistId !== artistId) {
            throw new Error('Artist service not found');
        }
        return service;
    }

    /**
     * Logic to sync the minimum price in the artist profile
     */
    private async syncMinPrice(artistId: string): Promise<void> {
        const result = await this.findAllByArtistId(artistId, { take: 100 }); // Get up to 100 for min calculation
        const minPrice = result.data.length > 0 
            ? Math.min(...result.data.map(s => s.price))
            : 0;
        
        await this.db.collection('artist_profiles').doc(artistId).set({ minPrice }, { merge: true });
    }

    async createService(artistId: string, input: CreateArtistServiceInput): Promise<ArtistServiceRecord> {
        const service = await this.create({
            artistId,
            name: input.name.trim(),
            price: Number(input.price),
            description: (input.description ?? '').trim(),
            duration: (input.duration ?? '').trim(),
            features: input.features ?? [],
            imageUrl: (input.imageUrl ?? '').trim(),
        });

        await this.syncMinPrice(artistId);
        return service;
    }

    async updateService(
        id: string,
        artistId: string,
        input: UpdateArtistServiceInput
    ): Promise<ArtistServiceRecord> {
        // Verify ownership first
        await this.findByIdAndArtist(id, artistId);

        const updates: Partial<ArtistServiceRecord> = {};
        if (input.name !== undefined) updates.name = input.name.trim();
        if (input.price !== undefined) updates.price = Number(input.price);
        if (input.description !== undefined) updates.description = input.description.trim();
        if (input.duration !== undefined) updates.duration = input.duration.trim();
        if (input.features !== undefined) updates.features = input.features;
        if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl.trim();

        const updated = await this.update(id, updates);
        await this.syncMinPrice(artistId);
        return updated;
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
