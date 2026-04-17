import { Request, Response, NextFunction } from 'express';
import { getAuth, getFirestore } from '../config/firebase';
import { AuthRequest, UserRole } from '../types';
import { sendUnauthorized } from '../utils/response.util';

/**
 * Verifies the Firebase JWT and sets req.user.
 * The role is always read from Firestore (users collection), not from the token,
 * so changing the role in the DB takes effect on the next request without re-login.
 */
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
        const uid = decodedToken.uid;

        const userDoc = await getFirestore().collection('users').doc(uid).get();
        const roleFromDb = userDoc.exists ? (userDoc.data() as { role?: string })?.role : undefined;
        const tokenRole = (decodedToken as { role?: string }).role;

        (req as AuthRequest).user = {
            ...decodedToken,
            role: (roleFromDb as UserRole) ?? (tokenRole as UserRole),
        };
        next();
    } catch (error: any) {
        console.error('[AuthMiddleware] Token verification failed:', error.message);
        sendUnauthorized(res, 'Invalid or expired token');
    }
}
