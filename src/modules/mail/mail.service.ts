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

    try {
        await tx.sendMail({
            from: fromAddr.includes('<') || fromAddr.includes('@') ? fromAddr : `StageGo <${fromAddr}>`,
            to,
            subject,
            text,
            html,
        });
        Logger.info(`Account change code email sent successfully to ${to}`);
    } catch (error) {
        Logger.error(`Failed to send account change code email to ${to}:`, error);
        throw error;
    }
}

export async function sendWithdrawalRequestNotification(
    artistName: string,
    amount: number,
    bankDetails: any
): Promise<void> {
    const env = getEnv();
    const adminEmail = env.ADMIN_EMAIL || env.SMTP_USER; // Default to SMTP user if no admin email
    if (!adminEmail) return;

    const tx = getTransporter();
    const subject = `⚠️ Nueva Solicitud de Retiro: ${artistName}`;
    
    const html = `
        <h2>Nueva solicitud de retiro recibida</h2>
        <p>El artista <strong>${artistName}</strong> ha solicitado un retiro.</p>
        <p><strong>Monto:</strong> $${amount}</p>
        <hr/>
        <h3>Datos Bancarios:</h3>
        <ul>
            <li><strong>Banco:</strong> ${bankDetails.bankName}</li>
            <li><strong>Cuenta:</strong> ${bankDetails.accountNumber} (${bankDetails.accountType})</li>
            <li><strong>Titular:</strong> ${bankDetails.holderName}</li>
            <li><strong>Documento:</strong> ${bankDetails.holderDocument}</li>
        </ul>
        <p>Por favor, procesa este pago y marca la solicitud como completada en el panel administrativo.</p>
    `;

    try {
        await tx.sendMail({
            from: `StageGo Billing <${env.SMTP_USER}>`,
            to: adminEmail,
            subject,
            html,
        });
        Logger.info(`Withdrawal notification sent to admin: ${adminEmail}`);
    } catch (error) {
        Logger.error(`Failed to send withdrawal notification to admin (${adminEmail}):`, error);
        // Do not throw here to avoid failing user request if only admin notification fails
    }
}

export async function sendWelcomeEmail(to: string, displayName: string): Promise<void> {
    const env = getEnv();
    const tx = getTransporter();
    const subject = '¡Bienvenido a StageGo! 🎤';
    
    const html = `
        <div style="font-family: sans-serif; color: #333;">
            <h2>¡Hola ${escapeHtml(displayName)}!</h2>
            <p>Gracias por unirte a <strong>StageGo</strong>, la plataforma que conecta el talento con las mejores oportunidades.</p>
            <p>Tu cuenta ha sido creada con éxito. Ya podés iniciar sesión y completar tu perfil para empezar a recibir contrataciones.</p>
            <br/>
            <p>Si tenés alguna duda, estamos acá para ayudarte.</p>
            <p>¡Muchos éxitos!</p>
            <p>El equipo de StageGo</p>
        </div>
    `;

    try {
        await tx.sendMail({
            from: `StageGo <${env.SMTP_USER}>`,
            to,
            subject,
            html,
        });
        Logger.info(`Welcome email sent to ${to}`);
    } catch (error) {
        Logger.error(`Failed to send welcome email to ${to}:`, error);
        throw error;
    }
}

export async function sendPasswordResetEmail(to: string, code: string, displayName: string): Promise<void> {
    const env = getEnv();
    const tx = getTransporter();
    const subject = 'Restablecer tu contraseña — StageGo';
    const ttl = ACCOUNT_CHANGE_CODE_TTL_MINUTES;

    const html = `
        <div style="font-family: sans-serif; color: #333;">
            <h2>Hola ${escapeHtml(displayName)},</h2>
            <p>Recibimos una solicitud para restablecer tu contraseña en StageGo.</p>
            <p>Tu código de recuperación es:</p>
            <p style="font-size:1.8rem; letter-spacing: 0.2rem; font-weight: bold; color: #007bff;">${escapeHtml(code)}</p>
            <p>Este código expira en ${ttl} minutos.</p>
            <p>Si no solicitaste este cambio, podés ignorar este correo de forma segura.</p>
        </div>
    `;

    try {
        await tx.sendMail({
            from: `StageGo <${env.SMTP_USER}>`,
            to,
            subject,
            html,
        });
        Logger.info(`Password reset email sent to ${to}`);
    } catch (error) {
        Logger.error(`Failed to send password reset email to ${to}:`, error);
        throw error;
    }
}

export async function sendContractSignedNotification(
    to: string, 
    role: 'artist' | 'client',
    details: { contractId: string; serviceName: string; eventName: string; artistName: string; clientName: string }
): Promise<void> {
    const env = getEnv();
    const tx = getTransporter();
    const subject = role === 'artist' 
        ? `✅ ¡Contrato Confirmado! - ${details.eventName}`
        : `✅ ¡Tu reserva está lista! - ${details.artistName}`;
    
    const html = `
        <div style="font-family: sans-serif; color: #333; line-height: 1.6;">
            <h2 style="color: #28a745;">${role === 'artist' ? '¡Nueva contratación firmada!' : '¡Contrato formalizado exitosamente!'}</h2>
            <p>Hola <strong>${role === 'artist' ? escapeHtml(details.artistName) : escapeHtml(details.clientName)}</strong>,</p>
            <p>Se ha formalizado el contrato para el evento <strong>${escapeHtml(details.eventName)}</strong>.</p>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 5px solid #28a745;">
                <p style="margin: 0;"><strong>Servicio:</strong> ${escapeHtml(details.serviceName)}</p>
                <p style="margin: 0;"><strong>${role === 'artist' ? 'Cliente' : 'Artista'}:</strong> ${role === 'artist' ? escapeHtml(details.clientName) : escapeHtml(details.artistName)}</p>
                <p style="margin: 0;"><strong>ID Contrato:</strong> ${details.contractId}</p>
            </div>
            <p>Ya podés acceder a la plataforma para descargar el contrato en PDF y coordinar los detalles finales.</p>
            <br/>
            <p>Gracias por confiar en <strong>StageGo</strong>.</p>
        </div>
    `;

    try {
        await tx.sendMail({
            from: `StageGo Contracts <${env.SMTP_USER}>`,
            to,
            subject,
            html,
        });
        Logger.info(`Contract signed notification sent to ${role}: ${to}`);
    } catch (error) {
        Logger.error(`Failed to send contract signed notification to ${role} (${to}):`, error);
        // Optional: throw if critical
    }
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
