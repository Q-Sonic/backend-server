import { getFirestore, admin } from '../../config/firebase';
import { ArtistSongRecord } from '../../types';
import { StorageService } from '../storage/storage.service';
import { extractFilePathFromStorageUrl } from '../../helper/storage';

const COLLECTION = 'artist_songs';

export class ArtistSongsService {
    private db: admin.firestore.Firestore;
    private storageService: StorageService;

    constructor() {
        this.db = getFirestore();
        this.storageService = new StorageService();
    }

    async findAllByArtistId(artistId: string): Promise<ArtistSongRecord[]> {
        const snapshot = await this.db
            .collection(COLLECTION)
            .where('artistId', '==', artistId)
            .get();
        return snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() } as ArtistSongRecord))
            .sort((a, b) => {
                const featuredDiff = Number(!!b.isFeatured) - Number(!!a.isFeatured);
                if (featuredDiff !== 0) return featuredDiff;
                return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
            });
    }

    async findById(id: string, artistId: string): Promise<ArtistSongRecord> {
        const doc = await this.db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) throw new Error('Artist song not found');
        const data = doc.data() as Omit<ArtistSongRecord, 'id'>;
        if (data.artistId !== artistId) throw new Error('Artist song not found');
        return { id: doc.id, ...data };
    }

    /**
     * Crea un nuevo registro de canción y lo asocia a un artista.
     * Lógica de consistencia:
     * 1. Si la canción se marca como 'featured', reseteamos las demás canciones del artista
     *    para que solo una sea la destacada (regla de negocio).
     * 2. El audioUrl y coverUrl ya deben venir subidos a Storage antes de llamar aquí.
     */
    async create(artistId: string, input: { title: string; audioUrl: string; coverUrl?: string; isFeatured?: boolean }): Promise<ArtistSongRecord> {
        const now = admin.firestore.Timestamp.now();
        if (input.isFeatured) {
            await this.clearFeaturedForArtist(artistId);
        }
        const record = {
            artistId,
            title: input.title.trim(),
            audioUrl: input.audioUrl.trim(),
            ...(input.coverUrl ? { coverUrl: input.coverUrl.trim() } : {}),
            isFeatured: !!input.isFeatured,
            createdAt: now,
            updatedAt: now,
        };
        const ref = await this.db.collection(COLLECTION).add(record);
        return { id: ref.id, ...record } as ArtistSongRecord;
    }

    /**
     * Actualiza metadatos de una canción.
     * Manejo de Archivos:
     * - Si se cambia la portada (coverUrl), intentamos borrar la anterior del Storage
     *   para no dejar "basura" o archivos huérfanos (Optimización de costos/espacio).
     */
    async update(id: string, artistId: string, input: { title?: string; coverUrl?: string; isFeatured?: boolean }): Promise<ArtistSongRecord> {
        const ref = this.db.collection(COLLECTION).doc(id);
        const doc = await ref.get();
        if (!doc.exists) throw new Error('Artist song not found');
        const existing = doc.data() as ArtistSongRecord;
        if (existing.artistId !== artistId) throw new Error('Artist song not found');

        const updates: Record<string, unknown> = { updatedAt: admin.firestore.Timestamp.now() };
        if (input.title !== undefined) updates.title = input.title.trim();
        if (input.coverUrl === null) {
            updates.coverUrl = admin.firestore.FieldValue.delete();
        } else if (input.coverUrl !== undefined) {
            updates.coverUrl = input.coverUrl.trim();
        }
        if (input.isFeatured !== undefined) updates.isFeatured = input.isFeatured;

        if (input.isFeatured === true) {
            await this.clearFeaturedForArtist(artistId, id);
        }
        await ref.update(updates);

        // Limpieza de Storage: Si la URL cambió, borramos el archivo viejo.
        if (input.coverUrl !== undefined && existing.coverUrl && existing.coverUrl !== input.coverUrl) {
            const oldCoverPath = extractFilePathFromStorageUrl(existing.coverUrl);
            if (oldCoverPath) {
                try { await this.storageService.deleteFile(oldCoverPath); } catch {
                    // Si falla el borrado físico, no bloqueamos la app, pero logueamos.
                }
            }
        }

        const updated = await ref.get();
        return { id: updated.id, ...updated.data() } as ArtistSongRecord;
    }

    /**
     * Reseta el flag 'isFeatured' para todas las canciones de un artista.
     * Se usa para garantizar que solo haya una canción destacada a la vez.
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

    /**
     * Eliminación Completa (Firestore + Storage).
     * Esta es la parte más sensible: si borramos de la DB pero el archivo queda
     * en el Storage, estamos perdiendo plata y orden. Intentamos borrar ambos.
     */
    async delete(id: string, artistId: string): Promise<void> {
        const doc = await this.db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) throw new Error('Artist song not found');
        const existing = doc.data() as ArtistSongRecord;
        if (existing.artistId !== artistId) throw new Error('Artist song not found');

        // 1. Borramos archivos físicos del Storage
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

        // 2. Borramos el documento de la base de datos
        await this.db.collection(COLLECTION).doc(id).delete();
    }
}
