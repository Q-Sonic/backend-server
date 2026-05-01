import { Request, Response, NextFunction } from 'express';
import { rateLimit, Options } from 'express-rate-limit';
import { sendError } from '../utils/response.util';

/**
 * Standard rate limiter for all API requests.
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Aumentado para desarrollo y fluidez
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
    windowMs: 15 * 60 * 1000, // Reducido el tiempo a 15 min
    max: 100, // Aumentado a 100 intentos
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: 'Demasiados intentos de autenticación. Intente de nuevo en 15 minutos.',
    handler: (req: Request, res: Response, _next: NextFunction, options: Options) => {
        sendError({
            res,
            error: options.message as string,
            statusCode: 429
        });
    }
});
