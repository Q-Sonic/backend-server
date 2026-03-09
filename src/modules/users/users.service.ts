import { getFirestore, admin } from '../../config/firebase';
import { UserRecord } from '../../types';
import { UserRoleEnum } from '../../enum/roles.enum';

export class UsersService {
    private db: admin.firestore.Firestore;

    constructor() {
        this.db = getFirestore();
    }

    async findAll(): Promise<UserRecord[]> {
        const snapshot = await this.db.collection('users').orderBy('createdAt', 'desc').get();
        return snapshot.docs.map((doc) => doc.data() as UserRecord);
    }

    async findById(uid: string): Promise<UserRecord> {
        const doc = await this.db.collection('users').doc(uid).get();
        if (!doc.exists) throw new Error(`User ${uid} not found`);
        return doc.data() as UserRecord;
    }

    async update(uid: string, data: Partial<Omit<UserRecord, 'uid' | 'createdAt'>>): Promise<UserRecord> {
        const ref = this.db.collection('users').doc(uid);
        const doc = await ref.get();
        if (!doc.exists) throw new Error(`User ${uid} not found`);

        const updated = { ...data, updatedAt: admin.firestore.Timestamp.now() };
        await ref.update(updated);

        const updatedDoc = await ref.get();
        return updatedDoc.data() as UserRecord;
    }

    async delete(uid: string): Promise<void> {
        const doc = await this.db.collection('users').doc(uid).get();
        if (!doc.exists) throw new Error(`User ${uid} not found`);

        await this.db.collection('users').doc(uid).delete();
        // También elimina de Firebase Auth
        await admin.auth().deleteUser(uid);
    }

    async createArtist(email: string, password: string, displayName: string): Promise<UserRecord> {
        // 1. Crea el usuario en Firebase Auth usando el SDK de Admin
        const firebaseUser = await admin.auth().createUser({
            email,
            password,
            displayName,
        });

        // 2. Asigna el rol mediante Firebase Custom Claims
        await admin.auth().setCustomUserClaims(firebaseUser.uid, { role: UserRoleEnum.ARTISTA });

        // 3. Guarda el perfil en Firestore
        const now = admin.firestore.Timestamp.now();
        const userRecord: UserRecord = {
            uid: firebaseUser.uid,
            email,
            displayName,
            role: UserRoleEnum.ARTISTA,
            createdAt: now,
            updatedAt: now,
        };

        await this.db.collection('users').doc(firebaseUser.uid).set(userRecord);
        return userRecord;
    }
}
