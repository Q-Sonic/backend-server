import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

async function getCurl() {
    const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY;
    const email = 'nutringest@gmail.com'; // El nuevo correo
    const password = 'abc.12345';

    try {
        const loginUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
        const loginRes = await axios.post(loginUrl, {
            email,
            password,
            returnSecureToken: true
        });

        const idToken = loginRes.data.idToken;

        console.log('\n--- COMANDO CURL PARA RETIRO (COPIAR Y PEGAR) ---');
        console.log(`
curl -X POST http://localhost:3000/api/payments/withdraw \\
  -H "Authorization: Bearer ${idToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 25.00,
    "bankDetails": {
      "bankName": "Banco Pichincha",
      "accountNumber": "1122334455",
      "accountType": "Ahorros",
      "holderName": "José Nutri",
      "holderDocument": "0987654321"
    }
  }'
        `);
    } catch (err: any) {
        console.error('Error al obtener token:', err.response?.data?.error?.message || err.message);
    }
}

getCurl();
