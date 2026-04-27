import { admin, getFirestore } from '../../config/firebase';
import { ArtistFileRecord, ArtistFileType } from '../../types';
import { StorageService } from '../storage/storage.service';

const COLLECTION = 'artist_files';

export class ArtistFilesService {
    private db: admin.firestore.Firestore;
    private storageService: StorageService;

    constructor() {
        this.db = getFirestore();
        this.storageService = new StorageService();
    }

    private sanitizeFileType(type: string): ArtistFileType {
        if (type === 'contract' || type === 'technical_rider') return type;
        throw new Error('Invalid file type. Allowed values: contract, technical_rider');
    }

    private resolveFolder(artistId: string, type: ArtistFileType): string {
        return `artists/${artistId}/files/${type}`;
    }

    async create(
        artistId: string,
        params: { type: string; file: Express.Multer.File }
    ): Promise<ArtistFileRecord> {
        const type = this.sanitizeFileType(params.type);
        const now = admin.firestore.Timestamp.now();
        const uploaded = await this.storageService.uploadFileWithMetadata(
            params.file.buffer,
            params.file.originalname,
            params.file.mimetype,
            this.resolveFolder(artistId, type)
        );

        const record: Omit<ArtistFileRecord, 'id'> = {
            artistId,
            type,
            originalName: params.file.originalname,
            fileName: uploaded.fileName,
            mimeType: params.file.mimetype,
            size: params.file.size,
            storagePath: uploaded.storagePath,
            url: uploaded.url,
            createdAt: now,
            updatedAt: now,
        };

        const ref = await this.db.collection(COLLECTION).add(record);
        return { id: ref.id, ...record };
    }

    async listByArtist(artistId: string, type?: string): Promise<ArtistFileRecord[]> {
        let query: admin.firestore.Query = this.db.collection(COLLECTION).where('artistId', '==', artistId);
        if (type) {
            query = query.where('type', '==', this.sanitizeFileType(type));
        }
        const snapshot = await query.get();
        return snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() } as ArtistFileRecord))
            .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    }

    async findById(id: string): Promise<ArtistFileRecord | null> {
        const doc = await this.db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as ArtistFileRecord;
    }

    async findOwnedByArtist(id: string, artistId: string): Promise<ArtistFileRecord> {
        const file = await this.findById(id);
        if (!file) throw new Error('Artist file not found');
        if (file.artistId !== artistId) throw new Error('Artist file not found');
        return file;
    }

    async replace(
        id: string,
        artistId: string,
        params: { file: Express.Multer.File }
    ): Promise<ArtistFileRecord> {
        const existing = await this.findOwnedByArtist(id, artistId);
        const uploaded = await this.storageService.uploadFileWithMetadata(
            params.file.buffer,
            params.file.originalname,
            params.file.mimetype,
            this.resolveFolder(artistId, existing.type)
        );

        const updates: Partial<ArtistFileRecord> = {
            originalName: params.file.originalname,
            fileName: uploaded.fileName,
            mimeType: params.file.mimetype,
            size: params.file.size,
            storagePath: uploaded.storagePath,
            url: uploaded.url,
            updatedAt: admin.firestore.Timestamp.now(),
        };

        await this.db.collection(COLLECTION).doc(id).update(updates);

        if (existing.storagePath) {
            try {
                await this.storageService.deleteFile(existing.storagePath);
            } catch {
                // Ignore cleanup errors to avoid blocking valid replacement.
            }
        }

        const updated = await this.findById(id);
        if (!updated) throw new Error('Artist file not found');
        return updated;
    }

    async delete(id: string, artistId: string): Promise<ArtistFileRecord> {
        const existing = await this.findOwnedByArtist(id, artistId);

        if (existing.storagePath) {
            try {
                await this.storageService.deleteFile(existing.storagePath);
            } catch {
                // Continue with record cleanup even if storage delete fails.
            }
        }

        await this.db.collection(COLLECTION).doc(id).delete();
        return existing;
    }
}

