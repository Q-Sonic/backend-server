import { Request, Response } from 'express';
import { StorageService } from './storage.service';
import {
    formatStorageBucketError,
    extractFilePathFromStorageUrl,
    MAX_IMAGE_SIZE,
    MAX_VIDEO_SIZE,
    MAX_AUDIO_SIZE,
} from '../../helper/storage';
import { sendSuccess, sendCreated, sendError } from '../../utils/response.util';

const storageService = new StorageService();

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'];
const AUDIO_MIMES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg'];

function getMaxSizeForMime(mime: string): number {
    if (IMAGE_MIMES.includes(mime)) return MAX_IMAGE_SIZE;
    if (VIDEO_MIMES.includes(mime)) return MAX_VIDEO_SIZE;
    if (AUDIO_MIMES.includes(mime)) return MAX_AUDIO_SIZE;
    return MAX_IMAGE_SIZE; // default for unknown
}

export async function uploadFile(req: Request, res: Response): Promise<void> {
    try {
        if (!req.file) {
            sendError({ res, error: 'No file provided', statusCode: 400 });
            return;
        }

        const maxSize = getMaxSizeForMime(req.file.mimetype);
        if (req.file.size > maxSize) {
            const limitMB = maxSize / (1024 * 1024);
            sendError({
                res,
                error: `File too large. Max size for this type: ${limitMB} MB`,
                statusCode: 400,
            });
            return;
        }

        const { folder } = req.body as { folder?: string };
        const url = await storageService.uploadFile(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            folder
        );

        sendCreated(res, { url }, 'File uploaded successfully');
    } catch (err) {
        const message = formatStorageBucketError(err);
        sendError({ res, error: message, statusCode: 500 });
    }
}

export async function deleteFile(req: Request, res: Response): Promise<void> {
    try {
        const { url, filePath } = req.body as { url?: string; filePath?: string };

        let pathToDelete: string | null = null;
        if (url) {
            pathToDelete = extractFilePathFromStorageUrl(url);
            if (!pathToDelete) {
                sendError({
                    res,
                    error: 'Invalid or external URL. Provide a valid Firebase Storage URL from this project.',
                    statusCode: 400,
                });
                return;
            }
        } else if (filePath) {
            pathToDelete = filePath;
        }

        if (!pathToDelete) {
            sendError({ res, error: 'url or filePath is required', statusCode: 400 });
            return;
        }

        await storageService.deleteFile(pathToDelete);
        sendSuccess(res, null, 'File deleted');
    } catch (err) {
        const message = formatStorageBucketError(err);
        sendError({ res, error: message, statusCode: 500 });
    }
}

export async function getSignedUrl(req: Request, res: Response): Promise<void> {
    try {
        const { filePath, expiresInMs } = req.body as {
            filePath: string;
            expiresInMs?: number;
        };

        if (!filePath) {
            sendError({ res, error: 'filePath is required', statusCode: 400 });
            return;
        }

        const url = await storageService.getSignedUrl(filePath, expiresInMs);
        sendSuccess(res, { url }, 'Signed URL generated');
    } catch (err) {
        const message = formatStorageBucketError(err);
        sendError({ res, error: message, statusCode: 500 });
    }
}
