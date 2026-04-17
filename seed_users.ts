import { getFirestore, initFirebase } from './src/config/firebase';
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { UserRoleEnum } from './src/enum/roles.enum';

dotenv.config();

async function seedUsers() {
    try {
        const db = getFirestore();
        const auth = admin.auth();

        const testUsers = [
            {
                email: 'nutringest@gmail.com', // Artista
                password: 'abc.12345',
                displayName: 'José Nutri (Artista)',
                role: UserRoleEnum.ARTISTA
            },
            {
                email: 'stagego.admin@gmail.com', // NUEVO: Admin para probar
                password: 'abc.12345',
                displayName: 'Admin StageGo',
                role: UserRoleEnum.ADMIN
            },
            {
                email: 'sojoj6573@gmail.com',
                password: 'abc.12345',
                displayName: 'José Cliente (Test)',
                role: UserRoleEnum.CLIENTE
            }
        ];

        console.log('--- Sincronizando Usuarios (Incluyendo ADMIN) ---');

        for (const user of testUsers) {
            let firebaseUser;
            try {
                const oldUser = await auth.getUserByEmail(user.email);
                await auth.deleteUser(oldUser.uid);
                await db.collection('users').doc(oldUser.uid).delete();
                await db.collection('artist_profiles').doc(oldUser.uid).delete();
                await db.collection('client_profiles').doc(oldUser.uid).delete();
            } catch (err) {}

            firebaseUser = await auth.createUser({
                email: user.email,
                password: user.password,
                displayName: user.displayName,
            });

            await auth.setCustomUserClaims(firebaseUser.uid, { role: user.role });
            const now = admin.firestore.Timestamp.now();

            await db.collection('users').doc(firebaseUser.uid).set({
                uid: firebaseUser.uid,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                createdAt: now,
                updatedAt: now,
            });

            if (user.role === UserRoleEnum.ARTISTA) {
                await db.collection('artist_profiles').doc(firebaseUser.uid).set({
                    uid: firebaseUser.uid,
                    balance: 100,
                    updatedAt: now,
                });
            }
            console.log(`✅ Usuario sincronizado: ${user.email} (${user.role})`);
        }

        console.log('--- Sincronización finalizada ---');
        process.exit(0);
    } catch (err: any) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

seedUsers();
