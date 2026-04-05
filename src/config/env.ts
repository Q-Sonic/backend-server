import 'dotenv/config';

interface EnvConfig {
    PORT: number;
    NODE_ENV: string;
    FIREBASE_SERVICE_ACCOUNT_BASE64: string;
    FIREBASE_STORAGE_BUCKET: string;
    FIREBASE_WEB_API_KEY: string;
    CORS_ORIGIN: string;
}

export function getEnv(): EnvConfig {
    const {
        PORT,
        NODE_ENV,
        FIREBASE_SERVICE_ACCOUNT_BASE64,
        FIREBASE_STORAGE_BUCKET,
        FIREBASE_WEB_API_KEY,
        CORS_ORIGIN,
    } = process.env;

    return {
        PORT: PORT ? parseInt(PORT, 10) : 3000,
        NODE_ENV: NODE_ENV ?? 'development',
        FIREBASE_SERVICE_ACCOUNT_BASE64: FIREBASE_SERVICE_ACCOUNT_BASE64 || '',
        FIREBASE_STORAGE_BUCKET: FIREBASE_STORAGE_BUCKET || '',
        FIREBASE_WEB_API_KEY: FIREBASE_WEB_API_KEY || '',
        CORS_ORIGIN: CORS_ORIGIN || '*',
    };
}
