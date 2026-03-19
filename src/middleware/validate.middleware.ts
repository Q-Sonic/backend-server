import { Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { AuthRequest } from '../types';
import { sendError } from '../utils/response.util';

export const validateRequest = (schema: ZodTypeAny) => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const result: any = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            
            req.body = result.body;
            req.query = result.query;
            req.params = result.params;
            
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const message = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
                sendError({ res, error: `Validation error: ${message}`, statusCode: 400 });
                return;
            }
            sendError({ res, error: 'Internal validation error', statusCode: 500 });
        }
    };
};
