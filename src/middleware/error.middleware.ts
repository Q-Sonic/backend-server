import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.util';

export function errorMiddleware(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    console.error('❌ Unhandled error:', err.message);
    sendError({ res, error: err.message || 'Internal Server Error', statusCode: 500 });
}
