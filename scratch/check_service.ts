import { getFirestore } from '../src/config/firebase';

async function check() {
    const db = getFirestore();
    const serviceId = 'PDolyXET7w8yY4a3TZ9Q';
    const doc = await db.collection('artist_services').doc(serviceId).get();
    if (doc.exists) {
        console.log(':::: SERVICE FOUND ::::');
        console.log(JSON.stringify(doc.data(), null, 2));
    } else {
        console.log('Service not found');
    }
}

check().catch(console.error);
