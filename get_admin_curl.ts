import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

async function getAdminCurl() {
    const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY;
    const email = 'stagego.admin@gmail.com';
    const password = 'abc.12345';

    try {
        const loginUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
        const loginRes = await axios.post(loginUrl, {
            email,
            password,
            returnSecureToken: true
        });

        const idToken = loginRes.data.idToken;

        console.log('\n--- COMANDO CURL PARA ADMINISTRAR RETIROS (COPIAR Y PEGAR) ---');
        console.log('\n1. Para COMPLETAR (Aprobar pago echo):');
        console.log(`
curl -X PUT http://localhost:3000/api/payments/admin/withdrawals/ID_DE_LA_SOLICITUD \\
  -H "Authorization: Bearer ${idToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "completed"
  }'
        `);

        console.log('\n2. Para RECHAZAR (Devuelve dinero al artista):');
        console.log(`
curl -X PUT http://localhost:3000/api/payments/admin/withdrawals/ID_DE_LA_SOLICITUD \\
  -H "Authorization: Bearer ${idToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "status": "rejected",
    "reason": "Cuenta bancaria inválida o inexistente."
  }'
        `);
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}

getAdminCurl();
