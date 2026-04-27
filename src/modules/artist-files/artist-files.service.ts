import { admin, getFirestore } from '../../config/firebase';
import { ArtistFileRecord, ArtistFileType } from '../../types';
import { StorageService } from '../storage/storage.service';

const COLLECTION = 'artist_files';
const MAX_FILE_NAME_LEN = 200;
const MAX_FILE_DESCRIPTION_LEN = 4000;

function normalizeOptionalDescription(raw: string | undefined): string | undefined {
    if (raw === undefined) return undefined;
    const t = raw.trim();
    if (t.length > MAX_FILE_DESCRIPTION_LEN) {
        throw new Error(`Description must be at most ${MAX_FILE_DESCRIPTION_LEN} characters`);
    }
    return t.length === 0 ? undefined : t;
}

function normalizeRequiredName(raw: string | undefined): string | undefined {
    if (raw === undefined) return undefined;
    const t = raw.trim();
    if (t.length === 0) throw new Error('name cannot be empty');
    if (t.length > MAX_FILE_NAME_LEN) {
        throw new Error(`name must be at most ${MAX_FILE_NAME_LEN} characters`);
    }
    return t;
}

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
        params: { type: string; file: Express.Multer.File; name?: string; description?: string }
    ): Promise<ArtistFileRecord> {
        const type = this.sanitizeFileType(params.type);
        const now = admin.firestore.Timestamp.now();
        const uploaded = await this.storageService.uploadFileWithMetadata(
            params.file.buffer,
            params.file.originalname,
            params.file.mimetype,
            this.resolveFolder(artistId, type)
        );

        const name = normalizeRequiredName(params.name);
        const description = normalizeOptionalDescription(params.description);

        const record: Omit<ArtistFileRecord, 'id'> = {
            artistId,
            type,
            ...(name !== undefined ? { name } : {}),
            ...(description !== undefined ? { description } : {}),
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

    /**
     * Replace PDF and/or update display name and optional description.
     * At least one of `file`, `name`, or `description` must be applied (`description` may be cleared when `descriptionSent` is true).
     */
    async update(
        id: string,
        artistId: string,
        params: {
            file?: Express.Multer.File;
            name?: string;
            description?: string;
            /** When true, `description` was present in the request (empty string clears stored description). */
            descriptionSent?: boolean;
        }
    ): Promise<ArtistFileRecord> {
        const existing = await this.findOwnedByArtist(id, artistId);
        const now = admin.firestore.Timestamp.now();

        let nextName: string | undefined;
        if (params.name !== undefined) {
            nextName = normalizeRequiredName(params.name);
        }

        let nextDescription: string | FirebaseFirestore.FieldValue | undefined;
        if (params.descriptionSent) {
            nextDescription =
                normalizeOptionalDescription(params.description) ?? admin.firestore.FieldValue.delete();
        }

        const hasMetaPatch = params.name !== undefined || params.descriptionSent;
        if (!params.file && !hasMetaPatch) {
            throw new Error('Provide a new PDF and/or name or description to update');
        }

        if (params.file) {
            const uploaded = await this.storageService.uploadFileWithMetadata(
                params.file.buffer,
                params.file.originalname,
                params.file.mimetype,
                this.resolveFolder(artistId, existing.type)
            );

            const updates: Record<string, unknown> = {
                originalName: params.file.originalname,
                fileName: uploaded.fileName,
                mimeType: params.file.mimetype,
                size: params.file.size,
                storagePath: uploaded.storagePath,
                url: uploaded.url,
                updatedAt: now,
            };
            if (nextName !== undefined) updates.name = nextName;
            if (params.descriptionSent) {
                updates.description = nextDescription;
            }

            await this.db.collection(COLLECTION).doc(id).update(updates);

            if (existing.storagePath) {
                try {
                    await this.storageService.deleteFile(existing.storagePath);
                } catch {
                    // Ignore cleanup errors to avoid blocking valid replacement.
                }
            }
        } else {
            const updates: Record<string, unknown> = { updatedAt: now };
            if (nextName !== undefined) updates.name = nextName;
            if (params.descriptionSent) {
                updates.description = nextDescription;
            }
            await this.db.collection(COLLECTION).doc(id).update(updates);
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

