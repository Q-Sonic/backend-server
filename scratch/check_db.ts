import { getFirestore } from '../src/config/firebase';

async function check() {
    const db = getFirestore();
    console.log('--- SCANNING ALL CONTRACTS ---');
    const snap = await db.collection('contracts').get();
    console.log(`Total documents found: ${snap.size}`);
    
    snap.docs.forEach(doc => {
        const d = doc.data();
        console.log(`ID: ${doc.id} | ArtistId: ${d.artistId} | Status: ${d.status} | Date: ${JSON.stringify(d.eventDetails?.date)}`);
    });
    console.log('--- END SCAN ---');
}

check().catch(console.error);
