import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { sendError } from '../utils/response.util';
import { Logger } from '../utils/logger.util';

export function errorMiddleware(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            sendError({ res, error: 'File too large. Check maximum size for this upload type.', statusCode: 400 });
            return;
        }
    }
    
    // Log the full stack error for debugging
    Logger.error(`❌ Global error caught at ${req.method} ${req.url}`, err);

    sendError({ res, error: err.message || 'Internal Server Error', statusCode: 500 });
}
