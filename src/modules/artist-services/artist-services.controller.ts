import { Response } from 'express';
import { ArtistServicesService } from './artist-services.service';
import { AuthRequest, ArtistServiceRecord } from '../../types';
import { UserRoleEnum } from '../../enum/roles.enum';
import { StorageService } from '../storage/storage.service';
import {
    sendSuccess,
    sendError,
    sendNotFound,
    sendCreated,
    sendForbidden,
} from '../../utils/response.util';
import { CreateArtistServiceInput } from '../../types';
import { extractFilePathFromStorageUrl, MAX_IMAGE_SIZE } from '../../helper/storage';

const artistServicesService = new ArtistServicesService();
const storageService = new StorageService();
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function getArtistId(req: AuthRequest): string {
    const uid = req.user?.uid;
    if (!uid) throw new Error('Unauthorized');
    return uid;
}

function authRoleLower(role: unknown): string {
    return typeof role === 'string' ? role.trim().toLowerCase() : '';
}

function isAuthRoleArtista(role: unknown): boolean {
    const r = authRoleLower(role);
    return r === UserRoleEnum.ARTISTA || r === 'artist';
}

function isAuthRoleAdmin(role: unknown): boolean {
    return authRoleLower(role) === UserRoleEnum.ADMIN;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const lowered = value.trim().toLowerCase();
        if (lowered === 'true') return true;
        if (lowered === 'false') return false;
    }
    return undefined;
}

function normalizeOptionalId(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    if (!normalized || normalized.toLowerCase() === 'null' || normalized.toLowerCase() === 'undefined') {
        return undefined;
    }
    return normalized;
}

/** Same rule as frontend: ids + hydrated `artist_files` rows (stale ids alone are not public). */
function isArtistServiceBookableRecord(service: ArtistServiceRecord): boolean {
    const cId = typeof service.contractId === 'string' && service.contractId.trim().length > 0;
    const rId = typeof service.technicalRiderId === 'string' && service.technicalRiderId.trim().length > 0;
    if (!cId || !rId) return false;
    const c = service.contract;
    const r = service.technicalRider;
    return (
        c != null &&
        typeof c === 'object' &&
        typeof (c as { id?: string }).id === 'string' &&
        (c as { id: string }).id.trim().length > 0 &&
        r != null &&
        typeof r === 'object' &&
        typeof (r as { id?: string }).id === 'string' &&
        (r as { id: string }).id.trim().length > 0
    );
}

export async function listMyServices(req: AuthRequest, res: Response): Promise<void> {
    try {
        const artistId = getArtistId(req);
        const { skip, take, filterField, filterValue } = req.query;
        const result = await artistServicesService.findAllByArtistId(artistId, {
            skip: skip ? Number(skip) : 0,
            take: take ? Number(take) : 20,
            filterField: filterField ? String(filterField) : undefined,
            filterValue: filterValue ? String(filterValue) : undefined,
        });
        sendSuccess(res, result);
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendError({
            res,
            error: err instanceof Error ? err.message : 'Failed to list services',
            statusCode: 500,
        });
    }
}

/**
 * Client / catalog: only services with contract + technical rider files linked and resolved.
 * Use this path for anyone who is not the artist owner managing drafts (see route order: before /:id).
 */
export async function listBookableServicesForClientByArtistId(
    req: AuthRequest,
    res: Response
): Promise<void> {
    try {
        const artistId = String(req.params.artistId);
        const result = await artistServicesService.findAllByArtistId(artistId, {
            skip: 0,
            take: 500,
        });
        const bookable = result.data.filter(isArtistServiceBookableRecord);
        sendSuccess(res, {
            ...result,
            data: bookable,
            total: bookable.length,
            skip: 0,
            take: bookable.length,
        });
    } catch (err) {
        sendError({
            res,
            error: err instanceof Error ? err.message : 'Failed to list services',
            statusCode: 500,
        });
    }
}

export async function listAllServicesByArtistId(req: AuthRequest, res: Response): Promise<void> {
    try {
        const artistId = String(req.params.artistId);
        const uid = req.user?.uid;
        const role = req.user?.role;

        const isOwnerArtist = isAuthRoleArtista(role) && uid === artistId;
        const isAdmin = isAuthRoleAdmin(role);
        const hideIncomplete = !isOwnerArtist && !isAdmin;

        let skip = req.query.skip ? Number(req.query.skip) : 0;
        let take = req.query.take ? Number(req.query.take) : 20;

        if (hideIncomplete) {
            skip = 0;
            take = Math.min(500, Math.max(take, 100));
        }

        const { filterField, filterValue } = req.query;
        const result = await artistServicesService.findAllByArtistId(artistId, {
            skip,
            take,
            filterField: filterField ? String(filterField) : undefined,
            filterValue: filterValue ? String(filterValue) : undefined,
        });

        if (!hideIncomplete) {
            sendSuccess(res, result);
            return;
        }

        const bookable = result.data.filter(isArtistServiceBookableRecord);
        sendSuccess(res, {
            ...result,
            data: bookable,
            total: bookable.length,
            skip: 0,
            take: bookable.length,
        });
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendError({
            res,
            error: err instanceof Error ? err.message : 'Failed to list services',
            statusCode: 500,
        });
    }
}

