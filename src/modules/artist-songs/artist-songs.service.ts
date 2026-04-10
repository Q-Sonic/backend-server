import { admin } from '../../config/firebase';
import { ArtistSongRecord } from '../../types';
import { StorageService } from '../storage/storage.service';
import { extractFilePathFromStorageUrl } from '../../helper/storage';
import { BaseFirestoreService, PaginateOptions, PaginatedResult } from '../../helper/base.service';

const COLLECTION = 'artist_songs';

export class ArtistSongsService extends BaseFirestoreService<ArtistSongRecord> {
    private storageService: StorageService;

    constructor() {
        super(COLLECTION);
        this.storageService = new StorageService();
    }

    /**
     * Get all songs for an artist with pagination and sorting
     */
    async findAllByArtistId(artistId: string, options: PaginateOptions = {}): Promise<PaginatedResult<ArtistSongRecord>> {
        return this.paginate({
            ...options,
            tagField: 'artistId',
            tagValue: artistId,
            orderBy: options.orderBy || 'createdAt',
            orderDirection: options.orderDirection || 'desc'
        });
    }

    /**
     * Specialized findById with artist ownership check
     */
    async findByIdAndArtist(id: string, artistId: string): Promise<ArtistSongRecord> {
        const song = await this.findById(id);
        if (!song || song.artistId !== artistId) {
            throw new Error('Artist song not found');
        }
        return song;
    }

    /**
     * Resets 'isFeatured' flag for all songs of an artist to ensure uniqueness
     */
    private async clearFeaturedForArtist(artistId: string, exceptSongId?: string): Promise<void> {
        const snapshot = await this.db
            .collection(COLLECTION)
            .where('artistId', '==', artistId)
            .where('isFeatured', '==', true)
            .get();

        if (snapshot.empty) return;
        const batch = this.db.batch();
        snapshot.docs.forEach((doc) => {
            if (exceptSongId && doc.id === exceptSongId) return;
            batch.update(doc.ref, {
                isFeatured: false,
                updatedAt: admin.firestore.Timestamp.now(),
            });
        });
        await batch.commit();
    }

    async createSong(artistId: string, input: { title: string; audioUrl: string; coverUrl?: string; isFeatured?: boolean }): Promise<ArtistSongRecord> {
        if (input.isFeatured) {
            await this.clearFeaturedForArtist(artistId);
        }
        
        return this.create({
            artistId,
            title: input.title.trim(),
            audioUrl: input.audioUrl.trim(),
            ...(input.coverUrl ? { coverUrl: input.coverUrl.trim() } : {}),
            isFeatured: !!input.isFeatured,
        });
    }

    async updateSong(id: string, artistId: string, input: { title?: string; coverUrl?: string; isFeatured?: boolean }): Promise<ArtistSongRecord> {
        const existing = await this.findByIdAndArtist(id, artistId);

        const updates: Partial<ArtistSongRecord> = {};
        if (input.title !== undefined) updates.title = input.title.trim();
        if (input.coverUrl === null) {
            // Special case for removing cover
            updates.coverUrl = admin.firestore.FieldValue.delete() as any;
        } else if (input.coverUrl !== undefined) {
            updates.coverUrl = input.coverUrl.trim();
        }
        if (input.isFeatured !== undefined) updates.isFeatured = input.isFeatured;

        if (input.isFeatured === true) {
            await this.clearFeaturedForArtist(artistId, id);
        }

        const updated = await this.update(id, updates);

        // Storage Cleanup
        if (input.coverUrl !== undefined && existing.coverUrl && existing.coverUrl !== input.coverUrl) {
            const oldCoverPath = extractFilePathFromStorageUrl(existing.coverUrl);
            if (oldCoverPath) {
                try { await this.storageService.deleteFile(oldCoverPath); } catch { /* log cleaning fail */ }
            }
        }

        return updated;
    }

    async deleteSong(id: string, artistId: string): Promise<void> {
        const existing = await this.findByIdAndArtist(id, artistId);

        // 1. Storage Cleanup
        const audioPath = extractFilePathFromStorageUrl(existing.audioUrl);
        if (audioPath) {
            try { await this.storageService.deleteFile(audioPath); } catch {}
        }
        if (existing.coverUrl) {
            const coverPath = extractFilePathFromStorageUrl(existing.coverUrl);
            if (coverPath) {
                try { await this.storageService.deleteFile(coverPath); } catch {}
            }
        }

        // 2. Database cleanup
        await this.delete(id);
    }
}
