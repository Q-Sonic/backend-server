import { getFirestore } from '../src/config/firebase';

async function fix() {
    const db = getFirestore();
    const serviceId = 'PDolyXET7w8yY4a3TZ9Q';
    await db.collection('artist_services').doc(serviceId).update({
        contractId: 'dummy-contract-id'
    });
    console.log('Service updated with dummy contractId');
}

fix().catch(console.error);
