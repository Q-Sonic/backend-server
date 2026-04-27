import { Response } from 'express';
import { AuthRequest } from '../../types';
import { sendCreated, sendError, sendForbidden, sendSuccess } from '../../utils/response.util';
import { ArtistFilesService } from './artist-files.service';
import { MAX_PDF_SIZE } from '../../helper/storage';
import { ArtistServicesService } from '../artist-services/artist-services.service';

const ALLOWED_FILE_TYPES = ['application/pdf'];
const artistFilesService = new ArtistFilesService();
const artistServicesService = new ArtistServicesService();

function getArtistId(req: AuthRequest): string {
    const uid = req.user?.uid;
    if (!uid) throw new Error('Unauthorized');
    return uid;
}

export async function uploadArtistFile(req: AuthRequest, res: Response): Promise<void> {
    try {
        const artistId = getArtistId(req);
        const file = req.file;
        const type = String(req.body?.type ?? '');

        if (!file) {
            sendError({ res, error: 'file is required', statusCode: 400 });
            return;
        }
        if (!type) {
            sendError({ res, error: 'type is required', statusCode: 400 });
            return;
        }
        if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
            sendError({ res, error: 'Invalid document format. Only PDF is allowed', statusCode: 400 });
            return;
        }
        if (file.size > MAX_PDF_SIZE) {
            sendError({ res, error: 'File too large. Maximum size is 10 MB', statusCode: 400 });
            return;
        }

        const created = await artistFilesService.create(artistId, { type, file });
        sendCreated(res, created, 'Artist file uploaded');
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendError({
            res,
            error: err instanceof Error ? err.message : 'Failed to upload artist file',
            statusCode: 400,
        });
    }
}

export async function listArtistFiles(req: AuthRequest, res: Response): Promise<void> {
    try {
        const artistId = getArtistId(req);
        const type = typeof req.query.type === 'string' ? req.query.type : undefined;
        const files = await artistFilesService.listByArtist(artistId, type);
        sendSuccess(res, files);
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendError({
            res,
            error: err instanceof Error ? err.message : 'Failed to list artist files',
            statusCode: 400,
        });
    }
}

export async function replaceArtistFile(req: AuthRequest, res: Response): Promise<void> {
    try {
        const artistId = getArtistId(req);
        const file = req.file;
        if (!file) {
            sendError({ res, error: 'file is required', statusCode: 400 });
            return;
        }
        if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
            sendError({ res, error: 'Invalid document format. Only PDF is allowed', statusCode: 400 });
            return;
        }
        if (file.size > MAX_PDF_SIZE) {
            sendError({ res, error: 'File too large. Maximum size is 10 MB', statusCode: 400 });
            return;
        }

        const updated = await artistFilesService.replace(String(req.params.id), artistId, { file });
        sendSuccess(res, updated, 'Artist file replaced');
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendError({
            res,
            error: err instanceof Error ? err.message : 'Failed to replace artist file',
            statusCode: 400,
        });
    }
}

export async function deleteArtistFile(req: AuthRequest, res: Response): Promise<void> {
    try {
        const artistId = getArtistId(req);
        const deleted = await artistFilesService.delete(String(req.params.id), artistId);
        await artistServicesService.detachFileReferences(artistId, deleted.id, deleted.type);
        sendSuccess(res, null, 'Artist file deleted');
    } catch (err) {
        if (err instanceof Error && err.message === 'Unauthorized') {
            sendForbidden(res, 'Acceso denegado');
            return;
        }
        sendError({
            res,
            error: err instanceof Error ? err.message : 'Failed to delete artist file',
            statusCode: 400,
        });
    }
}

