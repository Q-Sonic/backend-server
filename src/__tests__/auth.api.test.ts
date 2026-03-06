import request from 'supertest';
import * as firebaseConfig from '../config/firebase';
import { UserRoleEnum } from '../enum/roles.enum';

// Mock global fetch for REST API calls
global.fetch = jest.fn();

// Step 1: Define mocks with 'mock' prefix so Jest hoisting doesn't break them
const mockAuthObject = {
    verifyIdToken: jest.fn(),
    createUser: jest.fn(),
    setCustomUserClaims: jest.fn(),
};

const mockDbObject = {
    collection: jest.fn(() => ({
        doc: jest.fn(() => ({
            set: jest.fn(() => Promise.resolve()),
            get: jest.fn(() => Promise.resolve({ exists: true, data: () => ({}) })),
        })),
        orderBy: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({ docs: [] })),
        })),
    })),
};

const mockStorageObject = {
    bucket: jest.fn(() => ({
        file: jest.fn(() => ({
            save: jest.fn(() => Promise.resolve()),
            delete: jest.fn(() => Promise.resolve()),
            getSignedUrl: jest.fn(() => Promise.resolve(['http://signed-url'])),
        })),
    })),
};

// Step 2: Mock Firebase globally for this test
jest.mock('../config/firebase', () => ({
    initFirebase: jest.fn(),
    getAuth: jest.fn(() => mockAuthObject),
    getFirestore: jest.fn(() => mockDbObject),
    getStorage: jest.fn(() => mockStorageObject),
    admin: {
        auth: jest.fn(() => mockAuthObject),
        firestore: {
            Timestamp: {
                now: jest.fn(() => ({ toDate: () => new Date() })),
            },
        },
    },
}));

// Import app AFTER mocking firebase
import app from '../app';

describe('Auth API — Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/health', () => {
        it('should return 200 and success true', async () => {
            const response = await request(app).get('/api/health');
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/auth/register', () => {
        it('should fail with 400 if required fields are missing', async () => {
            const response = await request(app).post('/api/auth/register').send({
                email: 'missing@fields.com',
            });
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should return 201 and tokens if registration is successful', async () => {
            mockAuthObject.createUser.mockResolvedValue({ uid: 'test-uid' });

            // Mock successful fetch for login
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    idToken: 'test-id-token',
                    refreshToken: 'test-refresh-token',
                    expiresIn: '3600',
                    localId: 'test-uid'
                })
            });

            const response = await request(app).post('/api/auth/register').send({
                email: 'test@example.com',
                password: 'password123',
                displayName: 'Test User',
                role: UserRoleEnum.CLIENTE,
            });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.user.email).toBe('test@example.com');
            expect(response.body.data.idToken).toBe('test-id-token');
            expect(mockAuthObject.createUser).toHaveBeenCalled();
        });
    });
});
