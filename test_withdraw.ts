import { getFirestore, initFirebase } from './src/config/firebase';
import { PaymentsService } from './src/modules/payments/payments.service';
import * as dotenv from 'dotenv';

dotenv.config();

async function testWithdraw() {
    try {
        const db = getFirestore();
        const artistEmail = 'jsojo346@gmail.com';
        
        const userSnapshot = await db.collection('users').where('email', '==', artistEmail).get();
        if (userSnapshot.empty) {
            console.error('No se encontró el artista');
            process.exit(1);
        }

        const uid = userSnapshot.docs[0].id;
        
        console.log('--- Iniciando Solicitud de Retiro ---');
        
        const withdrawalInput = {
            amount: 20,
            bankDetails: {
                bankName: 'Banco Pichincha',
                accountNumber: '1234567890',
                accountType: 'Ahorros',
                holderName: 'José Artista',
                holderDocument: '0999999999'
            }
        };

        const result = await PaymentsService.requestWithdraw(uid, withdrawalInput);
        
        console.log('✅ ¡Retiro Procesado en Base de Datos!');
        console.log('ID Solicitud:', result.id);
        console.log('Nuevo estado:', result.status);
        console.log('\n📧 Revisa tu correo (Admin) para confirmar que llegó la notificación.');

        process.exit(0);
    } catch (err: any) {
        console.error('❌ Error en el retiro:', err.message);
        process.exit(1);
    }
}

testWithdraw();
