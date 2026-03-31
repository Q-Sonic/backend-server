import nodemailer from 'nodemailer';
import { ACCOUNT_CHANGE_CODE_TTL_MINUTES } from '../../config/account-change.config';
import { getEnv } from '../../config/env';
import { Logger } from '../../utils/logger.util';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
    if (transporter) return transporter;
    const env = getEnv();
    if (!env.SMTP_USER || !env.SMTP_PASS) {
        throw new Error('SMTP no configurado: define SMTP_USER y SMTP_PASS en .env');
    }
    transporter = nodemailer.createTransport({
        host: env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(env.SMTP_PORT || '587', 10),
        secure: env.SMTP_SECURE === 'true',
        auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
        },
    });
    return transporter;
}

export function isSmtpConfigured(): boolean {
    const env = getEnv();
    return !!(env.SMTP_USER && env.SMTP_PASS);
}

export async function sendAccountChangeVerificationCode(to: string, code: string, displayName: string): Promise<void> {
    const env = getEnv();
    const mailFrom = env.MAIL_FROM?.trim();
    const smtpUser = env.SMTP_USER?.trim();
    /** Si MAIL_FROM no es un correo, usar solo la cuenta SMTP como remitente. */
    const fromAddr =
        mailFrom && mailFrom.includes('@')
            ? mailFrom
            : smtpUser
              ? `StageGo <${smtpUser}>`
              : '';
    if (!fromAddr) {
        throw new Error('SMTP_USER requerido para enviar correo.');
    }
    const tx = getTransporter();
    const subject = 'Código de verificación — cambio de cuenta';
    const ttl = ACCOUNT_CHANGE_CODE_TTL_MINUTES;
    const text = `Hola${displayName ? ` ${displayName}` : ''},\n\nTu código para confirmar cambios de correo o contraseña es: ${code}\n\nCaduca en ${ttl} minutos. Si no lo solicitaste, ignora este mensaje.\n`;
    const html = `<p>Hola${displayName ? ` <strong>${escapeHtml(displayName)}</strong>` : ''},</p>
<p>Tu código para confirmar cambios de <strong>correo o contraseña</strong> es:</p>
<p style="font-size:1.5rem;letter-spacing:0.25em;font-weight:bold;">${escapeHtml(code)}</p>
<p>Caduca en ${ttl} minutos. Si no lo solicitaste, ignora este correo.</p>`;

    await tx.sendMail({
        from: fromAddr.includes('<') || fromAddr.includes('@') ? fromAddr : `Q-Sonic <${fromAddr}>`,
        to,
        subject,
        text,
        html,
    });
    Logger.info(`Account change code email sent to ${to}`);
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
