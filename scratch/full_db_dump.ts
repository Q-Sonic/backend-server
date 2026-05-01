import { getFirestore, admin } from '../src/config/firebase';

async function dump() {
    const db = getFirestore();
    const snapshot = await db.collection('contracts').get();
    
    console.log(`:::: TOTAL RECORDS IN DB: ${snapshot.size} ::::`);
    
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        let dateStr = 'NO DATE';
        if (data.eventDetails?.date instanceof admin.firestore.Timestamp) {
            dateStr = data.eventDetails.date.toDate().toISOString();
        } else if (data.eventDetails?.date) {
            dateStr = JSON.stringify(data.eventDetails.date);
        }

        console.log(`- ID: ${doc.id}`);
        console.log(`  Artist: ${data.artistId}`);
        console.log(`  Client: ${data.clientId}`);
        console.log(`  Status: ${data.status}`);
        console.log(`  Date:   ${dateStr}`);
        console.log('-----------------------------------');
    });
}

dump().catch(console.error);