export async function getServiceById(req: AuthRequest, res: Response): Promise<void> {
    try {
        const artistId = getArtistId(req);
        const service = await artistServicesService.findByIdAndArtist(
            String(req.params.id),
            artistId
        );
        sendSuccess(res, service);
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendNotFound(res, err instanceof Error ? err.message : 'Artist service not found');
    }
}

export async function createService(req: AuthRequest, res: Response): Promise<void> {
    try {
        const artistId = getArtistId(req);
        const body = req.body as CreateArtistServiceInput;
        const file = req.file;

        let imageUrl: string | undefined;
        if (file) {
            if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
                sendError({ res, error: 'Invalid image format. Supported: JPEG, PNG, WEBP, GIF', statusCode: 400 });
                return;
            }
            if (file.size > MAX_IMAGE_SIZE) {
                sendError({ res, error: 'Image too large. Maximum size is 5 MB', statusCode: 400 });
                return;
            }
            imageUrl = await storageService.uploadFile(
                file.buffer,
                file.originalname,
                file.mimetype,
                `artist_services/${artistId}`
            );
        }

        let parsedFeatures = body.features ?? [];
        if (typeof body.features === 'string') {
            try {
                parsedFeatures = JSON.parse(body.features) as string[];
            } catch {
                parsedFeatures = [];
            }
        }

        if (!body.name || body.price == null) {
            sendError({ res, error: 'name and price are required', statusCode: 400 });
            return;
        }
        const normalizedContractId = normalizeOptionalId(body.contractId);
        const normalizedTechnicalRiderId = normalizeOptionalId(body.technicalRiderId);
        const created = await artistServicesService.createService(artistId, {
            name: body.name,
            price: body.price,
            description: body.description ?? '',
            duration: body.duration ?? '',
            features: parsedFeatures,
            imageUrl,
            isPinned: parseOptionalBoolean(body.isPinned),
            contractId: normalizedContractId,
            technicalRiderId: normalizedTechnicalRiderId,
        });
        sendCreated(res, created, 'Artist service created');
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendError({
            res,
            error: err instanceof Error ? err.message : 'Failed to create service',
            statusCode: 400,
        });
    }
}

export async function updateService(req: AuthRequest, res: Response): Promise<void> {
    try {
        const artistId = getArtistId(req);
        const serviceId = String(req.params.id);
        const file = req.file;
        const body = req.body as CreateArtistServiceInput;
        const parsedIsPinned = parseOptionalBoolean(body.isPinned);

        let imageUrl: string | undefined;
        if (file) {
            if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
                sendError({ res, error: 'Invalid image format. Supported: JPEG, PNG, WEBP, GIF', statusCode: 400 });
                return;
            }
            if (file.size > MAX_IMAGE_SIZE) {
                sendError({ res, error: 'Image too large. Maximum size is 5 MB', statusCode: 400 });
                return;
            }
            const previous = await artistServicesService.findByIdAndArtist(serviceId, artistId);
            imageUrl = await storageService.uploadFile(
                file.buffer,
                file.originalname,
                file.mimetype,
                `artist_services/${artistId}`
            );
            if (previous.imageUrl) {
                const oldPath = extractFilePathFromStorageUrl(previous.imageUrl);
                if (oldPath) {
                    try {
                        await storageService.deleteFile(oldPath);
                    } catch { /* ignore cleanup errors */ }
                }
            }
        }

        let parsedFeatures = body.features;
        if (typeof body.features === 'string') {
            try {
                parsedFeatures = JSON.parse(body.features) as string[];
            } catch {
                parsedFeatures = [];
            }
        }

        const updated = await artistServicesService.updateService(
            serviceId,
            artistId,
            {
                ...req.body,
                features: parsedFeatures,
                contractId: normalizeOptionalId(body.contractId),
                technicalRiderId: normalizeOptionalId(body.technicalRiderId),
                ...(parsedIsPinned !== undefined ? { isPinned: parsedIsPinned } : {}),
                ...(imageUrl ? { imageUrl } : {}),
            }
        );
        sendSuccess(res, updated, 'Artist service updated');
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendNotFound(res, err instanceof Error ? err.message : 'Artist service not found');
    }
}

export async function deleteService(req: AuthRequest, res: Response): Promise<void> {
    try {
        const artistId = getArtistId(req);
        await artistServicesService.deleteService(String(req.params.id), artistId);
        sendSuccess(res, null, 'Artist service deleted');
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendNotFound(res, err instanceof Error ? err.message : 'Artist service not found');
    }
}
