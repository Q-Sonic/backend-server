import { getStorage, admin } from '../../config/firebase';
import { getEnv } from '../../config/env';

export class StorageService {
    private bucket: any; // bucket type from @google-cloud/storage

    constructor() {
        this.bucket = getStorage().bucket(getEnv().FIREBASE_STORAGE_BUCKET);
    }

    async uploadFile(
        fileBuffer: Buffer,
        originalName: string,
        mimeType: string,
        folder = 'uploads'
    ): Promise<string> {
        const timestamp = Date.now();
        const fileName = `${folder}/${timestamp}_${originalName}`;
        const file = this.bucket.file(fileName);

        await file.save(fileBuffer, {
            metadata: { contentType: mimeType },
            public: true,
        });

        const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${fileName}`;
        return publicUrl;
    }

    async deleteFile(filePath: string): Promise<void> {
        await this.bucket.file(filePath).delete();
    }

    async getSignedUrl(filePath: string, expiresInMs = 3600000): Promise<string> {
        const [url] = await this.bucket.file(filePath).getSignedUrl({
            action: 'read',
            expires: Date.now() + expiresInMs,
        });
        return url;
    }
}
