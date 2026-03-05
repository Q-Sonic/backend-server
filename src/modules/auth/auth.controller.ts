import { Request, Response } from 'express';
import { AuthRequest } from '../../types';
import { AuthService } from './auth.service';
import { sendSuccess, sendCreated, sendError } from '../../utils/response.util';

const authService = new AuthService();

export async function register(req: Request, res: Response): Promise<void> {
    try {
        const { email, password, displayName, role } = req.body as {
            email: string;
            password: string;
            displayName: string;
            role: import('../../types').UserRole;
        };

        if (!email || !password || !displayName || !role) {
            sendError({ res, error: 'email, password, displayName and role are required', statusCode: 400 });
            return;
        }

        const user = await authService.register({ email, password, displayName, role });
        sendCreated(res, user, 'User registered successfully');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        sendError({ res, error: message, statusCode: 400 });
    }
}

export async function getMe(req: Request, res: Response): Promise<void> {
    try {
        const { uid } = (req as AuthRequest).user!;
        const user = await authService.getUserById(uid);
        sendSuccess(res, user);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get user';
        sendError({ res, error: message, statusCode: 500 });
    }
}

export async function login(req: Request, res: Response): Promise<void> {
    try {
        const { email, password } = req.body as {
            email?: string;
            password?: string;
        };

        if (!email || !password) {
            sendError({ res, error: 'email and password are required', statusCode: 400 });
            return;
        }

        const result = await authService.login(email, password);
        sendSuccess(res, result, 'Login successful');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        sendError({ res, error: message, statusCode: 401 });
    }
}
