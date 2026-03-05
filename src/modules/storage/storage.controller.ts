import { Request, Response } from 'express';
import { StorageService } from './storage.service';
import { sendSuccess, sendCreated, sendError } from '../../utils/response.util';

const storageService = new StorageService();

export async function uploadFile(req: Request, res: Response): Promise<void> {
    try {
        if (!req.file) {
            sendError({ res, error: 'No file provided', statusCode: 400 });
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
        sendError({ res, error: err instanceof Error ? err.message : 'Upload failed', statusCode: 500 });
    }
}

export async function deleteFile(req: Request, res: Response): Promise<void> {
    try {
        const { filePath } = req.body as { filePath: string };
        if (!filePath) {
            sendError({ res, error: 'filePath is required', statusCode: 400 });
            return;
        }
        await storageService.deleteFile(filePath);
        sendSuccess(res, null, 'File deleted');
    } catch (err) {
        sendError({ res, error: err instanceof Error ? err.message : 'Delete failed', statusCode: 500 });
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
        sendError({ res, error: err instanceof Error ? err.message : 'Failed to generate URL', statusCode: 500 });
    }
}
