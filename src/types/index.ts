import { Request } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { UserRoleEnum } from '../enum/roles.enum';

// ─── Roles ────────────────────────────────────────────────────────────────────
export type UserRole = UserRoleEnum.CLIENTE | UserRoleEnum.ARTISTA | UserRoleEnum.ORGANIZACION | UserRoleEnum.ADMIN | UserRoleEnum.SOPORTE;

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

// ─── Respuesta de Registro (incluye tokens para login automático) ───────────
export interface RegisterResponse extends LoginResponse {
    user: UserRecord;
}

// ─── Servicio del artista (tipo de espectáculo con precio) ──────────────────
export interface ArtistServiceRecord {
    id: string;
    artistId: string;
    name: string;
    price: number;
    description: string;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
}

export interface CreateArtistServiceInput {
    name: string;
    price: number;
    description: string;
}

export type UpdateArtistServiceInput = Partial<CreateArtistServiceInput>;

// ─── Perfil de cliente (US-6, US-7) ───────────────────────────────────────────
export interface ClientProfileRecord {
    uid: string;
    name: string;
    phone: string;
    location: string;
    photo: string;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
}

export interface CreateOrUpdateClientProfileInput {
    name?: string;
    phone?: string;
    location?: string;
    photo?: string;
}

// ─── Perfil de artista (US-10) ────────────────────────────────────────────────
export interface SocialNetworks {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    youtube?: string;
    tiktok?: string;
}

export interface ArtistProfileRecord {
    uid: string;
    biography: string;
    socialNetworks: SocialNetworks;
    photo: string;
    city: string;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
}

export interface CreateOrUpdateArtistProfileInput {
    biography?: string;
    socialNetworks?: SocialNetworks;
    photo?: string;
    city?: string;
}
