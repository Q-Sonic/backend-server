import { getStorageBucket } from '../../helper/storage';

export class StorageService {
    private get bucket() {
        return getStorageBucket();
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
        });
        await file.makePublic();

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
