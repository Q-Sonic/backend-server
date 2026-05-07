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

    private static baseTemplate(title: string, content: string): string {
        return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0d0f12;font-family:Arial,Helvetica,sans-serif;color:#e0e0e0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0f12;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#141619;border-radius:16px;overflow:hidden;border:1px solid #252830;">
          <tr>
            <td style="background:linear-gradient(135deg,#0f2027,#1a3540);padding:28px 32px;text-align:center;">
              <span style="font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#38BACC;">Stage</span><span style="font-size:24px;font-weight:800;color:#fff;">Go</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#0d0f12;text-align:center;font-size:12px;color:#555;">
              © ${new Date().getFullYear()} StageGo · Este correo es automático, no respondas a este mensaje.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }

    // ─── Account ─────────────────────────────────────────────────────────────

    static async sendAccountChangeVerificationCode(to: string, code: string, displayName: string): Promise<void> {
        const tx = this.getTransporter();
        const ttl = ACCOUNT_CHANGE_CODE_TTL_MINUTES;
        const html = this.baseTemplate('Código de verificación', `
          <h2 style="color:#fff;margin:0 0 16px;">Hola${displayName ? `, <strong>${this.escapeHtml(displayName)}</strong>` : ''},</h2>
          <p>Tu código para confirmar cambios de correo o contraseña es:</p>
          <div style="text-align:center;margin:24px 0;">
            <span style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:8px;color:#38BACC;background:#1a3540;padding:16px 32px;border-radius:12px;">${this.escapeHtml(code)}</span>
          </div>
          <p style="color:#888;font-size:13px;">Caduca en ${ttl} minutos.</p>
        `);
        await tx.sendMail({ from: this.getFromAddress(), to, subject: 'Código de verificación — cambio de cuenta', html });
        Logger.info(`Account change code email sent to ${to}`);
    }

    static async sendWelcomeEmail(to: string, displayName: string): Promise<void> {
        const tx = this.getTransporter();
        const html = this.baseTemplate('¡Bienvenido a StageGo!', `
          <h2 style="color:#fff;margin:0 0 16px;">¡Hola, <strong>${this.escapeHtml(displayName)}</strong>!</h2>
          <p>Bienvenido a <strong>StageGo</strong>, la plataforma donde conectamos artistas y clientes para crear eventos únicos.</p>
          <p style="margin-top:24px;">Ya puedes explorar artistas, contratar servicios y gestionar tus reservas desde tu perfil.</p>
        `);
        await tx.sendMail({ from: this.getFromAddress(), to, subject: '¡Bienvenido a StageGo!', html });
        Logger.info(`Welcome email sent to ${to}`);
    }

    static async sendPasswordResetEmail(to: string, code: string, displayName: string): Promise<void> {
        const tx = this.getTransporter();
        const html = this.baseTemplate('Restablecer contraseña', `
          <h2 style="color:#fff;margin:0 0 16px;">Hola, <strong>${this.escapeHtml(displayName)}</strong></h2>
          <p>Tu código de recuperación de contraseña es:</p>
          <div style="text-align:center;margin:24px 0;">
            <span style="display:inline-block;font-size:28px;font-weight:800;letter-spacing:6px;color:#38BACC;background:#1a3540;padding:16px 32px;border-radius:12px;">${this.escapeHtml(code)}</span>
          </div>
        `);
        await tx.sendMail({ from: this.getFromAddress(), to, subject: 'Restablecer tu contraseña — StageGo', html });
        Logger.info(`Password reset email sent to ${to}`);
    }

    // ─── Payments ─────────────────────────────────────────────────────────────

    /**
     * Full payment confirmation email sent to the client — acts as a receipt/invoice.
     * Supports single and group payments (events array).
     */
    static async sendPaymentConfirmationEmail(to: string, data: {
        userName: string;
        orderId: string;
        amount: number;
        transactionId: string;
        authorizationCode: string;
        /** Single event (individual payment) */
        eventName?: string;
        eventDate?: string;
        eventLocation?: string;
        contractId?: string;
        /** Multiple events (group payment) — if provided, shows a table with all services */
        events?: Array<{ name: string; date: string; location: string; amount: number }>;
    }): Promise<void> {
        const tx = this.getTransporter();
        const isGroup = Array.isArray(data.events) && data.events.length > 1;
        const subject = isGroup
            ? `✅ Pago grupal confirmado — ${data.events!.length} servicios`
            : `✅ Pago confirmado — ${data.eventName || `Orden #${data.orderId}`}`;

        const eventsTable = isGroup ? `
          <p style="font-size:13px;color:#888;margin:0 0 12px;">Servicios incluidos en este pago:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1d22;border-radius:12px;padding:4px 20px;margin-bottom:24px;">
            ${data.events!.map((ev, i) => `
            <tr style="${i > 0 ? 'border-top:1px solid #2a2d35;' : ''}">
              <td style="padding:12px 0;">
                <p style="margin:0;color:#fff;font-weight:600;font-size:13px;">${this.escapeHtml(ev.name)}</p>
                <p style="margin:2px 0 0;color:#888;font-size:12px;">${this.escapeHtml(ev.date)}${ev.location ? ` · ${this.escapeHtml(ev.location)}` : ''}</p>
              </td>
              <td style="padding:12px 0;text-align:right;color:#38BACC;font-weight:700;white-space:nowrap;">$${ev.amount.toFixed(2)}</td>
            </tr>`).join('')}
          </table>
        ` : `
          ${data.eventName ? `<p style="margin:0 0 4px;color:#888;font-size:13px;">Evento: <strong style="color:#fff;">${this.escapeHtml(data.eventName)}</strong></p>` : ''}
          ${data.eventDate ? `<p style="margin:0 0 4px;color:#888;font-size:13px;">Fecha: <strong style="color:#fff;">${this.escapeHtml(data.eventDate)}</strong></p>` : ''}
          ${data.eventLocation ? `<p style="margin:0 0 16px;color:#888;font-size:13px;">Lugar: <strong style="color:#fff;">${this.escapeHtml(data.eventLocation)}</strong></p>` : ''}
        `;

        const html = this.baseTemplate('Confirmación de Pago', `
          <h2 style="color:#fff;margin:0 0 4px;">${isGroup ? 'Pago grupal confirmado' : 'Pago confirmado'}</h2>
          <p style="color:#38BACC;margin:0 0 24px;font-size:14px;">Hola, <strong>${this.escapeHtml(data.userName)}</strong> — tus reservas están aseguradas</p>

          ${eventsTable}

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1d22;border-radius:12px;padding:20px;margin-bottom:24px;">
            <tr><td colspan="2"><p style="margin:0 0 8px;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:0.5px;">Comprobante de pago</p></td></tr>
            <tr><td style="padding:6px 0;color:#888;font-size:13px;">Monto total pagado</td><td style="padding:6px 0;text-align:right;color:#38BACC;font-weight:800;font-size:20px;">$${data.amount.toFixed(2)}</td></tr>
            <tr><td style="padding:4px 0;color:#888;font-size:12px;">ID de transacción</td><td style="padding:4px 0;text-align:right;color:#aaa;font-size:12px;">${this.escapeHtml(data.transactionId)}</td></tr>
            ${data.authorizationCode ? `<tr><td style="padding:4px 0;color:#888;font-size:12px;">Autorización</td><td style="padding:4px 0;text-align:right;color:#aaa;font-size:12px;">${this.escapeHtml(data.authorizationCode)}</td></tr>` : ''}
            <tr><td style="padding:4px 0;color:#888;font-size:12px;">Referencia</td><td style="padding:4px 0;text-align:right;color:#aaa;font-size:12px;">${this.escapeHtml(data.orderId)}</td></tr>
          </table>

          <p style="font-size:13px;color:#888;line-height:1.6;">
            ${isGroup
                ? `Los artistas revisarán tus reservas próximamente. Si algún artista no puede confirmar, recibirás un <strong style="color:#fff;">reembolso automático</strong> por ese servicio.`
                : `El artista revisará tu reserva próximamente. Si no puede confirmar, recibirás un <strong style="color:#fff;">reembolso automático</strong> sin ningún trámite.`
            }
          </p>
          <p style="font-size:12px;color:#555;margin-top:12px;">Guarda este correo como comprobante de pago.</p>
        `);
        await tx.sendMail({ from: this.getFromAddress(), to, subject, html });
        Logger.info(`Payment confirmation email sent to ${to} (${isGroup ? `group: ${data.events!.length} events` : 'single'})`);
    }

    /**
     * Refund notification email sent to the client.
     */
    static async sendRefundNotificationEmail(to: string, data: {
        userName: string;
        eventName: string;
        amount: number;
        reason: string;
        contractId?: string;
    }): Promise<void> {
        const tx = this.getTransporter();
        const subject = `💳 Reembolso procesado — ${data.eventName}`;
        const html = this.baseTemplate('Reembolso Procesado', `
          <h2 style="color:#fff;margin:0 0 8px;">Tu reembolso está en camino</h2>
          <p style="color:#38BACC;margin:0 0 24px;font-size:14px;">Procesamos la devolución de tu pago</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1d22;border-radius:12px;padding:20px;margin-bottom:24px;">
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Cliente</td><td style="padding:8px 0;text-align:right;color:#fff;font-weight:600;">${this.escapeHtml(data.userName)}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Evento</td><td style="padding:8px 0;text-align:right;color:#fff;">${this.escapeHtml(data.eventName)}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Motivo</td><td style="padding:8px 0;text-align:right;color:#fff;">${this.escapeHtml(data.reason)}</td></tr>
            <tr><td colspan="2"><div style="border-top:1px solid #2a2d35;margin:8px 0;"></div></td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Monto a reembolsar</td><td style="padding:8px 0;text-align:right;color:#38BACC;font-weight:800;font-size:18px;">$${data.amount.toFixed(2)}</td></tr>
          </table>

          <p style="font-size:13px;color:#888;line-height:1.6;">
            El reembolso puede tardar entre <strong style="color:#fff;">5 a 10 días hábiles</strong> en reflejarse en tu tarjeta, según tu banco emisor.
          </p>
        `);
        await tx.sendMail({ from: this.getFromAddress(), to, subject, html });
        Logger.info(`Refund notification email sent to ${to}`);
    }

    /**
     * Daily payment reminder sent to clients with unpaid contracts.
     */
    static async sendPendingPaymentReminderEmail(to: string, data: {
        userName: string;
        eventName: string;
        eventDate: string;
        amount: number;
        daysLeft: number;
        contractId: string;
    }): Promise<void> {
        const tx = this.getTransporter();
        const urgency = data.daysLeft <= 1 ? '🚨 URGENTE — ' : data.daysLeft <= 3 ? '⏰ ' : '';
        const subject = `${urgency}Pago pendiente para tu evento — ${data.eventName}`;
        const warningColor = data.daysLeft <= 1 ? '#ef4444' : data.daysLeft <= 3 ? '#f59e0b' : '#38BACC';
        const html = this.baseTemplate('Pago Pendiente', `
          <h2 style="color:#fff;margin:0 0 8px;">Tienes un pago pendiente</h2>
          <p style="color:${warningColor};margin:0 0 24px;font-size:14px;">
            ${data.daysLeft <= 1 ? 'Si no pagas hoy, tu reserva se cancelará automáticamente' : `Quedan ${data.daysLeft} días para el evento`}
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1d22;border-radius:12px;padding:20px;margin-bottom:24px;">
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Evento</td><td style="padding:8px 0;text-align:right;color:#fff;font-weight:600;">${this.escapeHtml(data.eventName)}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Fecha del evento</td><td style="padding:8px 0;text-align:right;color:#fff;">${this.escapeHtml(data.eventDate)}</td></tr>
            <tr><td colspan="2"><div style="border-top:1px solid #2a2d35;margin:8px 0;"></div></td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Monto pendiente</td><td style="padding:8px 0;text-align:right;color:${warningColor};font-weight:800;font-size:18px;">$${data.amount.toFixed(2)}</td></tr>
          </table>

          <p style="font-size:13px;color:#888;line-height:1.6;">
            ${data.daysLeft <= 1
                ? '<strong style="color:#ef4444;">Esta es tu última oportunidad.</strong> Si el pago no se completa antes de mañana, la reserva se cancelará automáticamente sin cargo.'
                : 'Completa el pago para asegurar tu reserva. El artista no podrá confirmar hasta que el pago esté acreditado.'
            }
          </p>
        `);
        await tx.sendMail({ from: this.getFromAddress(), to, subject, html });
        Logger.info(`Payment reminder email sent to ${to} (${data.daysLeft} days left)`);
    }

    /**
     * Notification when a contract is auto-cancelled due to non-payment.
     */
    static async sendContractAutoCancelledEmail(to: string, data: {
        userName: string;
        eventName: string;
        eventDate: string;
    }): Promise<void> {
        const tx = this.getTransporter();
        const subject = `Reserva cancelada por falta de pago — ${data.eventName}`;
        const html = this.baseTemplate('Reserva Cancelada', `
          <h2 style="color:#fff;margin:0 0 8px;">Tu reserva fue cancelada</h2>
          <p style="color:#ef4444;margin:0 0 24px;font-size:14px;">No se recibió el pago en el tiempo establecido</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1d22;border-radius:12px;padding:20px;margin-bottom:24px;">
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Cliente</td><td style="padding:8px 0;text-align:right;color:#fff;">${this.escapeHtml(data.userName)}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Evento</td><td style="padding:8px 0;text-align:right;color:#fff;">${this.escapeHtml(data.eventName)}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Fecha planificada</td><td style="padding:8px 0;text-align:right;color:#fff;">${this.escapeHtml(data.eventDate)}</td></tr>
          </table>

          <p style="font-size:13px;color:#888;line-height:1.6;">
            Como no se completó el pago con al menos 1 día de anticipación al evento, la reserva fue cancelada automáticamente. <strong style="color:#fff;">No se realizó ningún cargo.</strong>
          </p>
          <p style="font-size:13px;color:#888;margin-top:16px;">
            Si deseas contratar nuevamente al artista, puedes iniciar una nueva reserva desde la plataforma.
          </p>
        `);
        await tx.sendMail({ from: this.getFromAddress(), to, subject, html });
        Logger.info(`Auto-cancel email sent to ${to}`);
    }

    /**
     * Notification when a client manually cancels a contract.
     */
    static async sendContractCancelledByClientEmail(to: string, data: {
        userName: string;
        eventName: string;
        wasPaid: boolean;
        amount?: number;
    }): Promise<void> {
        const tx = this.getTransporter();
        const subject = `Reserva cancelada — ${data.eventName}`;
        const html = this.baseTemplate('Reserva Cancelada', `
          <h2 style="color:#fff;margin:0 0 8px;">Cancelaste tu reserva</h2>
          <p style="color:#888;margin:0 0 24px;font-size:14px;">Hola <strong style="color:#fff;">${this.escapeHtml(data.userName)}</strong></p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1d22;border-radius:12px;padding:20px;margin-bottom:24px;">
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Evento</td><td style="padding:8px 0;text-align:right;color:#fff;">${this.escapeHtml(data.eventName)}</td></tr>
            ${data.wasPaid && data.amount != null ? `<tr><td style="padding:8px 0;color:#888;font-size:13px;">Reembolso</td><td style="padding:8px 0;text-align:right;color:#38BACC;font-weight:700;">$${data.amount.toFixed(2)}</td></tr>` : ''}
          </table>

          ${data.wasPaid
            ? '<p style="font-size:13px;color:#888;line-height:1.6;">Como ya habías pagado, hemos iniciado un <strong style="color:#fff;">reembolso automático</strong>. Puede tardar entre 5 a 10 días hábiles en reflejarse en tu tarjeta.</p>'
            : '<p style="font-size:13px;color:#888;line-height:1.6;">No se realizó ningún cargo porque el pago aún no estaba completado.</p>'
          }
        `);
        await tx.sendMail({ from: this.getFromAddress(), to, subject, html });
        Logger.info(`Client cancellation email sent to ${to}`);
    }

    /**
     * Notification to both parties when a contract is signed by the artist.
     */
    static async sendContractSignedNotification(to: string, role: 'artist' | 'client', details: {
        contractId: string;
        contractUrl?: string;
        serviceName: string;
        eventName: string;
        artistName: string;
        clientName: string;
        eventDate?: string;
        eventLocation?: string;
        amount?: number;
    }): Promise<void> {
        const tx = this.getTransporter();
        const isArtist = role === 'artist';
        const recipientName = isArtist ? details.artistName : details.clientName;
        const subject = isArtist
            ? `✅ Contrato aceptado — ${details.eventName}`
            : `✅ ¡Tu reserva está confirmada! — ${details.artistName}`;

        const html = this.baseTemplate('Contrato Firmado', `
          <h2 style="color:#fff;margin:0 0 8px;">${isArtist ? '¡Firmaste el contrato!' : '¡Tu reserva está confirmada!'}</h2>
          <p style="color:#38BACC;margin:0 0 24px;font-size:14px;">Hola, <strong>${this.escapeHtml(recipientName)}</strong></p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1d22;border-radius:12px;padding:20px;margin-bottom:24px;">
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Evento</td><td style="padding:8px 0;text-align:right;color:#fff;font-weight:600;">${this.escapeHtml(details.eventName)}</td></tr>
            ${isArtist ? `<tr><td style="padding:8px 0;color:#888;font-size:13px;">Cliente</td><td style="padding:8px 0;text-align:right;color:#fff;">${this.escapeHtml(details.clientName)}</td></tr>` : `<tr><td style="padding:8px 0;color:#888;font-size:13px;">Artista</td><td style="padding:8px 0;text-align:right;color:#fff;">${this.escapeHtml(details.artistName)}</td></tr>`}
            ${details.eventDate ? `<tr><td style="padding:8px 0;color:#888;font-size:13px;">Fecha</td><td style="padding:8px 0;text-align:right;color:#fff;">${this.escapeHtml(details.eventDate)}</td></tr>` : ''}
            ${details.eventLocation ? `<tr><td style="padding:8px 0;color:#888;font-size:13px;">Lugar</td><td style="padding:8px 0;text-align:right;color:#fff;">${this.escapeHtml(details.eventLocation)}</td></tr>` : ''}
            ${details.amount != null ? `<tr><td colspan="2"><div style="border-top:1px solid #2a2d35;margin:8px 0;"></div></td></tr><tr><td style="padding:8px 0;color:#888;font-size:13px;">Monto</td><td style="padding:8px 0;text-align:right;color:#38BACC;font-weight:800;font-size:18px;">$${details.amount.toFixed(2)}</td></tr>` : ''}
          </table>

          ${details.contractUrl ? `<div style="text-align:center;margin:24px 0;"><a href="${details.contractUrl}" style="display:inline-block;background:#38BACC;color:#000;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">Ver Contrato</a></div>` : ''}
          ${!isArtist ? '<p style="font-size:13px;color:#888;line-height:1.6;">El artista ha confirmado tu reserva. Si necesitas cancelar, puedes hacerlo desde tu perfil y se procesará un reembolso automático.</p>' : ''}
        `);
        await tx.sendMail({ from: this.getFromAddress(), to, subject, html });
        Logger.info(`Contract signed notification sent to ${role}: ${to}`);
    }

    /**
     * Auto-refund when artist didn't sign and event date passed.
     */
    static async sendArtistNoSignRefundEmail(to: string, data: {
        userName: string;
        eventName: string;
        amount: number;
        artistName: string;
    }): Promise<void> {
        const tx = this.getTransporter();
        const subject = `💳 Reembolso automático — el artista no confirmó tu reserva`;
        const html = this.baseTemplate('Reembolso Automático', `
          <h2 style="color:#fff;margin:0 0 8px;">El artista no confirmó tu reserva</h2>
          <p style="color:#38BACC;margin:0 0 24px;font-size:14px;">Hola, <strong>${this.escapeHtml(data.userName)}</strong></p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1d22;border-radius:12px;padding:20px;margin-bottom:24px;">
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Evento</td><td style="padding:8px 0;text-align:right;color:#fff;">${this.escapeHtml(data.eventName)}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Artista</td><td style="padding:8px 0;text-align:right;color:#fff;">${this.escapeHtml(data.artistName)}</td></tr>
            <tr><td colspan="2"><div style="border-top:1px solid #2a2d35;margin:8px 0;"></div></td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Reembolso</td><td style="padding:8px 0;text-align:right;color:#38BACC;font-weight:800;font-size:18px;">$${data.amount.toFixed(2)}</td></tr>
          </table>

          <p style="font-size:13px;color:#888;line-height:1.6;">
            Dado que el artista <strong style="color:#fff;">${this.escapeHtml(data.artistName)}</strong> no confirmó la reserva antes de la fecha del evento, hemos procesado un reembolso completo automáticamente. El dinero se reflejará en tu cuenta en 5 a 10 días hábiles.
          </p>
        `);
        await tx.sendMail({ from: this.getFromAddress(), to, subject, html });
        Logger.info(`Artist no-sign refund email sent to ${to}`);
    }

    static async sendWithdrawalRequestNotification(artistName: string, amount: number, bankDetails: any): Promise<void> {
        const env = getEnv();
        const adminEmail = env.ADMIN_EMAIL || env.SMTP_USER;
        if (!adminEmail) return;
        const tx = this.getTransporter();
        const html = `<p>Artista: ${artistName}, Monto: $${amount}, Datos bancarios: ${JSON.stringify(bankDetails)}</p>`;
        await tx.sendMail({ from: `StageGo Billing <${env.SMTP_USER}>`, to: adminEmail, subject: `⚠️ Nueva Solicitud de Retiro: ${artistName}`, html });
        Logger.info(`Withdrawal notification sent to admin`);
    }

    /**
     * Compatibility wrapper for simple notification (legacy/simplified call)
     */
    static async sendSimpleContractNotification(to: string, details: { contractId: string; clientName: string; eventName: string; amount: number }): Promise<void> {
        const tx = this.getTransporter();
        const subject = `🎤 Nueva solicitud de contrato — ${details.eventName}`;
        const html = this.baseTemplate('Nueva Solicitud', `
          <h2 style="color:#fff;margin:0 0 16px;">Tienes una nueva solicitud de contrato</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1d22;border-radius:12px;padding:20px;margin-bottom:24px;">
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Evento</td><td style="padding:8px 0;text-align:right;color:#fff;font-weight:600;">${this.escapeHtml(details.eventName)}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Cliente</td><td style="padding:8px 0;text-align:right;color:#fff;">${this.escapeHtml(details.clientName)}</td></tr>
            <tr><td colspan="2"><div style="border-top:1px solid #2a2d35;margin:8px 0;"></div></td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px;">Monto</td><td style="padding:8px 0;text-align:right;color:#38BACC;font-weight:800;font-size:18px;">$${details.amount.toFixed(2)}</td></tr>
          </table>
          <p style="font-size:13px;color:#888;">Ingresa a la plataforma para revisar los detalles y firmar o rechazar la reserva.</p>
        `);
        await tx.sendMail({ from: this.getFromAddress(), to, subject, html });
    }
}
