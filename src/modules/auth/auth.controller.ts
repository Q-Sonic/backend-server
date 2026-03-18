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

/**
 * POST /api/auth/google
 *
 * Recibe el idToken de Google obtenido por el cliente con Firebase Client SDK
 * (signInWithPopup / signInWithRedirect + GoogleAuthProvider).
 * El backend lo verifica, crea/actualiza el usuario en Firestore y devuelve
 * un customToken que el cliente usa para iniciar sesión con Firebase.
 */
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

/**
 * POST /api/auth/verify-email
 *
 * (Stub) Verifica el código de 6 dígitos enviado por el usuario.
 * Por ahora devuelve 501 Not Implemented ya que estamos en fase de diseño.
 */
export async function verifyEmail(req: Request, res: Response): Promise<void> {
    try {
        const { uid, code } = req.body as { uid?: string; code?: string };

        if (!uid || !code) {
            sendError({ res, error: 'uid and code are required', statusCode: 400 });
            return;
        }

        // TODO: Implementar validación lógica real
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

/**
 * POST /api/auth/forgot-password
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
    try {
        const { email } = req.body as { email?: string };

        if (!email) {
            sendError({ res, error: 'email is required', statusCode: 400 });
            return;
        }

        const result = await authService.forgotPassword(email);

        // DEV MODE: Retornamos el código en el JSON para pruebas en consola del front
        sendSuccess(res, {
            email: result.email,
            expiresAt: result.expiresAt.toDate(),
            code: result.code, // Solo para desarrollo
            message: 'Si el correo existe, se enviará un código de verificación'
        }, 'Reset code generated');
    } catch (err) {
        // Por seguridad, en prod se podría responder éxito igual para no revelar si el email existe.
        // Aquí seguimos la petición del usuario de reportar lo que pasa.
        const message = err instanceof Error ? err.message : 'Error generating reset code';
        sendError({ res, error: message, statusCode: 400 });
    }
}

/**
 * POST /api/auth/verify-reset-code
 */
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

/**
 * POST /api/auth/reset-password
 */
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
