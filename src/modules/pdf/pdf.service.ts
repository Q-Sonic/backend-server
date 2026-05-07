import PDFDocument from 'pdfkit';
import { ContractRecord, EventDetails, UserRecord } from '../../types';

export class PdfService {
    private formatDateKey(dateKey: string): string {
        const [y, m, d] = dateKey.split('-').map(Number);
        if (!y || !m || !d) return dateKey;
        return new Date(y, m - 1, d).toLocaleDateString('es-EC', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
    }

    private timestampLabel(value: unknown): string {
        const anyValue = value as { toDate?: () => Date; _seconds?: number } | string | undefined;
        let date: Date | null = null;
        if (anyValue && typeof anyValue === 'object' && typeof anyValue.toDate === 'function') {
            date = anyValue.toDate();
        } else if (anyValue && typeof anyValue === 'object' && typeof anyValue._seconds === 'number') {
            date = new Date(anyValue._seconds * 1000);
        } else if (typeof anyValue === 'string') {
            const parsed = new Date(anyValue);
            if (!Number.isNaN(parsed.getTime())) date = parsed;
        }
        return date ? date.toLocaleString('es-EC') : 'No registrado';
    }

    private async fetchImageBuffer(url?: string): Promise<Buffer | null> {
        if (!url) return null;
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const bytes = await res.arrayBuffer();
            return Buffer.from(bytes);
        } catch {
            return null;
        }
    }

