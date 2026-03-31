/** Código de verificación por correo antes de cambiar email/contraseña. */
export const ACCOUNT_CHANGE_CODE_LENGTH = 6;

/** Minutos hasta que expire el código enviado. */
export const ACCOUNT_CHANGE_CODE_TTL_MINUTES = 15;

/** Tras verificar el código, ventana para aplicar cambios (minutos). */
export const ACCOUNT_CHANGE_SESSION_TTL_MINUTES = 20;

/** Segundos mínimos entre un envío y el siguiente. */
export const ACCOUNT_CHANGE_RESEND_COOLDOWN_SECONDS = 60;
