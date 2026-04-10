import { Request, Response, NextFunction } from 'express';
import { rateLimit, Options } from 'express-rate-limit';
import { sendError } from '../utils/response.util';

/**
 * Standard rate limiter for all API requests.
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: 'draft-7', // combined `RateLimit` header
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req: Request, res: Response, _next: NextFunction, options: Options) => {
        sendError({
            res,
            error: (options.message as string) || 'Demasiadas peticiones, intente de nuevo más tarde.',
            statusCode: 429
        });
    }
});

/**
 * More restrictive limiter for sensitive endpoints like login and password reset.
 */
export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 requests per hour for auth
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Demasiados intentos de autenticación. Intente de nuevo en una hora.',
    handler: (req: Request, res: Response, _next: NextFunction, options: Options) => {
        sendError({
            res,
            error: options.message as string,
            statusCode: 429
        });
    }
});