    /**
     * Generates a final signed contract PDF with visible signatures.
     * @param contract The contract record.
     * @param artist User record of the artist.
     * @param client User record of the client.
     */
    async generateContractPdf(contract: ContractRecord, artist: UserRecord, client: UserRecord): Promise<Buffer> {
        const [clientSignature, artistSignature] = await Promise.all([
            this.fetchImageBuffer(contract.clientSignatureUrl),
            this.fetchImageBuffer(contract.artistSignatureUrl),
        ]);

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 46, size: 'A4' });
            const buffers: Buffer[] = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            doc.rect(0, 0, doc.page.width, 86).fill('#0E1726');
            doc.fillColor('#00CCCB').fontSize(22).font('Helvetica-Bold').text('Stage Go', 46, 28);
            doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica').text('Contrato final firmado digitalmente', 46, 56);

            doc.fillColor('#1B2430').fontSize(10).font('Helvetica-Bold').text(`Contrato ID: ${contract.id}`, 46, 100);
            doc.fillColor('#333333').font('Helvetica').text(`Emisión: ${new Date().toLocaleString('es-EC')}`, 46, 116);

            doc.moveTo(46, 138).lineTo(doc.page.width - 46, 138).strokeColor('#D8E2EC').lineWidth(1).stroke();

            doc.fillColor('#0E1726').fontSize(13).font('Helvetica-Bold').text('Partes del contrato', 46, 152);
            doc.fillColor('#1F2937').fontSize(10).font('Helvetica');
            doc.text(`Artista: ${artist.displayName || 'Artista'} (${artist.email || 'sin correo'})`, 46, 172);
            doc.text(`Cliente: ${client.displayName || 'Cliente'} (${client.email || 'sin correo'})`, 46, 188);

            doc.fillColor('#0E1726').fontSize(13).font('Helvetica-Bold').text('Detalle del evento', 46, 218);
            doc.fillColor('#1F2937').fontSize(10).font('Helvetica');
            doc.text(`Servicio / Evento: ${contract.eventDetails?.name || 'Evento'}`, 46, 238);

            const extraDates = (contract.eventDetails as EventDetails & { eventDates?: string[] })?.eventDates;
            if (Array.isArray(extraDates) && extraDates.length > 1) {
                doc.text(`Fechas del evento (${extraDates.length}):`, 46, 254);
                let cursor = 270;
                extraDates.forEach((dk, i) => {
                    const label = this.formatDateKey(dk);
                    doc.text(`  ${i + 1}. ${label}`, 46, cursor, { width: doc.page.width - 92 });
                    cursor += 14;
                });
                doc.text(`Ubicación: ${contract.eventDetails?.location || 'Por definir'}`, 46, cursor + 4);
                if (contract.eventDetails?.description) {
                    doc.text(`Notas: ${contract.eventDetails.description}`, 46, cursor + 20, { width: doc.page.width - 92 });
                }
            } else {
                doc.text(`Fecha y hora: ${this.timestampLabel(contract.eventDetails?.date)}`, 46, 254);
                doc.text(`Ubicación: ${contract.eventDetails?.location || 'Por definir'}`, 46, 270);
                if (contract.eventDetails?.description) {
                    doc.text(`Notas: ${contract.eventDetails.description}`, 46, 286, { width: doc.page.width - 92 });
                }
            }

            doc.fillColor('#0E1726').fontSize(13).font('Helvetica-Bold').text('Términos financieros', 46, 330);
            doc.fillColor('#1F2937').fontSize(10).font('Helvetica');
            doc.text(`Monto total: $${Number(contract.financials?.totalAmount || 0).toLocaleString()}`, 46, 350);
            doc.text(`Pagado: $${Number(contract.financials?.paidAmount || 0).toLocaleString()}`, 46, 366);
            doc.text(`Estado de pago: ${String(contract.financials?.paymentStatus || '').toUpperCase() || 'UNPAID'}`, 46, 382);

            doc.fillColor('#0E1726').fontSize(13).font('Helvetica-Bold').text('Firmas digitales', 46, 420);
            doc.fillColor('#4B5563').fontSize(9).font('Helvetica').text(
                'Ambas partes aceptan este contrato mediante firma electrónica registrada en Stage Go.',
                46,
                438,
                { width: doc.page.width - 92 },
            );

            const leftBoxX = 46;
            const rightBoxX = doc.page.width / 2 + 10;
            const boxY = 472;
            const boxW = doc.page.width / 2 - 56;
            const boxH = 130;
            doc.roundedRect(leftBoxX, boxY, boxW, boxH, 8).strokeColor('#D1D5DB').lineWidth(1).stroke();
            doc.roundedRect(rightBoxX, boxY, boxW, boxH, 8).strokeColor('#D1D5DB').lineWidth(1).stroke();

            if (artistSignature) {
                doc.image(artistSignature, leftBoxX + 10, boxY + 10, { fit: [boxW - 20, 62], align: 'center' });
            }
            if (clientSignature) {
                doc.image(clientSignature, rightBoxX + 10, boxY + 10, { fit: [boxW - 20, 62], align: 'center' });
            }

            doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold').text('Firma del artista', leftBoxX + 10, boxY + 78);
            doc.fillColor('#4B5563').fontSize(8).font('Helvetica').text(
                `${artist.displayName || 'Artista'}\n${this.timestampLabel(contract.artistSignedAt)}`,
                leftBoxX + 10,
                boxY + 92,
                { width: boxW - 20 },
            );

            doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold').text('Firma del cliente', rightBoxX + 10, boxY + 78);
            doc.fillColor('#4B5563').fontSize(8).font('Helvetica').text(
                `${client.displayName || 'Cliente'}\n${this.timestampLabel(contract.clientSignedAt)}`,
                rightBoxX + 10,
                boxY + 92,
                { width: boxW - 20 },
            );

            doc.fillColor('#6B7280').fontSize(8).font('Helvetica').text(
                `Generado automáticamente por Stage Go • Contrato ${contract.id}`,
                46,
                doc.page.height - 36,
                { width: doc.page.width - 92, align: 'center' },
            );

            doc.end();
        });
    }

    /**
     * Generates an additional signature evidence receipt.
     */
    async generateSignatureReceiptPdf(contract: ContractRecord, artist: UserRecord, client: UserRecord): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 46, size: 'A4' });
            const buffers: Buffer[] = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            doc.fillColor('#0E1726').fontSize(21).font('Helvetica-Bold').text('Stage Go', { align: 'center' });
            doc.fillColor('#00CCCB').fontSize(12).text('Comprobante de firma digital', { align: 'center' });
            doc.moveDown(2);

            doc.fillColor('#111827').fontSize(11).font('Helvetica').text(`Contrato: ${contract.id}`);
            doc.text(`Servicio: ${contract.eventDetails?.name || 'Evento'}`);
            doc.text(`Artista: ${artist.displayName || 'Artista'} (${artist.email || 'sin correo'})`);
            doc.text(`Cliente: ${client.displayName || 'Cliente'} (${client.email || 'sin correo'})`);
            doc.moveDown();
            doc.text(`Firma cliente registrada: ${this.timestampLabel(contract.clientSignedAt)}`);
            doc.text(`Firma artista registrada: ${this.timestampLabel(contract.artistSignedAt)}`);
            doc.moveDown();
            if (contract.clientSignatureUrl) doc.text(`URL firma cliente: ${contract.clientSignatureUrl}`);
            if (contract.artistSignatureUrl) doc.text(`URL firma artista: ${contract.artistSignatureUrl}`);
            if (contract.contractUrl) doc.text(`URL contrato firmado: ${contract.contractUrl}`);

            doc.moveDown(2);
            doc.fillColor('#4B5563').fontSize(9).text(
                'Este comprobante acredita la captura de aceptación digital de ambas partes en Stage Go.',
                { align: 'justify' },
            );

            doc.end();
        });
    }
}
