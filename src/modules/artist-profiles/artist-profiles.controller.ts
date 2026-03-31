import { Request, Response } from 'express';
import { ArtistProfilesService } from './artist-profiles.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { extractFilePathFromStorageUrl } from '../../helper/storage';
import { AuthRequest, ArtistProfileMediaItem } from '../../types';
import { sendSuccess, sendNotFound, sendError, sendForbidden } from '../../utils/response.util';
import { UserRoleEnum } from '../../enum/roles.enum';

const artistProfilesService = new ArtistProfilesService();
const storageService = new StorageService();
const usersService = new UsersService();

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_PDF_TYPES = ['application/pdf'];
import { MAX_IMAGE_SIZE, MAX_PDF_SIZE, MAX_VIDEO_SIZE, MAX_AUDIO_SIZE } from '../../helper/storage';

function getUid(req: AuthRequest): string {
    const uid = req.user?.uid;
    if (!uid) throw new Error('Unauthorized');
    return uid;
}

/** GET list: all artist profiles with filters (cliente, admin, organizacion, soporte) */
export async function listArtistProfiles(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { genre, city, minPrice, maxPrice, search, availableToday } = req.query;

        const filters = {
            genre: typeof genre === 'string' ? genre : undefined,
            city: typeof city === 'string' ? city : undefined,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            search: typeof search === 'string' ? search : undefined,
        };

        let profiles = await artistProfilesService.listAll(filters);
        const uids = profiles.map((p) => p.uid);
        const displayNames = await usersService.getDisplayNamesByUids(uids);

        // 1. Enrich with display name
        let list = profiles.map((p) => ({
            ...p,
            displayName: displayNames[p.uid] ?? '',
        }));

        // 2. Filter by "Available Today" if needed
        if (availableToday === 'true') {
            const todayStr = new Date().toISOString().split('T')[0];
            const filtered = [];
            for (const item of list) {
                const availability = await artistProfilesService.getAvailability(item.uid);
                const isUnavailable = availability.blocked.includes(todayStr) || 
                                    availability.reserved.includes(todayStr) || 
                                    availability.pending.includes(todayStr);
                if (!isUnavailable) {
                    filtered.push(item);
                }
            }
            list = filtered;
        }

        sendSuccess(res, list);
    } catch (err: any) {
        sendError({
            res,
            error: err instanceof Error ? err.message : 'Failed to list artist profiles',
            statusCode: 500,
        });
    }
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

        // Increment visit if viewed by client or different artist
        if (req.user?.uid !== id) {
            artistProfilesService.incrementVisits(id).catch(console.error);
        }

        sendSuccess(res, profile);
    } catch (err: any) {
        sendError({ res, error: err.message, statusCode: 500 });
    }
}

/** GET availability status (blocked, reserved, pending) */
export async function getArtistAvailability(req: Request, res: Response): Promise<void> {
    try {
        const id = String(req.params.id);
        const availability = await artistProfilesService.getAvailability(id);
        sendSuccess(res, availability);
    } catch (error: any) {
        sendError({ res, error: error.message, statusCode: 500 });
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
    } catch (err: any) {
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
    const keys = ['instagram', 'facebook', 'twitter', 'youtube', 'tiktok'];
    const fromObject =
        body.socialNetworks && typeof body.socialNetworks === 'object'
            ? (body.socialNetworks as Record<string, unknown>)
            : undefined;
    const out: Record<string, string> = {};
    for (const k of keys) {
        if (fromObject && typeof fromObject[k] === 'string') out[k] = fromObject[k] as string;
        if (typeof body[k] === 'string') out[k] = body[k] as string;
    }
    return Object.keys(out).length ? out : undefined;
}

function parseMedia(value: unknown): ArtistProfileMediaItem[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const allowed: ArtistProfileMediaItem['type'][] = ['image', 'audio', 'video'];
    const out: ArtistProfileMediaItem[] = [];
    for (const item of value) {
        if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).url === 'string') {
            const raw = item as Record<string, unknown>;
            const type = allowed.includes((raw.type as ArtistProfileMediaItem['type']) ?? '') ? (raw.type as ArtistProfileMediaItem['type']) : 'image';
            out.push({
                url: String(raw.url),
                type,
                name: typeof raw.name === 'string' ? raw.name : undefined,
                coverUrl: typeof raw.coverUrl === 'string' ? raw.coverUrl : undefined,
                category: typeof raw.category === 'string' ? raw.category : undefined,
            });
        }
    }
    return out;
}

function parseSongs(value: unknown): { url: string; title: string; coverUrl?: string }[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const out: { url: string; title: string; coverUrl?: string }[] = [];
    for (const item of value) {
        if (!item || typeof item !== 'object') continue;
        const raw = item as Record<string, unknown>;
        if (typeof raw.url !== 'string' || typeof raw.title !== 'string') continue;
        out.push({
            url: raw.url,
            title: raw.title,
            ...(typeof raw.coverUrl === 'string' ? { coverUrl: raw.coverUrl } : {}),
        });
    }
    return out;
}

