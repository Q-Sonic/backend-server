import { Response } from 'express';
import { ArtistServicesService } from './artist-services.service';
import { AuthRequest } from '../../types';
import {
    sendSuccess,
    sendError,
    sendNotFound,
    sendCreated,
    sendForbidden,
} from '../../utils/response.util';
import { CreateArtistServiceInput } from '../../types';

const artistServicesService = new ArtistServicesService();

function getArtistId(req: AuthRequest): string {
    const uid = req.user?.uid;
    if (!uid) throw new Error('Unauthorized');
    return uid;
}

export async function listMyServices(req: AuthRequest, res: Response): Promise<void> {
    try {
        const artistId = getArtistId(req);
        const services = await artistServicesService.findAllByArtistId(artistId);
        sendSuccess(res, services);
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
        const services = await artistServicesService.findAllByArtistId(String(req.params.artistId));
        sendSuccess(res, services);
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
        const service = await artistServicesService.findById(
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
        if (!body.name || body.price == null) {
            sendError({ res, error: 'name and price are required', statusCode: 400 });
            return;
        }
        const created = await artistServicesService.create(artistId, {
            name: body.name,
            price: body.price,
            description: body.description ?? '',
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
        const updated = await artistServicesService.update(
            String(req.params.id),
            artistId,
            req.body
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
        await artistServicesService.delete(String(req.params.id), artistId);
        sendSuccess(res, null, 'Artist service deleted');
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendNotFound(res, err instanceof Error ? err.message : 'Artist service not found');
    }
}
