import nodemailer from 'nodemailer';
import { ACCOUNT_CHANGE_CODE_TTL_MINUTES } from '../../config/account-change.config';
import { getEnv } from '../../config/env';
import { Logger } from '../../utils/logger.util';

/**
 * Mail Service
 * Unified class for sending notifications via SMTP.
 */
export class MailService {
    private static transporter: nodemailer.Transporter | null = null;

    private static getTransporter(): nodemailer.Transporter {
        if (this.transporter) return this.transporter;
        const env = getEnv();
        if (!env.SMTP_USER || !env.SMTP_PASS) {
            throw new Error('SMTP no configurado: define SMTP_USER y SMTP_PASS en .env');
        }
        this.transporter = nodemailer.createTransport({
            host: env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(env.SMTP_PORT || '587', 10),
            secure: env.SMTP_SECURE === 'true',
            auth: {
                user: env.SMTP_USER,
                pass: env.SMTP_PASS,
            },
        });
        return this.transporter;
    }

    private static getFromAddress(): string {
        const env = getEnv();
        const mailFrom = env.MAIL_FROM?.trim();
        const smtpUser = env.SMTP_USER?.trim();
        return (mailFrom && mailFrom.includes('@')) ? mailFrom : `StageGo <${smtpUser}>`;
    }

    private static escapeHtml(s: string): string {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    static async sendAccountChangeVerificationCode(to: string, code: string, displayName: string): Promise<void> {
        const tx = this.getTransporter();
        const subject = 'Código de verificación — cambio de cuenta';
        const ttl = ACCOUNT_CHANGE_CODE_TTL_MINUTES;
        const text = `Hola${displayName ? ` ${displayName}` : ''},\n\nTu código para confirmar cambios de correo o contraseña es: ${code}\n\nCaduca en ${ttl} minutos.`;
        const html = `<p>Hola${displayName ? ` <strong>${this.escapeHtml(displayName)}</strong>` : ''},</p>
<p>Tu código para confirmar cambios es: <strong style="font-size:1.2rem;">${this.escapeHtml(code)}</strong></p>
<p>Caduca en ${ttl} minutos.</p>`;

        await tx.sendMail({
            from: this.getFromAddress(),
            to,
            subject,
            text,
            html,
        });
        Logger.info(`Account change code email sent to ${to}`);
    }

    static async sendPaymentConfirmationEmail(to: string, data: {
        userName: string;
        orderId: string;
        amount: number;
        transactionId: string;
        authorizationCode: string;
    }): Promise<void> {
        const tx = this.getTransporter();
        const subject = `Confirmación de Pago — Orden #${data.orderId}`;
        const html = `<p>Hola ${this.escapeHtml(data.userName)}, pago confirmado por $${data.amount}. Transacción: ${data.transactionId}</p>`;

        await tx.sendMail({
            from: this.getFromAddress(),
            to,
            subject,
            html,
        });
        Logger.info(`Payment confirmation email sent to ${to}`);
    }

    static async sendWithdrawalRequestNotification(artistName: string, amount: number, bankDetails: any): Promise<void> {
        const env = getEnv();
        const adminEmail = env.ADMIN_EMAIL || env.SMTP_USER;
        if (!adminEmail) return;

        const tx = this.getTransporter();
        const subject = `⚠️ Nueva Solicitud de Retiro: ${artistName}`;
        const html = `<p>Artista: ${artistName}, Monto: $${amount}</p>`;

        await tx.sendMail({
            from: `StageGo Billing <${env.SMTP_USER}>`,
            to: adminEmail,
            subject,
            html,
        });
        Logger.info(`Withdrawal notification sent to admin`);
    }

    static async sendWelcomeEmail(to: string, displayName: string): Promise<void> {
        const tx = this.getTransporter();
        const subject = '¡Bienvenido a StageGo! 🎤';
        const html = `<p>Hola ${this.escapeHtml(displayName)}, bienvenido a la plataforma.</p>`;

        await tx.sendMail({
            from: this.getFromAddress(),
            to,
            subject,
            html,
        });
        Logger.info(`Welcome email sent to ${to}`);
    }

    static async sendPasswordResetEmail(to: string, code: string, displayName: string): Promise<void> {
        const tx = this.getTransporter();
        const subject = 'Restablecer tu contraseña — StageGo';
        const html = `<p>Hola ${this.escapeHtml(displayName)}, tu código de recuperación es: ${code}</p>`;

        await tx.sendMail({
            from: this.getFromAddress(),
            to,
            subject,
            html,
        });
        Logger.info(`Password reset email sent to ${to}`);
    }

    static async sendContractSignedNotification(to: string, role: 'artist' | 'client', details: {
        contractId: string;
        contractUrl?: string;
        serviceName: string;
        eventName: string;
        artistName: string;
        clientName: string;
    }): Promise<void> {
        const tx = this.getTransporter();
        const subject = role === 'artist' 
            ? `✅ ¡Contrato Confirmado! - ${details.eventName}`
            : `✅ ¡Tu reserva está lista! - ${details.artistName}`;
        
        const html = `<p>Hola ${role === 'artist' ? this.escapeHtml(details.artistName) : this.escapeHtml(details.clientName)}, se ha firmado el contrato para ${this.escapeHtml(details.eventName)}.</p>`;

        await tx.sendMail({
            from: `StageGo Contracts <${getEnv().SMTP_USER}>`,
            to,
            subject,
            html,
        });
        Logger.info(`Contract signed notification sent to ${role}: ${to}`);
    }

    /**
     * Compatibility wrapper for simple notification (legacy/simplified call)
     */
    static async sendSimpleContractNotification(to: string, details: { contractId: string; clientName: string; eventName: string; amount: number }): Promise<void> {
        const tx = this.getTransporter();
        const subject = `✅ ¡Nueva contratación! - ${details.eventName}`;
        const html = `<p>Hola, tienes una nueva solicitud de contrato para ${details.eventName} por un monto de $${details.amount}.</p>`;

        await tx.sendMail({
            from: this.getFromAddress(),
            to,
            subject,
            html,
        });
    }
}
