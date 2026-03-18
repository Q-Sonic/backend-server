import PDFDocument from 'pdfkit';
import { ContractRecord, UserRecord } from '../../types';

export class PdfService {
    /**
     * Generates a PDF buffer for a contract.
     * @param contract The contract record.
     * @param artist User record of the artist.
     * @param client User record of the client.
     */
    async generateContractPdf(contract: ContractRecord, artist: UserRecord, client: UserRecord): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 50 });
            const buffers: Buffer[] = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            // --- Header ---
            doc.fillColor('#e94560').fontSize(25).text('CONTRATO DE SERVICIO MUSICAL', { align: 'center' });
            doc.moveDown();
            doc.fillColor('black').fontSize(12).text(`ID de Contrato: ${contract.id}`, { align: 'right' });
            doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, { align: 'right' });
            doc.moveDown(2);

            // --- Parties ---
            doc.fontSize(16).text('PARTES INVOLUCRADAS', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(12).text(`EL ARTISTA: ${artist.displayName} (${artist.email})`);
            doc.text(`EL CLIENTE: ${client.displayName} (${client.email})`);
            doc.moveDown(2);

            // --- Event Details ---
            doc.fontSize(16).text('DETALLES DEL EVENTO', { underline: true });
            doc.moveDown(0.5);
            const eventDate = contract.eventDetails.date.toDate().toLocaleString();
            doc.fontSize(12).text(`Evento: ${contract.eventDetails.name}`);
            doc.text(`Fecha y Hora: ${eventDate}`);
            doc.text(`Ubicación: ${contract.eventDetails.location}`);
            if (contract.eventDetails.description) {
                doc.text(`Notas adicionales: ${contract.eventDetails.description}`);
            }
            doc.moveDown(2);

            // --- Financials ---
            doc.fontSize(16).text('ACUERDO FINANCIERO', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(12).text(`Monto Total: $${contract.financials.totalAmount.toLocaleString()}`);
            doc.text(`Estado del Pago: ${contract.financials.paymentStatus.toUpperCase()}`);
            doc.text(`Pagado hasta la fecha: $${contract.financials.paidAmount.toLocaleString()}`);
            doc.moveDown(3);

            // --- Legal / Signature ---
            doc.fontSize(10).text(
                'Este documento sirve como comprobante legal del acuerdo mutuo entre el Artista y el Cliente. ' +
                'Ambas partes aceptan los términos y condiciones estipulados en la plataforma Q-Music.',
                { align: 'justify' }
            );
            
            doc.moveDown(4);
            const y = doc.y;
            doc.moveTo(50, y).lineTo(250, y).stroke();
            doc.moveTo(350, y).lineTo(550, y).stroke();
            doc.text('Firma del Artista', 50, y + 10, { width: 200, align: 'center' });
            doc.text('Firma del Cliente', 350, y + 10, { width: 200, align: 'center' });

            // --- Footer ---
            doc.fontSize(8).fillColor('grey').text(
                'Generado automáticamente por Q-Music Backend',
                50,
                doc.page.height - 50,
                { align: 'center' }
            );

            doc.end();
        });
    }
}
