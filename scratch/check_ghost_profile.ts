import { getFirestore } from '../src/config/firebase';

async function check() {
    const db = getFirestore();
    const ghostId = 'XYkEqv5o2ybuq9j1nOi5mQXoGwz2';
    const doc = await db.collection('artist_profiles').doc(ghostId).get();
    if (doc.exists) {
        console.log(':::: GHOST PROFILE FOUND ::::');
        console.log(JSON.stringify(doc.data(), null, 2));
    } else {
        console.log('Ghost profile doc not found in artist_profiles');
    }

    const userDoc = await db.collection('users').doc(ghostId).get();
    if (userDoc.exists) {
        console.log(':::: GHOST USER FOUND ::::');
        console.log(JSON.stringify(userDoc.data(), null, 2));
    }
}

check().catch(console.error);
