import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/**
 * Carga `.env` desde el cwd o desde `backend-server/.env` si el servidor se arranca
 * desde la raíz del monorepo (así no falla SMTP_USER / SMTP_PASS "vacíos").
 */
function loadEnvFile(): void {
    const candidates = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), 'backend-server', '.env')];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            dotenv.config({ path: p, override: true });
        }
    }
}

loadEnvFile();

/** Trim, quita comillas envolventes y en SMTP_PASS elimina espacios (contraseña de aplicación Gmail). */
function cleanEnvValue(v: string | undefined, options?: { stripSpaces?: boolean }): string {
    if (v == null) return '';
    let s = v.trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        s = s.slice(1, -1).trim();
    }
    if (options?.stripSpaces) {
        s = s.replace(/\s+/g, '');
    }
    return s;
}

interface EnvConfig {
    PORT: number;
    NODE_ENV: string;
    FIREBASE_SERVICE_ACCOUNT_BASE64: string;
    FIREBASE_STORAGE_BUCKET: string;
    FIREBASE_WEB_API_KEY: string;
    CORS_ORIGIN: string;
    /** Secreto para firmar códigos de cambio de cuenta (cualquier string largo aleatorio). */
    ACCOUNT_CHANGE_CODE_SECRET: string;
    /** Gmail SMTP: normalmente smtp.gmail.com */
    SMTP_HOST: string;
    SMTP_PORT: string;
    /** true para puerto 465 */
    SMTP_SECURE: string;
    /** Cuenta Gmail completa */
    SMTP_USER: string;
    /** Contraseña de aplicación de Google (no la contraseña normal) */
    SMTP_PASS: string;
    /** Remitente; por defecto SMTP_USER. Ej: "Q-Sonic <noreply@gmail.com>" */
    MAIL_FROM: string;
    /** Email to receive notifications (withdrawals, etc.) */
    ADMIN_EMAIL?: string;
    NUVEI_LTP_SERVER_KEY: string;
    NUVEI_LTP_SERVER_SECRET: string;
    NUVEI_API_ENDPOINT: string;
    /** Frontend DNS URL (e.g. http://localhost:5173 or https://q-sonic.vercel.app) */
    FRONT_DNS: string;
}

export function getEnv(): EnvConfig {
    const {
        PORT,
        NODE_ENV,
        FIREBASE_SERVICE_ACCOUNT_BASE64,
        FIREBASE_STORAGE_BUCKET,
        FIREBASE_WEB_API_KEY,
        CORS_ORIGIN,
        ACCOUNT_CHANGE_CODE_SECRET,
        SMTP_HOST,
        SMTP_PORT,
        SMTP_SECURE,
        SMTP_USER,
        SMTP_PASS,
        MAIL_FROM,
        ADMIN_EMAIL,
        NUVEI_LTP_SERVER_KEY,
        NUVEI_LTP_SERVER_SECRET,
        NUVEI_API_ENDPOINT,
        FRONT_DNS,
    } = process.env;

    return {
        PORT: PORT ? parseInt(PORT, 10) : 3000,
        NODE_ENV: NODE_ENV ?? 'development',
        FIREBASE_SERVICE_ACCOUNT_BASE64: FIREBASE_SERVICE_ACCOUNT_BASE64 || '',
        FIREBASE_STORAGE_BUCKET: FIREBASE_STORAGE_BUCKET || '',
        FIREBASE_WEB_API_KEY: FIREBASE_WEB_API_KEY || '',
        CORS_ORIGIN: CORS_ORIGIN || '*',
        ACCOUNT_CHANGE_CODE_SECRET: cleanEnvValue(ACCOUNT_CHANGE_CODE_SECRET),
        SMTP_HOST: cleanEnvValue(SMTP_HOST) || 'smtp.gmail.com',
        SMTP_PORT: cleanEnvValue(SMTP_PORT) || '587',
        SMTP_SECURE: cleanEnvValue(SMTP_SECURE) || 'false',
        SMTP_USER: cleanEnvValue(SMTP_USER),
        SMTP_PASS: cleanEnvValue(SMTP_PASS, { stripSpaces: true }),
        MAIL_FROM: cleanEnvValue(MAIL_FROM),
        ADMIN_EMAIL: cleanEnvValue(ADMIN_EMAIL),
        NUVEI_LTP_SERVER_KEY: cleanEnvValue(NUVEI_LTP_SERVER_KEY),
        NUVEI_LTP_SERVER_SECRET: cleanEnvValue(NUVEI_LTP_SERVER_SECRET),
        NUVEI_API_ENDPOINT: cleanEnvValue(NUVEI_API_ENDPOINT),
        FRONT_DNS: cleanEnvValue(FRONT_DNS) || 'https://q-sonic.vercel.app',
    };
}
