import { Request } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { UserRoleEnum } from '../enum/roles.enum';
export { ContractStatus, PaymentStatus } from '../enum/contract.enum';
export { TransactionType, WithdrawalStatus } from '../enum/payment.enum';

import { ContractStatus, PaymentStatus } from '../enum/contract.enum';
import { TransactionType, WithdrawalStatus } from '../enum/payment.enum';

// ─── Roles ────────────────────────────────────────────────────────────────────
export type UserRole = UserRoleEnum.CLIENTE | UserRoleEnum.ARTISTA | UserRoleEnum.ORGANIZACION | UserRoleEnum.ADMIN | UserRoleEnum.SOPORTE;
export type IdentityDocumentType = 'cedula' | 'ruc' | 'pasaporte';

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
    identificationType?: IdentityDocumentType;
    identificationNumber?: string;
    photoURL?: string;
    emailVerified: boolean;
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

// ─── Respuesta de Registro ──────────────────────────────────────────────────
export interface RegisterResponse extends LoginResponse {
    user: UserRecord;
    verification?: {
        code?: string;
        expiresAt: Date | string;
        message: string;
    };
}

// ─── Respuesta de Login con Google OAuth ─────────────────────────────────────
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

// ─── Servicio del artista ────────────────────────────────────────────────────
export interface ArtistServiceRecord {
    id: string;
    artistId: string;
    name: string;
    price: number;
    description: string;
    duration?: string;
    features?: string[];
    riderUrl?: string;
    technicalRiderId?: string;
    contractId?: string;
    contract?: ArtistFileRecord | null;
    technicalRider?: ArtistFileRecord | null;
    imageUrl?: string;
    isPinned?: boolean;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
}

export interface ArtistSongRecord {
    id: string;
    artistId: string;
    title: string;
    audioUrl: string;
    coverUrl?: string;
    isFeatured?: boolean;
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
    isPinned?: boolean;
    contractId?: string;
    technicalRiderId?: string;
}

export type UpdateArtistServiceInput = Partial<CreateArtistServiceInput>;

export type ArtistFileType = 'contract' | 'technical_rider';

export interface ArtistFileRecord {
    id: string;
    artistId: string;
    type: ArtistFileType;
    name?: string;
    description?: string;
    originalName: string;
    fileName: string;
    mimeType: string;
    size: number;
    storagePath: string;
    url: string;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
}

// ─── Perfil de cliente ───────────────────────────────────────────────────────
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

// ─── Perfil de artista ────────────────────────────────────────────────────────
export interface SocialNetworks {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    youtube?: string;
    tiktok?: string;
}

export interface ArtistProfileMediaItem {
    url: string;
    type: 'image' | 'audio' | 'video';
    name?: string;
    coverUrl?: string;
    category?: string;
}

export interface ArtistSongItem {
    url: string;
    title: string;
    coverUrl?: string;
}

export interface ArtistProfileRecord {
    uid: string;
    biography: string;
    socialNetworks: SocialNetworks;
    photo: string;
    city: string;
    blockedDates?: string[];
    featuredSong?: {
        title: string;
        artistName: string;
        streamUrl: string;
        coverUrl?: string;
    };
    genre?: string;
    minPrice?: number;
    technicalRiderUrl?: string;
    media?: ArtistProfileMediaItem[];
    songs?: ArtistSongItem[];
    totalBalance: number;
    totalVisits?: number;
    totalHires?: number;
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
    songs?: ArtistSongItem[];
    blockedDates?: string[];
    featuredSong?: {
        title: string;
        artistName: string;
        streamUrl: string;
        coverUrl?: string;
    };
    technicalRiderUrl?: string;
    minPrice?: number;
}

export interface ArtistAvailability {
    blocked: string[];
    reserved: string[];
    pending: string[];
}

// ─── Contratos, Eventos y Pagos ──────────────────────────────────────────────
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
    contractUrl?: string;
    signatureReceiptUrl?: string;
    sourceContractUrl?: string;
    sourceContractFileId?: string;
    sourceContractOriginalName?: string;
    riderUrl?: string;
    clientSignatureUrl?: string;
    clientAcceptedTerms?: boolean;
    clientSignedAt?: FirebaseFirestore.Timestamp;
    artistSignatureUrl?: string;
    artistAcceptedTerms?: boolean;
    artistSignedAt?: FirebaseFirestore.Timestamp;
    artistDecisionDeadlineAt?: FirebaseFirestore.Timestamp;
    artistRejectionReason?: string;
    clientName?: string;
    artistName?: string;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
}

export interface ExtendedContractDetail extends ContractRecord {
    clientContact?: {
        name: string;
        email: string;
        phone: string;
    };
    serviceName?: string;
    artistName?: string;
    riderDownloadUrl?: string;
    contractDownloadUrl?: string;
}

export interface CreateContractInput {
    artistId: string;
    serviceId: string;
    eventDetails: {
        name: string;
        date: string | number | Date | FirebaseFirestore.Timestamp;
        location: string;
        description?: string;
    };
    totalAmount: number;
    clientSignatureDataUrl?: string;
    acceptedTerms?: boolean;
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

// ─── Wallet & Withdrawals ────────────────────────────────────────────────────
export interface WalletTransactionRecord {
    id: string;
    artistId: string;
    amount: number;
    type: TransactionType;
    description: string;
    orderId?: string;
    transactionId?: string;
    createdAt: FirebaseFirestore.Timestamp;
}

export interface WithdrawalRequestRecord {
    id: string;
    artistId: string;
    amount: number;
    status: WithdrawalStatus;
    bankDetails?: {
        bankName: string;
        accountNumber: string;
        accountType: string;
        holderName: string;
        holderDocument: string;
    };
    adminNotes?: string;
    processedAt?: FirebaseFirestore.Timestamp;
    processedBy?: string;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
}

export interface WithdrawalRequestInput {
    amount: number;
    bankDetails: {
        bankName: string;
        accountNumber: string;
        accountType: string;
        holderName: string;
        holderDocument: string;
    };
}
