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

export async function googleLogin(req: Request, res: Response): Promise<void> {
    try {
        const { idToken } = req.body as { idToken?: string };

        if (!idToken) {
            sendError({ res, error: 'idToken is required', statusCode: 400 });
            return;
        }

        const result = await authService.loginWithGoogle(idToken);
        sendSuccess(res, result, result.isNewUser ? 'Account created with Google' : 'Google login successful');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Google login failed';
        sendError({ res, error: message, statusCode: 401 });
    }
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
    try {
        const { uid, code } = req.body as { uid?: string; code?: string };

        if (!uid || !code) {
            sendError({ res, error: 'uid and code are required', statusCode: 400 });
            return;
        }

        res.status(501).json({
            success: false,
            message: 'Email verification logic is not yet implemented (STUB)',
            data: { uid, code }
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Verification failed';
        sendError({ res, error: message, statusCode: 500 });
    }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
    try {
        const { email } = req.body as { email?: string };

        if (!email) {
            sendError({ res, error: 'email is required', statusCode: 400 });
            return;
        }

        const result = await authService.forgotPassword(email);

        sendSuccess(res, {
            email: result.email,
            expiresAt: result.expiresAt.toDate(),
            code: result.code,
            message: 'Si el correo existe, se enviará un código de verificación'
        }, 'Reset code generated');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Error generating reset code';
        sendError({ res, error: message, statusCode: 400 });
    }
}

export async function verifyResetCode(req: Request, res: Response): Promise<void> {
    try {
        const { email, code } = req.body as { email?: string; code?: string };

        if (!email || !code) {
            sendError({ res, error: 'email and code are required', statusCode: 400 });
            return;
        }

        await authService.verifyResetCode(email, code);
        sendSuccess(res, null, 'Código verificado correctamente');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid or expired code';
        sendError({ res, error: message, statusCode: 400 });
    }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
    try {
        const { email, code, newPassword } = req.body as { email?: string; code?: string; newPassword?: string };

        if (!email || !code || !newPassword) {
            sendError({ res, error: 'email, code and newPassword are required', statusCode: 400 });
            return;
        }

        await authService.resetPassword(email, code, newPassword);
        sendSuccess(res, null, 'Contraseña actualizada correctamente');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Error resetting password';
        sendError({ res, error: message, statusCode: 400 });
    }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
    try {
        const { uid } = (req as AuthRequest).user!;
        const { newPassword } = req.body as { newPassword?: string };
        if (!newPassword) {
            sendError({ res, error: 'newPassword is required', statusCode: 400 });
            return;
        }
        await authService.changePasswordWithSession(uid, newPassword);
        sendSuccess(res, null, 'Contraseña actualizada. Debes iniciar sesión de nuevo.');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo cambiar la contraseña';
        sendError({ res, error: message, statusCode: 400 });
    }
}

export async function changeEmail(req: Request, res: Response): Promise<void> {
    try {
        const { uid } = (req as AuthRequest).user!;
        const { newEmail } = req.body as { newEmail?: string };
        if (!newEmail) {
            sendError({ res, error: 'newEmail is required', statusCode: 400 });
            return;
        }
        await authService.changeEmail(uid, newEmail);
        sendSuccess(res, null, 'Correo actualizado correctamente');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo cambiar el correo';
        sendError({ res, error: message, statusCode: 400 });
    }
}

export async function requestAccountChangeCode(req: Request, res: Response): Promise<void> {
    try {
        const { uid } = (req as AuthRequest).user!;
        await authService.requestAccountChangeCode(uid);
        sendSuccess(res, null, 'Código enviado a tu correo');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo enviar el código';
        sendError({ res, error: message, statusCode: 400 });
    }
}

export async function verifyAccountChangeCode(req: Request, res: Response): Promise<void> {
    try {
        const { uid } = (req as AuthRequest).user!;
        const { code } = req.body as { code?: string };
        if (!code?.trim()) {
            sendError({ res, error: 'code is required', statusCode: 400 });
            return;
        }
        await authService.verifyAccountChangeCode(uid, code.trim());
        sendSuccess(res, null, 'Código verificado. Ya puedes cambiar correo o contraseña.');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Código inválido';
        sendError({ res, error: message, statusCode: 400 });
    }
}

export async function getAccountChangeStatus(req: Request, res: Response): Promise<void> {
    try {
        const { uid } = (req as AuthRequest).user!;
        const status = await authService.getAccountChangeStatus(uid);
        sendSuccess(res, status);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al consultar estado';
        sendError({ res, error: message, statusCode: 500 });
    }
}
