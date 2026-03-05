import { getAuth, getFirestore, admin, initFirebase } from '../../config/firebase';
import { UserRecord, UserRole, LoginResponse, RegisterResponse } from '../../types';
import { getEnv } from '../../config/env';

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
      createdAt: now,
      updatedAt: now,
    };

    await this.db.collection('users').doc(firebaseUser.uid).set(userRecord);

    // 4. Hacer Login automático para obtener tokens
    const loginData = await this.login(input.email, input.password);

    return {
      ...loginData,
      user: userRecord,
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

    // Obtenemos el usuario de Firestore para extraer el rol
    const userDoc = await this.db.collection('users').doc(data.localId).get();
    const userRole = userDoc.exists ? (userDoc.data() as UserRecord).role : 'cliente';

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
}
