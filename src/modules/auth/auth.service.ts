import { getAuth, getFirestore, admin, initFirebase } from '../../config/firebase';
import { UserRecord, UserRole, LoginResponse, RegisterResponse, GoogleLoginResponse, EmailVerificationRecord, PasswordResetRecord } from '../../types';
import { getEnv } from '../../config/env';
import { UserRoleEnum } from '../../enum/roles.enum';
import { VERIFICATION_CODE_EXPIRY_HOURS, VERIFICATION_CODE_LENGTH } from '../../config/verification.config';
import * as crypto from 'crypto';

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
      throw new Error(`Credenciales inválidas: ${errorMsg}`);
    }

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

  /**
   * Login/Registro con Google OAuth.
   *
   * Flujo:
   *  1. El cliente obtiene un idToken de Google a través del Firebase Client SDK
   *     (signInWithPopup / signInWithRedirect con GoogleAuthProvider).
   *  2. Envía ese idToken al backend via POST /api/auth/google.
   *  3. El backend verifica el token con Firebase Admin, crea/actualiza el usuario
   *     en Firestore (role por defecto = CLIENTE si es nuevo), y devuelve
   *     un customToken firmado + datos del usuario.
   *  4. El cliente usa ese customToken para llamar a
   *     `signInWithCustomToken(auth, customToken)` y obtener un idToken de sesión.
   */
  async loginWithGoogle(googleIdToken: string): Promise<GoogleLoginResponse> {
    // 1. Verificar el idToken de Google con Firebase Admin
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

    if (userDoc.exists) {
      // Usuario existente → actualizamos displayName y photo si cambiaron
      const existing = userDoc.data() as UserRecord;
      const updates: Partial<UserRecord> = { updatedAt: now };
      if (name && name !== existing.displayName) updates.displayName = name;
      if (picture && picture !== existing.photoURL) updates.photoURL = picture;

      await userRef.update(updates);
      userRecord = { ...existing, ...updates };
    } else {
      // Nuevo usuario → crear registro con rol CLIENTE por defecto
      isNewUser = true;
      const role: UserRole = UserRoleEnum.CLIENTE;

      userRecord = {
        uid,
        email,
        displayName: name ?? email.split('@')[0],
        role,
        photoURL: picture ?? undefined,
        emailVerified: true, // Google accounts are considered verified
        createdAt: now,
        updatedAt: now,
      };

      await userRef.set(userRecord);

      // Asignar custom claim de rol en Firebase Auth
      await this.auth.setCustomUserClaims(uid, { role });
    }

    // 2. Generar un customToken firmado por el servidor
    // El cliente lo usará con signInWithCustomToken() para iniciar sesión
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
    // 1. Verificar si el usuario existe (opcional dependiendo de política de seguridad)
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

    // 1. Obtener UID por email
    const user = await this.auth.getUserByEmail(email);

    // 2. Actualizar contraseña en Firebase Auth
    await this.auth.updateUser(user.uid, {
      password: newPassword
    });

    // 3. Eliminar el registro de reset para que no se use de nuevo
    await this.db.collection('passwordResets').doc(email).delete();
  }
}
