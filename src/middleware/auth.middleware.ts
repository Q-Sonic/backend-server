import { Request, Response, NextFunction } from 'express';
import { getAuth } from '../config/firebase';
import { AuthRequest } from '../types';
import { sendUnauthorized } from '../utils/response.util';

export async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        sendUnauthorized(res, 'Missing or invalid Authorization header');
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const decodedToken = await getAuth().verifyIdToken(token);
        (req as AuthRequest).user = decodedToken as any;
        next();
    } catch {
        sendUnauthorized(res, 'Invalid or expired token');
    }
}
