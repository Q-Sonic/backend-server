import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { sendError } from '../utils/response.util';

export function errorMiddleware(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            sendError({ res, error: 'File too large. Check maximum size for this upload type.', statusCode: 400 });
            return;
        }
    }
    console.error('❌ Unhandled error:', err.message);
    sendError({ res, error: err.message || 'Internal Server Error', statusCode: 500 });
}
