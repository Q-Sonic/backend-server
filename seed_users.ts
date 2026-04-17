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

        // --- CREAR CONTRATOS PARA NUTRI ---
        console.log('--- Generando Contratos de Prueba ---');
        const nutriId = (await auth.getUserByEmail('nutringest@gmail.com')).uid;
        const clienteId = (await auth.getUserByEmail('sojoj6573@gmail.com')).uid;
        const now = admin.firestore.Timestamp.now();

        const testContracts = [
            {
                artistId: nutriId,
                clientId: clienteId,
                serviceId: 'service_premium_show',
                status: 'ACCEPTED',
                eventDetails: {
                    name: 'Boda de Prueba',
                    date: admin.firestore.Timestamp.fromDate(new Date('2026-05-20')),
                    location: 'Quito, Ecuador',
                    description: 'Evento de gala'
                },
                financials: {
                    totalAmount: 500,
                    paidAmount: 200,
                    paymentStatus: 'PARTIAL'
                },
                payments: [
                    { amount: 200, date: now, method: 'transfer', reference: 'REF-001' }
                ],
                createdAt: now,
                updatedAt: now
            },
            {
                artistId: nutriId,
                clientId: clienteId,
                serviceId: 'service_standard_show',
                status: 'COMPLETED',
                eventDetails: {
                    name: 'Aniversario Corporativo',
                    date: admin.firestore.Timestamp.fromDate(new Date('2026-03-10')),
                    location: 'Guayaquil, Ecuador',
                    description: 'Evento finalizado'
                },
                financials: {
                    totalAmount: 350,
                    paidAmount: 350,
                    paymentStatus: 'PAID'
                },
                payments: [
                    { amount: 350, date: now, method: 'cash', reference: 'REF-OLD' }
                ],
                createdAt: now,
                updatedAt: now
            }
        ];

        for (const contract of testContracts) {
            await db.collection('contracts').add(contract);
        }
        console.log('✅ Contratos generados correctamente');

        console.log('--- Sincronización finalizada ---');
        process.exit(0);
    } catch (err: any) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

seedUsers();
