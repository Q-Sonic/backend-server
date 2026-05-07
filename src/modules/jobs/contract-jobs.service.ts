import * as admin from 'firebase-admin';
import cron from 'node-cron';
import { ContractStatus, PaymentStatus } from '../../types';
import { MailService } from '../mail/mail.service';
import { PaymentsService } from '../payments/payments.service';
import { Logger } from '../../utils/logger.util';

const db = () => admin.firestore();

function toDateMs(raw: any): number {
    if (!raw) return 0;
    if (raw && typeof raw === 'object' && '_seconds' in raw) return raw._seconds * 1000;
    if (raw instanceof Date) return raw.getTime();
    return 0;
}

function formatDateEs(ms: number): string {
    try {
        return new Intl.DateTimeFormat('es', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).format(new Date(ms));
    } catch {
        return new Date(ms).toISOString().slice(0, 10);
    }
}

/**
 * Auto-cancel contracts with unpaid status where the event is 1 day or less away.
 * Sends reminder emails daily and cancels when < 24h remain.
 */
async function runPaymentDeadlineCheck(): Promise<void> {
    Logger.info('[ContractJobs] Running payment deadline check...');
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    try {
        const snapshot = await db()
            .collection('contracts')
            .where('status', 'in', [ContractStatus.PENDING, 'PENDING_ARTIST_SIGNATURE'])
            .get();

        for (const doc of snapshot.docs) {
            const data = doc.data();
            if (String(data.financials?.paymentStatus || '').toLowerCase() === PaymentStatus.PAID) continue;

            const eventMs = toDateMs(data.eventDetails?.date);
            if (!eventMs) continue;

            const msUntilEvent = eventMs - now;
            const daysLeft = Math.ceil(msUntilEvent / oneDayMs);

            // Auto-cancel if event is less than 24h away and still unpaid
            if (msUntilEvent <= oneDayMs && msUntilEvent > 0) {
                Logger.info(`[ContractJobs] Auto-cancelling unpaid contract ${doc.id} (event in ${daysLeft}d)`);
                await doc.ref.update({
                    status: ContractStatus.CANCELLED,
                    updatedAt: admin.firestore.Timestamp.now(),
                });

                try {
                    const clientDoc = await db().collection('users').doc(data.clientId).get();
                    const clientEmail = clientDoc.data()?.email;
                    const clientName = clientDoc.data()?.displayName || 'Cliente';
                    if (clientEmail) {
                        await MailService.sendContractAutoCancelledEmail(clientEmail, {
                            userName: clientName,
                            eventName: data.eventDetails?.name || 'Evento',
                            eventDate: formatDateEs(eventMs),
                        });
                    }
                } catch (mailErr) {
                    Logger.error(`[ContractJobs] Failed to send auto-cancel email for ${doc.id}:`, mailErr);
                }
                continue;
            }

            // Send daily reminder for unpaid contracts still in the future
            if (msUntilEvent > 0 && daysLeft <= 7) {
                try {
                    const clientDoc = await db().collection('users').doc(data.clientId).get();
                    const clientEmail = clientDoc.data()?.email;
                    const clientName = clientDoc.data()?.displayName || 'Cliente';
                    if (clientEmail) {
                        await MailService.sendPendingPaymentReminderEmail(clientEmail, {
                            userName: clientName,
                            eventName: data.eventDetails?.name || 'Evento',
                            eventDate: formatDateEs(eventMs),
                            amount: data.financials?.totalAmount || 0,
                            daysLeft,
                            contractId: doc.id,
                        });
                    }
                } catch (mailErr) {
                    Logger.error(`[ContractJobs] Failed to send reminder email for ${doc.id}:`, mailErr);
                }
            }
        }
    } catch (err) {
        Logger.error('[ContractJobs] Error in payment deadline check:', err);
    }
}

/**
 * Auto-refund contracts where the artist didn't sign and the event date has passed.
 */
async function runArtistSignatureExpiryCheck(): Promise<void> {
    Logger.info('[ContractJobs] Running artist signature expiry check...');
    const now = Date.now();

    try {
        const snapshot = await db()
            .collection('contracts')
            .where('status', 'in', [ContractStatus.PENDING, 'PENDING_ARTIST_SIGNATURE'])
            .get();

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const eventMs = toDateMs(data.eventDetails?.date);
            if (!eventMs) continue;

            // Event date has passed and artist still hasn't signed
            if (eventMs < now) {
                Logger.info(`[ContractJobs] Expiring unsigned contract ${doc.id} (event was ${new Date(eventMs).toISOString()})`);
                await doc.ref.update({
                    status: ContractStatus.EXPIRED,
                    updatedAt: admin.firestore.Timestamp.now(),
                });

                // If the client paid, issue a refund
                if (String(data.financials?.paymentStatus || '').toLowerCase() === PaymentStatus.PAID) {
                    try {
                        await PaymentsService.refundByContractId(doc.id);
                    } catch (refundErr) {
                        Logger.error(`[ContractJobs] Refund failed for expired contract ${doc.id}:`, refundErr);
                    }

                    try {
                        const clientDoc = await db().collection('users').doc(data.clientId).get();
                        const clientEmail = clientDoc.data()?.email;
                        const clientName = clientDoc.data()?.displayName || 'Cliente';
                        const artistDoc = await db().collection('users').doc(data.artistId).get();
                        const artistName = artistDoc.data()?.displayName || 'el artista';
                        if (clientEmail) {
                            await MailService.sendArtistNoSignRefundEmail(clientEmail, {
                                userName: clientName,
                                eventName: data.eventDetails?.name || 'Evento',
                                amount: data.financials?.totalAmount || 0,
                                artistName,
                            });
                        }
                    } catch (mailErr) {
                        Logger.error(`[ContractJobs] Failed to send expiry refund email for ${doc.id}:`, mailErr);
                    }
                }
            }
        }
    } catch (err) {
        Logger.error('[ContractJobs] Error in artist signature expiry check:', err);
    }
}

/**
 * Initializes all scheduled contract jobs.
 * Call once at server startup.
 */
export function initContractJobs(): void {
    // Run daily at 8:00 AM (server time): payment reminders + auto-cancellation
    cron.schedule('0 8 * * *', async () => {
        await runPaymentDeadlineCheck();
    });

    // Run daily at 9:00 AM: expire unsigned contracts past their event date
    cron.schedule('0 9 * * *', async () => {
        await runArtistSignatureExpiryCheck();
    });

    Logger.info('[ContractJobs] Scheduled jobs initialized (payment check @ 08:00, expiry check @ 09:00)');
}
