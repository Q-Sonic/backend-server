import { Response } from 'express';
import { ClientProfilesService } from './client-profiles.service';
import { StorageService } from '../storage/storage.service';
import { extractFilePathFromStorageUrl } from '../../helper/storage';
import { AuthRequest } from '../../types';
import { sendSuccess, sendNotFound, sendError, sendForbidden } from '../../utils/response.util';

const clientProfilesService = new ClientProfilesService();
const storageService = new StorageService();

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB

function getUid(req: AuthRequest): string {
    const uid = req.user?.uid;
    if (!uid) throw new Error('Unauthorized');
    return uid;
}

/** GET by ID: only admin and soporte */
export async function getClientProfileById(req: AuthRequest, res: Response): Promise<void> {
    try {
        const id = String(req.params.id);
        const profile = await clientProfilesService.getByUid(id);
        if (!profile) {
            sendNotFound(res, 'Client profile not found');
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
        const profile = await clientProfilesService.getByUid(uid);
        if (!profile) {
            sendNotFound(res, 'Client profile not found. Create it with PUT /client-profiles');
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

export async function createOrUpdateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
        const uid = getUid(req);
        const body = req.body as Record<string, string | undefined>;
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
            const existing = await clientProfilesService.getByUid(uid);
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
                `client_profiles/${uid}`
            );
        }

        const profile = await clientProfilesService.createOrUpdate(uid, {
            name: body.name,
            phone: body.phone,
            location: body.location,
            photo: photoUrl,
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
