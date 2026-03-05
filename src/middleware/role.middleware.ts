import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types';
import { sendForbidden } from '../utils/response.util';

export const roleGuard = (...allowedRoles: UserRole[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        // Verificamos si hay usuario (authMiddleware se asume que ejecutó antes)
        if (!req.user) {
            sendForbidden(res, 'Acceso denegado: Usuario no autenticado');
            return;
        }

        const role = req.user.role as UserRole | undefined;

        // Si el usuario no tiene rol o su rol no está en la lista permitida
        if (!role || !allowedRoles.includes(role)) {
            sendForbidden(
                res,
                `Acceso denegado: Se requiere al menos uno de estos roles [${allowedRoles.join(', ')}]`
            );
            return;
        }

        next();
    };
};
