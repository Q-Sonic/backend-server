import { getAuth, admin } from '../../config/firebase';
import { UserRecord, UserRole } from '../../types';
import { UserRoleEnum } from '../../enum/roles.enum';
import { BaseFirestoreService, PaginatedResult, PaginateOptions } from '../../helper/base.service';

export class UsersService extends BaseFirestoreService<UserRecord> {
    constructor() {
        super('users');
    }

    /**
     * Advanced pagination with search for users
     */
    async findPaginated(options: PaginateOptions): Promise<PaginatedResult<UserRecord>> {
        return this.paginate({
            ...options,
            orderBy: options.orderBy || 'createdAt',
            orderDirection: options.orderDirection || 'desc'
        });
    }

    /**
     * Search by tag (specific field match like email)
     */
    async searchByTag(field: string, value: string): Promise<UserRecord[]> {
        return this.findByField(field, value);
    }

    /**
     * Get display names for many uids (for list enrichment).
     */
    async getDisplayNamesByUids(uids: string[]): Promise<Record<string, string>> {
        const out: Record<string, string> = {};
        if (uids.length === 0) return out;
        const uniq = [...new Set(uids)];
        
        await Promise.all(
            uniq.map(async (uid) => {
                const user = await this.findById(uid);
                out[uid] = user?.displayName?.trim() ?? '';
            })
        );
        return out;
    }

    /**
     * Override update to handle Firebase Auth Custom Claims
     */
    async update(uid: string, data: Partial<Omit<UserRecord, 'uid' | 'createdAt'>>): Promise<UserRecord> {
        const updatedUser = await super.update(uid, data);

        if (data.role != null) {
            await getAuth().setCustomUserClaims(uid, { role: data.role as UserRole });
        }

        return updatedUser;
    }

    /**
     * Override delete to also remove from Firebase Auth
     */
    async delete(uid: string): Promise<void> {
        await super.delete(uid);
        // También elimina de Firebase Auth
        await admin.auth().deleteUser(uid);
    }

    /**
     * Special creation logic for Artists (Admin only)
     */
    async createArtist(email: string, password: string, displayName: string): Promise<UserRecord> {
        // 1. Crea el usuario en Firebase Auth usando el SDK de Admin
        const firebaseUser = await admin.auth().createUser({
            email,
            password,
            displayName,
        });

        // 2. Asigna el rol mediante Firebase Custom Claims
        await admin.auth().setCustomUserClaims(firebaseUser.uid, { role: UserRoleEnum.ARTISTA });

        // 3. Guarda el perfil en Firestore using the base create method with the UID
        return this.create({
            uid: firebaseUser.uid,
            email,
            displayName,
            role: UserRoleEnum.ARTISTA,
            emailVerified: false,
        });
    }
}
