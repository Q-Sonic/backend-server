import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger.util';

/**
 * Middleware to log each incoming request and its completion status.
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const { method, url, ip } = req;

    // Log the request start
    Logger.info(`${method} ${url} - [IP: ${ip}]`);

    // Intercept finish event to log response status and duration
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;
        const color = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'success';
        
        const message = `${method} ${url} - [${statusCode}] - ${duration}ms`;
        
        if (color === 'error') {
            Logger.error(message);
        } else if (color === 'warn') {
            Logger.warn(message);
        } else {
            Logger.success(message);
        }
    });

    next();
}
