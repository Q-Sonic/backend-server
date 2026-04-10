import { getAuth, getFirestore, admin, initFirebase } from '../../config/firebase';
import { UserRecord, UserRole, LoginResponse, RegisterResponse, GoogleLoginResponse, EmailVerificationRecord, PasswordResetRecord } from '../../types';
import { getEnv } from '../../config/env';
import { UserRoleEnum } from '../../enum/roles.enum';
import { VERIFICATION_CODE_EXPIRY_HOURS, VERIFICATION_CODE_LENGTH } from '../../config/verification.config';
import {
  ACCOUNT_CHANGE_CODE_LENGTH,
  ACCOUNT_CHANGE_CODE_TTL_MINUTES,
  ACCOUNT_CHANGE_SESSION_TTL_MINUTES,
  ACCOUNT_CHANGE_RESEND_COOLDOWN_SECONDS,
} from '../../config/account-change.config';
import { sendAccountChangeVerificationCode, isSmtpConfigured } from '../mail/mail.service';
import * as crypto from 'crypto';
import { Logger } from '../../utils/logger.util';

const ACCOUNT_CHANGE_CHALLENGES = 'accountChangeChallenges';

interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}

export class AuthService {
  private db: admin.firestore.Firestore;
  private auth: admin.auth.Auth;

  constructor() {
    this.db = getFirestore();
    this.auth = getAuth();
  }

