import { Request } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { UserRoleEnum } from '../enum/roles.enum';
import { ContractStatus, PaymentStatus } from '../enum/contract.enum';

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
    emailVerified: boolean; // false al registrarse, true al verificar
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
    verification?: {
        code?: string;
        expiresAt: Date | string;
        message: string;
    };
}

// ─── Respuesta de Login con Google OAuth ─────────────────────────────────────
// El `customToken` es firmado por el servidor (Admin SDK).
// El cliente debe usar: signInWithCustomToken(firebaseClientAuth, customToken)
// para obtener un idToken de sesión con los custom claims del usuario.
export interface GoogleLoginResponse {
    customToken: string;
    uid: string;
    role: UserRole;
    isNewUser: boolean;
    user: UserRecord;
}

// ─── Verificación de Email ───────────────────────────────────────────────────
export interface EmailVerificationRecord {
    uid: string;
    email: string;
    code: string;
    expiresAt: FirebaseFirestore.Timestamp;
    verified: boolean;
    createdAt: FirebaseFirestore.Timestamp;
}

// ─── Servicio del artista (tipo de espectáculo con precio) ──────────────────
export interface ArtistServiceRecord {
    id: string;
    artistId: string;
    name: string;
    price: number;
    description: string;
    /** Format: '60-90 min', '2 hours', etc. */
    duration?: string;
    /** List of features (e.g., ['Equipo de sonido incluido', 'Músicos de apoyo']) */
    features?: string[];
    /** Rider URL (PDF in Storage) */
    riderUrl?: string;
    /** Cover image URL for service card/modal */
    imageUrl?: string;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
}

export interface CreateArtistServiceInput {
    name: string;
    price: number;
    description: string;
    duration?: string;
    features?: string[];
    imageUrl?: string;
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

/** Single media item in artist gallery (image, audio, video). */
export interface ArtistProfileMediaItem {
    url: string;
    type: 'image' | 'audio' | 'video';
    name?: string;
    /** Category for gallery filtering (e.g., 'Conciertos', 'Backstage', 'Fans') */
    category?: string;
}

export interface ArtistProfileRecord {
    uid: string;
    biography: string;
    socialNetworks: SocialNetworks;
    photo: string;
    city: string;
    /** List of blocked dates in YYYY-MM-DD format. */
    blockedDates?: string[];
    /** Featured song for the profile player. */
    featuredSong?: {
        title: string;
        artistName: string;
        streamUrl: string;
        coverUrl?: string;
    };
    /** Artist's main genre (e.g. 'Pop', 'Salsa', 'Rock') */
    genre?: string;
    /** Minimum price for services (for search indexing) */
    minPrice?: number;
    /** Link to technical rider (PDF) */
    technicalRiderUrl?: string;
    /** Gallery media URLs (images, audio, video). */
    media?: ArtistProfileMediaItem[];
    /** Stats for dashboard */
    totalVisits?: number;
    /** Map of date (YYYY-MM-DD) -> count */
    visitsHistory?: Record<string, number>;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export interface DashboardStats {
    totalEvents: number;
    eventsGrowthPercent: number;
    totalBalance: number;
    profileVisitsTotal: number;
    visitsChartData: { day: string; count: number }[];
    nextEvent?: ContractRecord;
}

export interface CreateOrUpdateArtistProfileInput {
    biography?: string;
    genre?: string;
    socialNetworks?: SocialNetworks;
    photo?: string;
    city?: string;
    media?: ArtistProfileMediaItem[];
    blockedDates?: string[];
    featuredSong?: {
        title: string;
        artistName: string;
        streamUrl: string;
        coverUrl?: string;
    };
    technicalRiderUrl?: string;
}

export interface ArtistAvailability {
    blocked: string[]; // Manual blocks
    reserved: string[]; // ACCEPTED/COMPLETED contracts
    pending: string[]; // PENDING contracts
}

// ─── Contratos, Eventos y Pagos (US-8) ──────────────────────────────────────
export interface EventDetails {
    name: string;
    date: FirebaseFirestore.Timestamp;
    location: string;
    description?: string;
}

export interface PaymentItem {
    amount: number;
    date: FirebaseFirestore.Timestamp;
    reference?: string;
    method?: string;
}

export interface ContractFinancials {
    totalAmount: number;
    paidAmount: number;
    paymentStatus: PaymentStatus;
}

export interface ContractRecord {
    id: string;
    clientId: string;
    artistId: string;
    serviceId: string;
    status: ContractStatus;
    eventDetails: EventDetails;
    financials: ContractFinancials;
    payments: PaymentItem[];
    /** PDF Contract URL */
    contractUrl?: string;
    /** Captured Rider URL at booking time */
    riderUrl?: string;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
}

export interface ExtendedContractDetail extends ContractRecord {
    clientContact?: {
        name: string;
        email: string;
        phone: string;
    };
    riderDownloadUrl?: string;
    contractDownloadUrl?: string;
}

export interface CreateContractInput {
    artistId: string;
    serviceId: string;
    eventDetails: {
        name: string;
        date: string | number | Date;
        location: string;
        description?: string;
    };
    totalAmount: number;
}

export interface AddPaymentInput {
    amount: number;
    reference?: string;
    method?: string;
}

// ─── Recobrar Contraseña ─────────────────────────────────────────────────────
export interface PasswordResetRecord {
    email: string;
    code: string;
    expiresAt: FirebaseFirestore.Timestamp;
    verified: boolean;
    createdAt: FirebaseFirestore.Timestamp;
}
