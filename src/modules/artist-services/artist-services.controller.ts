import { Response } from 'express';
import { ArtistServicesService } from './artist-services.service';
import { AuthRequest } from '../../types';
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

export async function listAllServicesByArtistId(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { skip, take, filterField, filterValue } = req.query;
        const result = await artistServicesService.findAllByArtistId(String(req.params.artistId), {
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
        const created = await artistServicesService.createService(artistId, {
            name: body.name,
            price: body.price,
            description: body.description ?? '',
            duration: body.duration ?? '',
            features: parsedFeatures,
            imageUrl,
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
