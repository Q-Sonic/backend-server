import { Response } from 'express';
import { ArtistProfilesService } from './artist-profiles.service';
import { StorageService } from '../storage/storage.service';
import { extractFilePathFromStorageUrl } from '../../helper/storage';
import { AuthRequest } from '../../types';
import { sendSuccess, sendNotFound, sendError, sendForbidden } from '../../utils/response.util';
import { UserRoleEnum } from '../../enum/roles.enum';

const artistProfilesService = new ArtistProfilesService();
const storageService = new StorageService();

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB

function getUid(req: AuthRequest): string {
    const uid = req.user?.uid;
    if (!uid) throw new Error('Unauthorized');
    return uid;
}

/** GET by ID: artist (only own), client, admin, soporte (any artist) */
export async function getArtistProfileById(req: AuthRequest, res: Response): Promise<void> {
    try {
        const id = String(req.params.id);
        const role = req.user?.role as string | undefined;
        if (role === UserRoleEnum.ARTISTA && req.user?.uid !== id) {
            sendForbidden(res, 'Artists can only view their own profile by ID');
            return;
        }
        const profile = await artistProfilesService.getByUid(id);
        if (!profile) {
            sendNotFound(res, 'Artist profile not found');
            return;
        }
        sendSuccess(res, profile);
    } catch (err) {
        sendError({
            res,
            error: err instanceof Error ? err.message : 'Failed to get profile',
            statusCode: 500,
        });
    }
}

export async function getMyProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
        const uid = getUid(req);
        const profile = await artistProfilesService.getByUid(uid);
        if (!profile) {
            sendNotFound(res, 'Artist profile not found. Create it with PUT /artist-profiles');
            return;
        }
        sendSuccess(res, profile);
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendError({
            res,
            error: err instanceof Error ? err.message : 'Failed to get profile',
            statusCode: 500,
        });
    }
}

function parseSocialNetworks(body: Record<string, unknown>): Record<string, string> | undefined {
    if (body.socialNetworks && typeof body.socialNetworks === 'object') {
        return body.socialNetworks as Record<string, string>;
    }
    const keys = ['instagram', 'facebook', 'twitter', 'youtube', 'tiktok'];
    const out: Record<string, string> = {};
    for (const k of keys) {
        if (typeof body[k] === 'string') out[k] = body[k] as string;
    }
    return Object.keys(out).length ? out : undefined;
}

export async function createOrUpdateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
        const uid = getUid(req);
        const body = req.body as Record<string, unknown>;
        let photoUrl = typeof body.photo === 'string' ? body.photo : undefined;

        if (req.file) {
            if (!ALLOWED_IMAGE_TYPES.includes(req.file.mimetype)) {
                sendError({ res, error: 'Photo must be an image (jpeg, png, webp, gif)', statusCode: 400 });
                return;
            }
            if (req.file.size > MAX_PHOTO_SIZE) {
                sendError({ res, error: 'Photo too large. Maximum size is 5 MB', statusCode: 400 });
                return;
            }
            const existing = await artistProfilesService.getByUid(uid);
            if (existing?.photo) {
                const oldPath = extractFilePathFromStorageUrl(existing.photo);
                if (oldPath) {
                    try {
                        await storageService.deleteFile(oldPath);
                    } catch {
                        // ignore: file may already be deleted
                    }
                }
            }
            const ext = req.file.originalname.split('.').pop() || 'jpg';
            const fileName = `photo_${Date.now()}.${ext}`;
            photoUrl = await storageService.uploadFile(
                req.file.buffer,
                fileName,
                req.file.mimetype,
                `artist_profiles/${uid}`
            );
        }

        const profile = await artistProfilesService.createOrUpdate(uid, {
            biography: typeof body.biography === 'string' ? body.biography : undefined,
            socialNetworks: parseSocialNetworks(body),
            photo: photoUrl,
            city: typeof body.city === 'string' ? body.city : undefined,
        });
        sendSuccess(res, profile, 'Profile saved');
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendError({
            res,
            error: err instanceof Error ? err.message : 'Failed to save profile',
            statusCode: 400,
        });
    }
}