export async function createOrUpdateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
        const uid = getUid(req);
        const body = req.body as Record<string, unknown>;
        if (typeof body.socialNetworks === 'string') {
            try {
                body.socialNetworks = JSON.parse(body.socialNetworks as string) as Record<string, string>;
            } catch {
                body.socialNetworks = undefined;
            }
        }
        if (typeof body.media === 'string') {
            try {
                body.media = JSON.parse(body.media as string) as unknown;
            } catch {
                body.media = undefined;
            }
        }
        if (typeof body.blockedDates === 'string') {
            try {
                body.blockedDates = JSON.parse(body.blockedDates as string) as string[];
            } catch {
                body.blockedDates = undefined;
            }
        }
        if (typeof body.featuredSong === 'string') {
            try {
                body.featuredSong = JSON.parse(body.featuredSong as string) as Record<string, string>;
            } catch {
                body.featuredSong = undefined;
            }
        }
        if (typeof body.songs === 'string') {
            try {
                body.songs = JSON.parse(body.songs as string) as unknown;
            } catch {
                body.songs = undefined;
            }
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        let photoUrl: string | undefined;
        let technicalRiderUrl: string | undefined;

        const existing = await artistProfilesService.getByUid(uid);

        // 1. Process Photo
        if (files?.photo?.[0]) {
            const photoFile = files.photo[0];
            if (!ALLOWED_IMAGE_TYPES.includes(photoFile.mimetype)) {
                sendError({ res, error: 'Invalid image format. Supported: JPEG, PNG, WEBP, GIF', statusCode: 400 });
                return;
            }
            if (photoFile.size > MAX_IMAGE_SIZE) {
                sendError({ res, error: 'Photo too large. Maximum size is 5 MB', statusCode: 400 });
                return;
            }
            if (existing?.photo) {
                const oldPath = extractFilePathFromStorageUrl(existing.photo);
                if (oldPath) {
                    try {
                        await storageService.deleteFile(oldPath);
                    } catch { /* ignore */ }
                }
            }
            const ext = photoFile.originalname.split('.').pop() || 'jpg';
            const fileName = `photo_${Date.now()}.${ext}`;
            photoUrl = await storageService.uploadFile(photoFile.buffer, fileName, photoFile.mimetype, `artist_profiles/${uid}`);
        }

        // 2. Process Rider (PDF)
        if (files?.rider?.[0]) {
            const riderFile = files.rider[0];
            if (!ALLOWED_PDF_TYPES.includes(riderFile.mimetype)) {
                sendError({ res, error: 'Invalid document format. Only PDF is allowed for riders', statusCode: 400 });
                return;
            }
            if (riderFile.size > MAX_PDF_SIZE) {
                sendError({ res, error: 'Rider PDF too large. Maximum size is 10 MB', statusCode: 400 });
                return;
            }
            if (existing?.technicalRiderUrl) {
                const oldPath = extractFilePathFromStorageUrl(existing.technicalRiderUrl);
                if (oldPath) {
                    try {
                        await storageService.deleteFile(oldPath);
                    } catch { /* ignore */ }
                }
            }
            const ext = 'pdf';
            const fileName = `rider_${Date.now()}.${ext}`;
            technicalRiderUrl = await storageService.uploadFile(riderFile.buffer, fileName, riderFile.mimetype, `artist_profiles/${uid}`);
        }

        const media = parseMedia(body.media);
        const songs = parseSongs(body.songs);

        const profile = await artistProfilesService.createOrUpdate(uid, {
            biography: typeof body.biography === 'string' ? body.biography : undefined,
            genre: typeof body.genre === 'string' ? body.genre : undefined,
            socialNetworks: parseSocialNetworks(body),
            photo: photoUrl,
            city: typeof body.city === 'string' ? body.city : undefined,
            media,
            songs,
            blockedDates: body.blockedDates as string[] | undefined,
            featuredSong: body.featuredSong as any,
            technicalRiderUrl,
        });
        sendSuccess(res, profile, 'Profile saved');
    } catch (err: any) {
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

export async function addMediaToGallery(req: AuthRequest, res: Response) {
    try {
        const uid = getUid(req);
        const files = req.files as Express.Multer.File[] | undefined;
        if (!files || files.length === 0) {
            sendError({ res, error: 'No files provided', statusCode: 400 });
            return;
        }

        const items: ArtistProfileMediaItem[] = [];
        for (const file of files) {
            let type: 'image' | 'audio' | 'video' = 'image';
            let maxSize = MAX_IMAGE_SIZE;

            if (file.mimetype.startsWith('video/')) {
                type = 'video';
                maxSize = MAX_VIDEO_SIZE;
            } else if (file.mimetype.startsWith('audio/')) {
                type = 'audio';
                maxSize = MAX_AUDIO_SIZE;
            }

            if (file.size > maxSize) {
                sendError({ res, error: `File ${file.originalname} is too large. Limit for ${type} is ${maxSize / (1024 * 1024)}MB`, statusCode: 400 });
                return;
            }

            const fileName = `gallery_${Date.now()}_${file.originalname}`;
            const url = await storageService.uploadFile(file.buffer, fileName, file.mimetype, `artist_profiles/${uid}/gallery`);
            items.push({ url, type, name: file.originalname });
        }

        await artistProfilesService.addMedia(uid, items);
        sendSuccess(res, items, 'Media added to gallery');
    } catch (err: any) {
        sendError({ res, error: err.message, statusCode: 500 });
    }
}

export async function removeMediaFromGallery(req: AuthRequest, res: Response) {
    try {
        const uid = getUid(req);
        const item = req.body as ArtistProfileMediaItem;
        if (!item.url) {
            sendError({ res, error: 'Media URL is required', statusCode: 400 });
            return;
        }

        const path = extractFilePathFromStorageUrl(item.url);
        if (path) {
            try { await storageService.deleteFile(path); } catch { /* ignore */ }
        }

        await artistProfilesService.removeMedia(uid, item);
        sendSuccess(res, null, 'Media removed from gallery');
    } catch (err: any) {
        sendError({ res, error: err.message, statusCode: 500 });
    }
}
