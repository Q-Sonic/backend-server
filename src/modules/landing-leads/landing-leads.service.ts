import { getFirestore, admin } from '../../config/firebase';

const COLLECTION = 'landing_leads';

export type LandingLeadInquiryType = 'artist' | 'client' | 'unspecified';

export type CreateLandingLeadInput = {
    fullName: string;
    email: string;
    inquiryType: LandingLeadInquiryType;
    clientIp?: string;
    userAgent?: string;
};

const EMAIL_RE =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function validateLandingLeadBody(body: unknown): { ok: true; value: CreateLandingLeadInput } | { ok: false; error: string } {
    if (!body || typeof body !== 'object') {
        return { ok: false, error: 'Cuerpo inválido' };
    }
    const o = body as Record<string, unknown>;
    const fullNameRaw = typeof o.fullName === 'string' ? o.fullName.trim() : '';
    const emailRaw = typeof o.email === 'string' ? o.email.trim().toLowerCase() : '';
    let inquiryType: LandingLeadInquiryType = 'unspecified';
    if (o.inquiryType === 'artist' || o.inquiryType === 'client') {
        inquiryType = o.inquiryType;
    } else if (o.inquiryType !== undefined && o.inquiryType !== null && o.inquiryType !== '') {
        return { ok: false, error: 'Tipo de consulta inválido' };
    }

    if (fullNameRaw.length < 2 || fullNameRaw.length > 120) {
        return { ok: false, error: 'El nombre debe tener entre 2 y 120 caracteres' };
    }
    if (emailRaw.length < 5 || emailRaw.length > 254 || !EMAIL_RE.test(emailRaw)) {
        return { ok: false, error: 'Correo electrónico inválido' };
    }

    return {
        ok: true,
        value: {
            fullName: fullNameRaw,
            email: emailRaw,
            inquiryType,
        },
    };
}

export class LandingLeadsService {
    private readonly db: admin.firestore.Firestore;

    constructor() {
        this.db = getFirestore();
    }

    async createLead(input: CreateLandingLeadInput): Promise<{ id: string }> {
        const docRef = await this.db.collection(COLLECTION).add({
            fullName: input.fullName,
            email: input.email,
            inquiryType: input.inquiryType,
            source: 'landing',
            clientIp: input.clientIp ?? null,
            userAgent: input.userAgent ?? null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { id: docRef.id };
    }
}
