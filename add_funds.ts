import { getFirestore, initFirebase } from './src/config/firebase';
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

async function addFunds() {
    try {
        const db = getFirestore();
        const artistEmail = 'jsojo346@gmail.com';
        
        const userSnapshot = await db.collection('users').where('email', '==', artistEmail).get();
        if (userSnapshot.empty) {
            console.error('No se encontró el artista');
            process.exit(1);
        }

        const uid = userSnapshot.docs[0].id;
        
        await db.collection('artist_profiles').doc(uid).update({
            balance: admin.firestore.FieldValue.increment(100),
            updatedAt: admin.firestore.Timestamp.now()
        });

        console.log(`✅ ¡Felicidades! Se le cargaron $100.00 al artista ${artistEmail}`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

addFunds();