  private validateEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  async register(input: RegisterInput): Promise<RegisterResponse> {
    if (!this.validateEmail(input.email)) {
      throw new Error('Formato de email inválido');
    }

    // 1. Crea el usuario en Firebase Auth
    const firebaseUser = await this.auth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
    });

    // 2. Asigna el rol mediante Firebase Custom Claims
    await this.auth.setCustomUserClaims(firebaseUser.uid, { role: input.role });

    // 3. Guarda el perfil y el rol en Firestore
    const now = admin.firestore.Timestamp.now();
    const userRecord: UserRecord = {
      uid: firebaseUser.uid,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.collection('users').doc(firebaseUser.uid).set(userRecord);
    Logger.success(`User registered: ${input.email} [UID: ${firebaseUser.uid}]`);

    // 4. Generar código de verificación
    const verification = await this.generateEmailVerificationCode(firebaseUser.uid, input.email);

    // 5. Hacer Login automático para obtener tokens
    const loginData = await this.login(input.email, input.password);

    const isDev = getEnv().NODE_ENV !== 'production';

    return {
      ...loginData,
      user: userRecord,
      verification: {
        code: isDev ? verification.code : undefined,
        expiresAt: verification.expiresAt.toDate(),
        message: isDev 
          ? 'DEV MODE: El código se devuelve aquí hasta que el email esté configurado'
          : 'Se ha enviado un código de verificación a su correo electrónico',
      }
    };
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const apiKey = getEnv().FIREBASE_WEB_API_KEY;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const data = (await response.json()) as any;

    if (!response.ok) {
      const errorMsg = data.error?.message || 'Login failed';
      Logger.error(`Login failed for ${email}: ${errorMsg}`);
      throw new Error(`Credenciales inválidas: ${errorMsg}`);
    }

    Logger.auth(`Login successful for ${email}`);

    // Rol desde Firestore (fuente de verdad). El JWT no incluye custom claims hasta el próximo login/refresh.
    const userDoc = await this.db.collection('users').doc(data.localId).get();
    const userRole = userDoc.exists ? (userDoc.data() as { role?: string })?.role as UserRole : UserRoleEnum.CLIENTE;

    return {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
      uid: data.localId,
      role: userRole,
    };
  }

  async getUserById(uid: string): Promise<UserRecord> {
    const doc = await this.db.collection('users').doc(uid).get();

    if (!doc.exists) {
      throw new Error(`User ${uid} not found`);
    }

    return doc.data() as UserRecord;
  }

  private hasEmailPasswordProvider(authUser: admin.auth.UserRecord): boolean {
    return authUser.providerData.some((p) => p.providerId === 'password');
  }

  private hashAccountChangeCode(uid: string, code: string): string {
    const secret = getEnv().ACCOUNT_CHANGE_CODE_SECRET?.trim();
    console.log(secret);
    if (!secret || secret.length < 16) {
      throw new Error('ACCOUNT_CHANGE_CODE_SECRET en .env debe tener al menos 16 caracteres.');
    }
    return crypto.createHmac('sha256', secret).update(`${uid}:${code.trim()}`).digest('hex');
  }

  private challengesRef(uid: string) {
    return this.db.collection(ACCOUNT_CHANGE_CHALLENGES).doc(uid);
  }

  async requestAccountChangeCode(uid: string): Promise<void> {
    if (!isSmtpConfigured()) {
      throw new Error('El envío de correo no está configurado (SMTP_USER / SMTP_PASS en el servidor).');
    }
    const user = await this.getUserById(uid);
    // const to = user.email?.trim();
    const to = "gownerbeats@gmail.com";
    if (!to) {
      throw new Error('No hay correo en la cuenta para enviar el código.');
    }

    const ref = this.challengesRef(uid);
    const snap = await ref.get();
    const nowMs = Date.now();
    if (snap.exists) {
      const lastSent = snap.data()?.lastSentAt as admin.firestore.Timestamp | undefined;
      if (lastSent && nowMs - lastSent.toMillis() < ACCOUNT_CHANGE_RESEND_COOLDOWN_SECONDS * 1000) {
        throw new Error(
          `Espera ${ACCOUNT_CHANGE_RESEND_COOLDOWN_SECONDS} segundos antes de pedir otro código.`
        );
      }
    }

    const code = crypto
      .randomInt(0, Math.pow(10, ACCOUNT_CHANGE_CODE_LENGTH))
      .toString()
      .padStart(ACCOUNT_CHANGE_CODE_LENGTH, '0');
    const codeHash = this.hashAccountChangeCode(uid, code);
    const codeExpiresAt = admin.firestore.Timestamp.fromMillis(
      nowMs + ACCOUNT_CHANGE_CODE_TTL_MINUTES * 60 * 1000
    );

    await ref.set(
      {
        codeHash,
        codeExpiresAt,
        lastSentAt: admin.firestore.Timestamp.now(),
        sessionValidUntil: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );

    await sendAccountChangeVerificationCode(
      to,
      code,
      user.displayName?.trim() || ''
    );
  }

  async verifyAccountChangeCode(uid: string, code: string): Promise<void> {
    const ref = this.challengesRef(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error('No hay código pendiente. Solicita uno nuevo.');
    }
    const d = snap.data() as {
      codeHash?: string;
      codeExpiresAt?: admin.firestore.Timestamp;
    };
    if (!d.codeHash || !d.codeExpiresAt) {
      throw new Error('No hay código pendiente o ya fue verificado.');
    }
    if (d.codeExpiresAt.toMillis() < Date.now()) {
      await ref.delete().catch(() => undefined);
      throw new Error('El código expiró. Solicita uno nuevo.');
    }
    if (d.codeHash !== this.hashAccountChangeCode(uid, code)) {
      throw new Error('Código incorrecto.');
    }

    const sessionValidUntil = admin.firestore.Timestamp.fromMillis(
      Date.now() + ACCOUNT_CHANGE_SESSION_TTL_MINUTES * 60 * 1000
    );
    await ref.update({
      codeHash: admin.firestore.FieldValue.delete(),
      codeExpiresAt: admin.firestore.FieldValue.delete(),
      sessionValidUntil,
    });
  }

  async getAccountChangeStatus(uid: string): Promise<{
    verified: boolean;
    pendingCode: boolean;
    validUntil: string | null;
  }> {
    const ref = this.challengesRef(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return { verified: false, pendingCode: false, validUntil: null };
    }
    const d = snap.data() as {
      codeHash?: string;
      codeExpiresAt?: admin.firestore.Timestamp;
      sessionValidUntil?: admin.firestore.Timestamp;
    };

    if (d.sessionValidUntil && d.sessionValidUntil.toMillis() > Date.now()) {
      return {
        verified: true,
        pendingCode: !!d.codeHash,
        validUntil: d.sessionValidUntil.toDate().toISOString(),
      };
    }

    if (d.codeHash && d.codeExpiresAt) {
      if (d.codeExpiresAt.toMillis() < Date.now()) {
        await ref.delete().catch(() => undefined);
        return { verified: false, pendingCode: false, validUntil: null };
      }
      return { verified: false, pendingCode: true, validUntil: null };
    }

    if (d.sessionValidUntil) {
      await ref.delete().catch(() => undefined);
    }
    return { verified: false, pendingCode: false, validUntil: null };
  }

  private async assertAccountChangeVerified(uid: string): Promise<void> {
    const ref = this.challengesRef(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error('Primero verifica el código enviado a tu correo.');
    }
    const su = (snap.data() as { sessionValidUntil?: admin.firestore.Timestamp })?.sessionValidUntil;
    if (!su || su.toMillis() <= Date.now()) {
      throw new Error('La verificación expiró. Solicita un nuevo código e inténtalo de nuevo.');
    }
  }

  private async clearAccountChangeChallenge(uid: string): Promise<void> {
    await this.challengesRef(uid).delete().catch(() => undefined);
  }

  /**
   * Cambia la contraseña tras verificación por correo. Exige proveedor email/contraseña.
   */
  async changePasswordWithSession(uid: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
    }
    const authUser = await this.auth.getUser(uid);
    if (!this.hasEmailPasswordProvider(authUser)) {
      throw new Error(
        'Esta cuenta usa inicio de sesión con Google. Cambia la contraseña desde tu cuenta de Google o contacta soporte.'
      );
    }
    await this.assertAccountChangeVerified(uid);
    await this.auth.updateUser(uid, { password: newPassword });
    await this.auth.revokeRefreshTokens(uid);
    await this.clearAccountChangeChallenge(uid);
    Logger.success(`Password updated for uid ${uid} (refresh tokens revoked)`);
  }

  async changeEmail(uid: string, newEmail: string): Promise<void> {
    const normalized = newEmail.trim().toLowerCase();
    if (!this.validateEmail(normalized)) {
      throw new Error('Formato de correo inválido.');
    }
    await this.assertAccountChangeVerified(uid);

    try {
      await this.auth.updateUser(uid, { email: normalized });
    } catch (e: unknown) {
      const code =
        e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : '';
      if (code === 'auth/email-already-exists') {
        throw new Error('Ese correo ya está en uso por otra cuenta.');
      }
      throw e instanceof Error ? e : new Error('No se pudo actualizar el correo.');
    }

    await this.db.collection('users').doc(uid).update({
      email: normalized,
      updatedAt: admin.firestore.Timestamp.now(),
    });
    await this.clearAccountChangeChallenge(uid);
    Logger.success(`Email updated for uid ${uid}`);
  }

  /**
   * Login/Registro con Google OAuth.
   * Proceso lógico:
   * 1. Se valida el token que el cliente obtuvo del SDK de Google.
   * 2. Si el token es válido, extraemos uid y email.
   * 3. Verificamos si el usuario ya existe en Firestore.
   * 4. Si es nuevo, creamos el registro con rol 'cliente' por defecto.
   * 5. Si ya existe, actualizamos su información de perfil (foto, nombre).
   * 6. Generamos un Custom Token de Firebase. Este token es el que el cliente usará
   *    para autenticarse con el SDK de Firebase (signInWithCustomToken) y recibir
   *    automáticamente sus Custom Claims (roles).
   */
  async loginWithGoogle(googleIdToken: string): Promise<GoogleLoginResponse> {
    // 1. Verificar el idToken de Google con Firebase Admin (Autenticidad del origen)
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await this.auth.verifyIdToken(googleIdToken);
    } catch {
      throw new Error('Token de Google inválido o expirado');
    }

    const { uid, email, name, picture } = decoded;

    if (!email) {
      throw new Error('No se pudo obtener el email de la cuenta de Google');
    }

    const now = admin.firestore.Timestamp.now();
    const userRef = this.db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    let userRecord: UserRecord;
    let isNewUser = false;

    // Lógica de Sincronización: Siempre mantenemos Firestore al día con los datos de Google
    if (userDoc.exists) {
      // Usuario existente → actualizamos displayName y photo si cambiaron en su cuenta de Google
      const existing = userDoc.data() as UserRecord;
      const updates: Partial<UserRecord> = { updatedAt: now };
      if (name && name !== existing.displayName) updates.displayName = name;
      if (picture && picture !== existing.photoURL) updates.photoURL = picture;

      await userRef.update(updates);
      userRecord = { ...existing, ...updates };
    } else {
      // Nuevo usuario → creamos el registro inicial. El rol por defecto es CLIENTE.
      // Si el usuario quisiera ser ARTISTA, debería pasar por un flujo de upgrade posterior.
      isNewUser = true;
      const role: UserRole = UserRoleEnum.CLIENTE;

      userRecord = {
        uid,
        email,
        displayName: name ?? email.split('@')[0],
        role,
        photoURL: picture ?? undefined,
        emailVerified: true, // Las cuentas de Google se consideran verificadas por confianza delegada
        createdAt: now,
        updatedAt: now,
      };

      await userRef.set(userRecord);

      // Sincronización con Firebase Auth: Inyectamos el ROL en los Custom Claims para seguridad en el front
      await this.auth.setCustomUserClaims(uid, { role });
    }

    // Generar Custom Token: Este token es EFÍMERO y seguro.
    // Solo sirve para que el cliente lo use UNA VEZ para recibir su sesión de Firebase.
    const customToken = await this.auth.createCustomToken(uid, {
      role: userRecord.role,
    });

    return {
      customToken,
      uid,
      role: userRecord.role,
      isNewUser,
      user: userRecord,
    };
  }

  /**
   * Genera un código de verificación de 6 dígitos para un usuario.
   */
  async generateEmailVerificationCode(uid: string, email: string): Promise<EmailVerificationRecord> {
    const code = crypto.randomInt(0, Math.pow(10, VERIFICATION_CODE_LENGTH))
      .toString()
      .padStart(VERIFICATION_CODE_LENGTH, '0');

    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + VERIFICATION_CODE_EXPIRY_HOURS * 60 * 60 * 1000)
    );

    const verificationRecord: EmailVerificationRecord = {
      uid,
      email,
      code,
      expiresAt,
      verified: false,
      createdAt: now,
    };

    await this.db.collection('emailVerifications').doc(uid).set(verificationRecord);

    return verificationRecord;
  }

  /**
   * Genera un código de 6 dígitos para recuperar contraseña.
   */
  async forgotPassword(email: string): Promise<PasswordResetRecord> {
    try {
      await this.auth.getUserByEmail(email);
    } catch (error) {
      throw new Error('No existe una cuenta asociada a este correo electrónico');
    }

    const code = crypto.randomInt(0, Math.pow(10, VERIFICATION_CODE_LENGTH))
      .toString()
      .padStart(VERIFICATION_CODE_LENGTH, '0');

    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + VERIFICATION_CODE_EXPIRY_HOURS * 60 * 60 * 1000)
    );

    const resetRecord: PasswordResetRecord = {
      email,
      code,
      expiresAt,
      verified: false,
      createdAt: now,
    };

    // Usamos el email como ID del documento para que sea único por solicitud activa
    await this.db.collection('passwordResets').doc(email).set(resetRecord);
    Logger.info(`Password reset code generated for ${email}: ${code}`);

    return resetRecord;
  }

  /**
   * Valida si un código de recuperación es correcto y no ha expirado.
   */
  async verifyResetCode(email: string, code: string): Promise<boolean> {
    const doc = await this.db.collection('passwordResets').doc(email).get();

    if (!doc.exists) {
      throw new Error('No se encontró una solicitud de recuperación para este correo');
    }

    const data = doc.data() as PasswordResetRecord;

    if (data.code !== code) {
      throw new Error('Código de verificación incorrecto');
    }

    if (data.expiresAt.toDate() < new Date()) {
      throw new Error('El código ha expirado. Solicite uno nuevo.');
    }

    // Marcamos como verificado en el sistema
    await this.db.collection('passwordResets').doc(email).update({ verified: true });

    return true;
  }

  /**
   * Cambia la contraseña del usuario después de validar el código.
   */
  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const doc = await this.db.collection('passwordResets').doc(email).get();

    if (!doc.exists) {
      throw new Error('No se encontró una solicitud de recuperación');
    }

    const data = doc.data() as PasswordResetRecord;

    if (data.code !== code) {
      throw new Error('Código inválido');
    }

    if (!data.verified) {
      throw new Error('El código no ha sido verificado');
    }

    if (data.expiresAt.toDate() < new Date()) {
      throw new Error('El código ha expirado');
    }

    const user = await this.auth.getUserByEmail(email);

    await this.auth.updateUser(user.uid, {
      password: newPassword
    });

    await this.db.collection('passwordResets').doc(email).delete();
  }
}
