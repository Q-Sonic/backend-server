import { getStorageBucket } from '../../helper/storage';

export class StorageService {
    private get bucket() {
        return getStorageBucket();
    }

    async uploadFileWithMetadata(
        fileBuffer: Buffer,
        originalName: string,
        mimeType: string,
        folder = 'uploads'
    ): Promise<{ url: string; storagePath: string; fileName: string }> {
        const timestamp = Date.now();
        const sanitizedName = originalName.replace(/\s+/g, '_');
        const fileName = `${timestamp}_${sanitizedName}`;
        const storagePath = `${folder}/${fileName}`;
        const file = this.bucket.file(storagePath);

        await file.save(fileBuffer, {
            metadata: { contentType: mimeType },
        });
        await file.makePublic();

        const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${storagePath}`;
        return { url: publicUrl, storagePath, fileName };
    }

    async uploadFile(
        fileBuffer: Buffer,
        originalName: string,
        mimeType: string,
        folder = 'uploads'
    ): Promise<string> {
        const { url } = await this.uploadFileWithMetadata(fileBuffer, originalName, mimeType, folder);
        return url;
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
