import { getStorage } from '../config/firebase';
import { getEnv } from '../config/env';

/** Normalize bucket name: strip gs:// prefix. Firebase expects plain name. */
export function normalizeBucketName(name: string): string {
    return name.replace(/^gs:\/\//, '').trim();
}

/**
 * Returns the Firebase Storage bucket for uploads.
 * Uses FIREBASE_STORAGE_BUCKET from env (normalized). The bucket name must match
 * Firebase Console → Storage: use {projectId}.appspot.com or {projectId}.firebasestorage.app (newer projects).
 */
export function getStorageBucket(): ReturnType<ReturnType<typeof getStorage>['bucket']> {
    const raw = getEnv().FIREBASE_STORAGE_BUCKET;
    const bucketName = normalizeBucketName(raw);
    if (!bucketName) {
        throw new Error(
            'FIREBASE_STORAGE_BUCKET is empty. Set it to your bucket name (e.g. project-id.appspot.com or project-id.firebasestorage.app). See Firebase Console → Storage.'
        );
    }
    return getStorage().bucket(bucketName);
}

/** User-friendly message when Storage returns "bucket does not exist". */
export function formatStorageBucketError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('bucket does not exist') || msg.includes('404') || msg.includes('notFound')) {
        return (
            'Storage bucket not found. Check FIREBASE_STORAGE_BUCKET in your env: use the exact bucket name from Firebase Console → Storage (e.g. project-id.appspot.com or project-id.firebasestorage.app for newer projects).'
        );
    }
    return msg;
}

/** Returns the default Storage bucket name (for URL parsing). */
export function getStorageBucketName(): string {
    return normalizeBucketName(getEnv().FIREBASE_STORAGE_BUCKET);
}

/**
 * Extracts the file path in the bucket from a public Storage URL.
 * Returns null if the URL is not from our bucket (e.g. external URL).
 * Example: https://storage.googleapis.com/my-bucket/client_profiles/uid/photo_1.jpg → client_profiles/uid/photo_1.jpg
 */
export function extractFilePathFromStorageUrl(url: string): string | null {
    if (!url || typeof url !== 'string') return null;
    try {
        const parsed = new URL(url);
        if (parsed.hostname !== 'storage.googleapis.com') return null;
        const pathSegments = parsed.pathname.replace(/^\/+/, '').split('/');
        const bucketName = getStorageBucketName();
        if (pathSegments[0] !== bucketName) return null;
        return pathSegments.slice(1).join('/') || null;
    } catch {
        return null;
    }
}

// ─── File size limits (in bytes) ─────────────────────────────────────────────
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;   // 5 MB
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB (short videos)
export const MAX_AUDIO_SIZE = 10 * 1024 * 1024;  // 10 MB
