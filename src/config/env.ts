import 'dotenv/config';

interface EnvConfig {
    PORT: number;
    NODE_ENV: string;
    FIREBASE_SERVICE_ACCOUNT_BASE64: string;
    FIREBASE_STORAGE_BUCKET: string;
    FIREBASE_WEB_API_KEY: string;
}

export function getEnv(): EnvConfig {
    const {
        PORT,
        NODE_ENV,
        FIREBASE_SERVICE_ACCOUNT_BASE64,
        FIREBASE_STORAGE_BUCKET,
        FIREBASE_WEB_API_KEY,
    } = process.env;

    if (!FIREBASE_SERVICE_ACCOUNT_BASE64) {
        throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_BASE64 env variable');
    }
    if (!FIREBASE_STORAGE_BUCKET) {
        throw new Error('Missing FIREBASE_STORAGE_BUCKET env variable');
    }
    if (!FIREBASE_WEB_API_KEY) {
        throw new Error('Missing FIREBASE_WEB_API_KEY env variable');
    }

    return {
        PORT: PORT ? parseInt(PORT, 10) : 3000,
        NODE_ENV: NODE_ENV ?? 'development',
        FIREBASE_SERVICE_ACCOUNT_BASE64,
        FIREBASE_STORAGE_BUCKET,
        FIREBASE_WEB_API_KEY,
    };
}
