import { getAuth, getFirestore, admin } from '../../config/firebase';
import {
  UserRecord,
  UserRole,
  LoginResponse,
  RegisterResponse,
  GoogleLoginResponse,
  EmailVerificationRecord,
  PasswordResetRecord,
  IdentityDocumentType,
} from '../../types';
import { getEnv } from '../../config/env';
import { UserRoleEnum } from '../../enum/roles.enum';
import { VERIFICATION_CODE_EXPIRY_HOURS, VERIFICATION_CODE_LENGTH } from '../../config/verification.config';
import {
  ACCOUNT_CHANGE_CODE_LENGTH,
  ACCOUNT_CHANGE_CODE_TTL_MINUTES,
  ACCOUNT_CHANGE_SESSION_TTL_MINUTES,
  ACCOUNT_CHANGE_RESEND_COOLDOWN_SECONDS,
} from '../../config/account-change.config';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';
import { Logger } from '../../utils/logger.util';

const ACCOUNT_CHANGE_CHALLENGES = 'accountChangeChallenges';

interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  identificationType?: IdentityDocumentType;
  identificationNumber?: string;
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

  private normalizeIdentificationNumber(type: IdentityDocumentType, value: string): string {
    const trimmed = value.trim();
    if (type === 'pasaporte') {
      return trimmed.toUpperCase().replace(/\s+/g, '');
    }
    return trimmed.replace(/\D/g, '');
  }

  async register(input: RegisterInput): Promise<RegisterResponse> {
    const hasIdentificationType = !!input.identificationType;
    const hasIdentificationNumber = !!input.identificationNumber;
    if (hasIdentificationType !== hasIdentificationNumber) {
      throw new Error('identificationType e identificationNumber deben enviarse juntos');
    }

    const normalizedIdentificationNumber =
      input.identificationType && input.identificationNumber
        ? this.normalizeIdentificationNumber(input.identificationType, input.identificationNumber)
        : undefined;

    let firebaseUser;
    try {
      firebaseUser = await this.auth.createUser({
        email: input.email,
        password: input.password,
        displayName: input.displayName,
      });
    } catch (error: any) {
      if (error.code === 'auth/email-already-exists') {
        throw new Error('Ese correo electrónico ya está en uso por otra cuenta.');
      }
      if (error.code === 'auth/invalid-password') {
        throw new Error('La contraseña no es válida. Debe tener al menos 6 caracteres.');
      }
      throw error;
    }

    await this.auth.setCustomUserClaims(firebaseUser.uid, { role: input.role });

    const now = admin.firestore.Timestamp.now();
    const userRecord: UserRecord = {
      uid: firebaseUser.uid,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      identificationType: input.identificationType,
      identificationNumber: normalizedIdentificationNumber,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.collection('users').doc(firebaseUser.uid).set(userRecord);
    Logger.success(`User registered: ${input.email} [UID: ${firebaseUser.uid}]`);

    // Use MailService static methods
    MailService.sendWelcomeEmail(input.email, input.displayName).catch(err => 
      Logger.error(`Error enviando correo de bienvenida a ${input.email}: ${err.message}`)
    );

    const verification = await this.generateEmailVerificationCode(firebaseUser.uid, input.email);
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
    if (!doc.exists) throw new Error(`User ${uid} not found`);
    return doc.data() as UserRecord;
  }

  private hasEmailPasswordProvider(authUser: admin.auth.UserRecord): boolean {
    return authUser.providerData.some((p) => p.providerId === 'password');
  }

  private hashAccountChangeCode(uid: string, code: string): string {
    const secret = getEnv().ACCOUNT_CHANGE_CODE_SECRET?.trim();
    if (!secret || secret.length < 16) {
      throw new Error('ACCOUNT_CHANGE_CODE_SECRET en .env debe tener al menos 16 caracteres.');
    }
    return crypto.createHmac('sha256', secret).update(`${uid}:${code.trim()}`).digest('hex');
  }

  private challengesRef(uid: string) {
    return this.db.collection(ACCOUNT_CHANGE_CHALLENGES).doc(uid);
  }

  async requestAccountChangeCode(uid: string): Promise<void> {
    const user = await this.getUserById(uid);
    const to = user.email?.trim();
    if (!to) throw new Error('No hay correo en la cuenta para enviar el código.');

    const ref = this.challengesRef(uid);
    const snap = await ref.get();
    const nowMs = Date.now();
    if (snap.exists) {
      const lastSent = snap.data()?.lastSentAt as admin.firestore.Timestamp | undefined;
      if (lastSent && nowMs - lastSent.toMillis() < ACCOUNT_CHANGE_RESEND_COOLDOWN_SECONDS * 1000) {
        throw new Error(`Espera ${ACCOUNT_CHANGE_RESEND_COOLDOWN_SECONDS} segundos antes de pedir otro código.`);
      }
    }

    const code = crypto
      .randomInt(0, Math.pow(10, ACCOUNT_CHANGE_CODE_LENGTH))
      .toString()
      .padStart(ACCOUNT_CHANGE_CODE_LENGTH, '0');
    const codeHash = this.hashAccountChangeCode(uid, code);
    const codeExpiresAt = admin.firestore.Timestamp.fromMillis(nowMs + ACCOUNT_CHANGE_CODE_TTL_MINUTES * 60 * 1000);

    await ref.set({
      codeHash,
      codeExpiresAt,
      lastSentAt: admin.firestore.Timestamp.now(),
      sessionValidUntil: admin.firestore.FieldValue.delete(),
    }, { merge: true });

    await MailService.sendAccountChangeVerificationCode(to, code, user.displayName?.trim() || '');
  }

  async verifyAccountChangeCode(uid: string, code: string): Promise<void> {
    const ref = this.challengesRef(uid);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('No hay código pendiente. Solicita uno nuevo.');
    
    const d = snap.data() as { codeHash?: string; codeExpiresAt?: admin.firestore.Timestamp };
    if (!d.codeHash || !d.codeExpiresAt) throw new Error('No hay código pendiente o ya fue verificado.');
    
    if (d.codeExpiresAt.toMillis() < Date.now()) {
      await ref.delete().catch(() => undefined);
      throw new Error('El código expiró. Solicita uno nuevo.');
    }
    
    if (d.codeHash !== this.hashAccountChangeCode(uid, code)) throw new Error('Código incorrecto.');

    const sessionValidUntil = admin.firestore.Timestamp.fromMillis(Date.now() + ACCOUNT_CHANGE_SESSION_TTL_MINUTES * 60 * 1000);
    await ref.update({
      codeHash: admin.firestore.FieldValue.delete(),
      codeExpiresAt: admin.firestore.FieldValue.delete(),
      sessionValidUntil,
    });
  }

  async getAccountChangeStatus(uid: string): Promise<{ verified: boolean; pendingCode: boolean; validUntil: string | null }> {
    const ref = this.challengesRef(uid);
    const snap = await ref.get();
    if (!snap.exists) return { verified: false, pendingCode: false, validUntil: null };
    
    const d = snap.data() as { codeHash?: string; codeExpiresAt?: admin.firestore.Timestamp; sessionValidUntil?: admin.firestore.Timestamp };
    if (d.sessionValidUntil && d.sessionValidUntil.toMillis() > Date.now()) {
      return { verified: true, pendingCode: !!d.codeHash, validUntil: d.sessionValidUntil.toDate().toISOString() };
    }
    return { verified: false, pendingCode: false, validUntil: null };
  }

  async changePasswordWithSession(uid: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
    const authUser = await this.auth.getUser(uid);
    if (!this.hasEmailPasswordProvider(authUser)) throw new Error('Cuenta de Google detectada.');
    
    await this.auth.updateUser(uid, { password: newPassword });
    await this.auth.revokeRefreshTokens(uid);
    await this.challengesRef(uid).delete().catch(() => undefined);
    Logger.success(`Password updated for uid ${uid}`);
  }

  async changeEmail(uid: string, newEmail: string): Promise<void> {
    const normalized = newEmail.trim().toLowerCase();
    if (!this.validateEmail(normalized)) throw new Error('Formato de correo inválido.');
    
    await this.auth.updateUser(uid, { email: normalized });
    await this.db.collection('users').doc(uid).update({ email: normalized, updatedAt: admin.firestore.Timestamp.now() });
    await this.challengesRef(uid).delete().catch(() => undefined);
    Logger.success(`Email updated for uid ${uid}`);
  }

  async loginWithGoogle(googleIdToken: string): Promise<GoogleLoginResponse> {
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await this.auth.verifyIdToken(googleIdToken);
    } catch {
      throw new Error('Token de Google inválido');
    }

    const { uid, email, name, picture } = decoded;
    if (!email) throw new Error('No email found in Google token');

    const now = admin.firestore.Timestamp.now();
    const userRef = this.db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    let userRecord: UserRecord;
    let isNewUser = false;

    if (userDoc.exists) {
      const existing = userDoc.data() as UserRecord;
      const updates: Partial<UserRecord> = { updatedAt: now };
      if (name && name !== existing.displayName) updates.displayName = name;
      if (picture && picture !== existing.photoURL) updates.photoURL = picture;
      await userRef.update(updates);
      userRecord = { ...existing, ...updates };
    } else {
      isNewUser = true;
      const role: UserRole = UserRoleEnum.CLIENTE;
      userRecord = { uid, email, displayName: name ?? email.split('@')[0], role, photoURL: picture ?? undefined, emailVerified: true, createdAt: now, updatedAt: now };
      await userRef.set(userRecord);
      await this.auth.setCustomUserClaims(uid, { role });
    }

    const customToken = await this.auth.createCustomToken(uid, { role: userRecord.role });
    return { customToken, uid, role: userRecord.role, isNewUser, user: userRecord };
  }

  async generateEmailVerificationCode(uid: string, email: string): Promise<EmailVerificationRecord> {
    const code = crypto.randomInt(0, Math.pow(10, VERIFICATION_CODE_LENGTH)).toString().padStart(VERIFICATION_CODE_LENGTH, '0');
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + VERIFICATION_CODE_EXPIRY_HOURS * 60 * 60 * 1000));
    const verificationRecord: EmailVerificationRecord = { uid, email, code, expiresAt, verified: false, createdAt: now };
    await this.db.collection('emailVerifications').doc(uid).set(verificationRecord);
    return verificationRecord;
  }

  async forgotPassword(email: string): Promise<PasswordResetRecord> {
    try {
      await this.auth.getUserByEmail(email);
    } catch {
      throw new Error('Cuenta no encontrada');
    }

    const code = crypto.randomInt(0, Math.pow(10, VERIFICATION_CODE_LENGTH)).toString().padStart(VERIFICATION_CODE_LENGTH, '0');
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + VERIFICATION_CODE_EXPIRY_HOURS * 60 * 60 * 1000));
    const resetRecord: PasswordResetRecord = { email, code, expiresAt, verified: false, createdAt: now };
    await this.db.collection('passwordResets').doc(email).set(resetRecord);
    
    MailService.sendPasswordResetEmail(email, code, email.split('@')[0]).catch(err => 
      Logger.error(`Error enviando correo de recuperación: ${err.message}`)
    );

    return resetRecord;
  }

  async verifyResetCode(email: string, code: string): Promise<boolean> {
    const doc = await this.db.collection('passwordResets').doc(email).get();
    if (!doc.exists) throw new Error('Solicitud no encontrada');
    const data = doc.data() as PasswordResetRecord;
    if (data.code !== code) throw new Error('Código incorrecto');
    if (data.expiresAt.toDate() < new Date()) throw new Error('Código expirado');
    await this.db.collection('passwordResets').doc(email).update({ verified: true });
    return true;
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const doc = await this.db.collection('passwordResets').doc(email).get();
    if (!doc.exists || !doc.data()?.verified) throw new Error('No verificado');
    const user = await this.auth.getUserByEmail(email);
    await this.auth.updateUser(user.uid, { password: newPassword });
    await this.db.collection('passwordResets').doc(email).delete();
  }
}
