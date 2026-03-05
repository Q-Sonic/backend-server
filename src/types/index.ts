import { Request } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';

// ─── Roles ────────────────────────────────────────────────────────────────────
export type UserRole = 'cliente' | 'artista' | 'organizacion' | 'admin' | 'soporte';

// ─── Custom Claims embebidos en el JWT de Firebase ────────────────────────────
export interface UserClaims {
    role: UserRole;
}

// ─── Request extendido con usuario autenticado ────────────────────────────────
export interface AuthRequest extends Request {
    user?: DecodedIdToken & UserClaims;
}

// ─── Modelo de usuario en Firestore ──────────────────────────────────────────
export interface UserRecord {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    photoURL?: string;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
}

// ─── Respuesta de API estandarizada ──────────────────────────────────────────
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}

// ─── Respuesta de Login ───────────────────────────────────────────────────────
export interface LoginResponse {
    idToken: string;
    refreshToken: string;
    expiresIn: string;
    uid: string;
    role: UserRole;
}
