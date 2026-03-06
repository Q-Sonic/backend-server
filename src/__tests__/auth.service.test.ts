import { AuthService } from '../modules/auth/auth.service';
import * as firebaseConfig from '../config/firebase';
import { UserRoleEnum } from '../enum/roles.enum';

// Mock the firebase config functions
jest.mock('../config/firebase', () => ({
    getAuth: jest.fn(),
    getFirestore: jest.fn(),
    admin: {
        firestore: {
            Timestamp: {
                now: jest.fn(() => ({ toDate: () => new Date() })),
            },
        },
    },
}));

describe('AuthService — Unit Tests', () => {
    let authService: AuthService;
    const mockAuth = {
        createUser: jest.fn(),
        setCustomUserClaims: jest.fn(),
    };
    const mockDb = {
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                set: jest.fn(),
                get: jest.fn(),
            })),
        })),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (firebaseConfig.getAuth as jest.Mock).mockReturnValue(mockAuth);
        (firebaseConfig.getFirestore as jest.Mock).mockReturnValue(mockDb);
        authService = new AuthService();
    });

    describe('validateEmail', () => {
        it('should return true for valid emails', () => {
            // Accessing private method for test (casting to any)
            expect((authService as any).validateEmail('test@example.com')).toBe(true);
        });

        it('should return false for invalid emails', () => {
            expect((authService as any).validateEmail('invalid-email')).toBe(false);
        });
    });

    describe('register', () => {
        const input = {
            email: 'new@user.com',
            password: 'password123',
            displayName: 'New User',
            role: UserRoleEnum.CLIENTE as const,
        };

        it('should throw an error if email is invalid', async () => {
            await expect(
                authService.register({ ...input, email: 'invalid' })
            ).rejects.toThrow('Formato de email inválido');
        });

        it('should create user and set claims and save to firestore', async () => {
            mockAuth.createUser.mockResolvedValue({ uid: 'uid123' });

            // Mock login since it's called internally
            const loginSpy = jest.spyOn(authService, 'login').mockResolvedValue({
                idToken: 'token123',
                refreshToken: 'refresh123',
                expiresIn: '3600',
                uid: 'uid123',
                role: UserRoleEnum.CLIENTE
            });

            const result = await authService.register(input);

            expect(mockAuth.createUser).toHaveBeenCalled();
            expect(loginSpy).toHaveBeenCalledWith(input.email, input.password);
            expect(result.user.uid).toBe('uid123');
            expect(result.idToken).toBe('token123');
        });
    });
});
