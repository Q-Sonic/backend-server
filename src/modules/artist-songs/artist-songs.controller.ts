import { Response } from 'express';
import { AuthRequest } from '../../types';
import { sendCreated, sendError, sendForbidden, sendSuccess } from '../../utils/response.util';
import { ArtistSongsService } from './artist-songs.service';
import { StorageService } from '../storage/storage.service';
import { MAX_AUDIO_SIZE, MAX_IMAGE_SIZE } from '../../helper/storage';

const artistSongsService = new ArtistSongsService();
const storageService = new StorageService();

const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function parseOptionalBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
    return undefined;
}

function getArtistId(req: AuthRequest): string {
    const uid = req.user?.uid;
    if (!uid) throw new Error('Unauthorized');
    return uid;
}

export async function listMySongs(req: AuthRequest, res: Response): Promise<void> {
    try {
        const artistId = getArtistId(req);
        const songs = await artistSongsService.findAllByArtistId(artistId);
        sendSuccess(res, songs);
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendError({ res, error: err instanceof Error ? err.message : 'Failed to list songs', statusCode: 500 });
    }
}

export async function listSongsByArtistId(req: AuthRequest, res: Response): Promise<void> {
    try {
        const songs = await artistSongsService.findAllByArtistId(String(req.params.artistId));
        sendSuccess(res, songs);
    } catch (err) {
        sendError({ res, error: err instanceof Error ? err.message : 'Failed to list songs', statusCode: 500 });
    }
}

export async function createSong(req: AuthRequest, res: Response): Promise<void> {
    try {
        const artistId = getArtistId(req);
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        const audio = files?.audio?.[0];
        const cover = files?.cover?.[0];
        const title = String(req.body?.title ?? '').trim();
        const isFeatured = parseOptionalBoolean(req.body?.isFeatured);

        if (!audio) {
            sendError({ res, error: 'audio file is required', statusCode: 400 });
            return;
        }
        if (!ALLOWED_AUDIO_TYPES.includes(audio.mimetype) || audio.size > MAX_AUDIO_SIZE) {
            sendError({ res, error: 'Invalid audio file', statusCode: 400 });
            return;
        }
        if (cover && (!ALLOWED_IMAGE_TYPES.includes(cover.mimetype) || cover.size > MAX_IMAGE_SIZE)) {
            sendError({ res, error: 'Invalid cover image', statusCode: 400 });
            return;
        }

        const audioUrl = await storageService.uploadFile(
            audio.buffer,
            audio.originalname,
            audio.mimetype,
            `artist_songs/${artistId}/audio`
        );
        let coverUrl: string | undefined;
        if (cover) {
            coverUrl = await storageService.uploadFile(
                cover.buffer,
                cover.originalname,
                cover.mimetype,
                `artist_songs/${artistId}/covers`
            );
        }

        const created = await artistSongsService.create(artistId, {
            title: title || audio.originalname.replace(/\.[^/.]+$/, ''),
            audioUrl,
            coverUrl,
            ...(isFeatured !== undefined ? { isFeatured } : {}),
        });
        sendCreated(res, created, 'Song created');
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendError({ res, error: err instanceof Error ? err.message : 'Failed to create song', statusCode: 400 });
    }
}

export async function updateSong(req: AuthRequest, res: Response): Promise<void> {
    try {
        const artistId = getArtistId(req);
        const id = String(req.params.id);
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        const cover = files?.cover?.[0];
        const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
        const isFeatured = parseOptionalBoolean(req.body?.isFeatured);

        let coverUrl: string | undefined;
        if (cover) {
            if (!ALLOWED_IMAGE_TYPES.includes(cover.mimetype) || cover.size > MAX_IMAGE_SIZE) {
                sendError({ res, error: 'Invalid cover image', statusCode: 400 });
                return;
            }
            coverUrl = await storageService.uploadFile(
                cover.buffer,
                cover.originalname,
                cover.mimetype,
                `artist_songs/${artistId}/covers`
            );
        }

        const updated = await artistSongsService.update(id, artistId, {
            ...(title !== undefined ? { title } : {}),
            ...(coverUrl !== undefined ? { coverUrl } : {}),
            ...(isFeatured !== undefined ? { isFeatured } : {}),
        });
        sendSuccess(res, updated, 'Song updated');
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendError({ res, error: err instanceof Error ? err.message : 'Failed to update song', statusCode: 400 });
    }
}

export async function deleteSong(req: AuthRequest, res: Response): Promise<void> {
    try {
        const artistId = getArtistId(req);
        await artistSongsService.delete(String(req.params.id), artistId);
        sendSuccess(res, null, 'Song deleted');
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendError({ res, error: err instanceof Error ? err.message : 'Failed to delete song', statusCode: 400 });
    }
}
