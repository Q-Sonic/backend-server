import { Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AuthRequest } from '../types';
import { sendError } from '../utils/response.util';

export const validateRequest = (schema: AnyZodObject) => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Support both multipart and JSON
            // Multer puts files in req.file, fields in req.body
            const result = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            
            // Re-assign parsed data to preserve types
            req.body = result.body;
            req.query = result.query;
            req.params = result.params;
            
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
                sendError({ res, error: `Validation error: ${message}`, statusCode: 400 });
                return;
            }
            sendError({ res, error: 'Internal validation error', statusCode: 500 });
        }
    };
};
