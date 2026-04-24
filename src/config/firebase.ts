import * as admin from 'firebase-admin';
import { getEnv } from './env';

// Singleton initialization to ensure we don't try to initialize multiple times 
// or access firebase before initialization.
let initialized = false;

export function initFirebase(): void {
    if (initialized || admin.apps.length > 0) {
        initialized = true;
        return;
    }

    try {
        const { FIREBASE_SERVICE_ACCOUNT_BASE64, FIREBASE_STORAGE_BUCKET } = getEnv();

        const serviceAccountJson = Buffer.from(FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString(
            'utf-8'
        );

        const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: FIREBASE_STORAGE_BUCKET,
        });

        initialized = true;
        console.log(`✅ Firebase initialized (project: ${(serviceAccount as any).project_id})`);
    } catch (error) {
        console.error('❌ Failed to initialize Firebase:', error);
        throw error;
    }
}

// Helper to ensure firebase is ready
const ensureReady = () => {
    if (!initialized && admin.apps.length === 0) {
        initFirebase();
    }
};

export const getFirestore = (): admin.firestore.Firestore => {
    ensureReady();
    return admin.firestore();
};

export const db: admin.firestore.Firestore = getFirestore();

export const getAuth = (): admin.auth.Auth => {
    ensureReady();
    return admin.auth();
};

export const getStorage = (): admin.storage.Storage => {
    ensureReady();
    return admin.storage();
};

export { admin };
