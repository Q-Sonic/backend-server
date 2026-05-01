import { getFirestore } from '../src/config/firebase';

async function cleanup() {
    const db = getFirestore();
    const ghostId = 'XYkEqv5o2ybuq9j1nOi5mQXoGwz2';
    const snapshot = await db.collection('contracts').where('artistId', '==', ghostId).get();
    
    console.log(`:::: FOUND ${snapshot.size} CORRUPT CONTRACTS ::::`);
    
    for (const doc of snapshot.docs) {
        console.log(`Deleting contract: ${doc.id}`);
        await doc.ref.delete();
    }
    console.log('Cleanup complete.');
}

cleanup().catch(console.error);
