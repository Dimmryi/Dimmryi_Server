// Heavy external services are mocked so tests run without a real DB or cloud credentials.

jest.mock('dotenv', () => ({ config: jest.fn() }));

jest.mock('cloudinary', () => ({
    v2: { config: jest.fn(), utils: { api_sign_request: jest.fn().mockReturnValue('sig') } },
}));

// Mongoose model mocks -------------------------------------------------------

const mockListingChain = {
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
};

jest.mock('../models/ListingModel', () => ({
    __esModule: true,
    default: {
        find: jest.fn(() => mockListingChain),
        countDocuments: jest.fn().mockResolvedValue(0),
        findById: jest.fn().mockResolvedValue(null),
        findOne: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    },
}));

jest.mock('../models/UserModel', () => ({
    __esModule: true,
    default: {
        findOne: jest.fn().mockResolvedValue(null),
        findById: jest.fn().mockResolvedValue(null),
        findByIdAndUpdate: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
        prototype: { save: jest.fn() },
    },
}));

jest.mock('../models/AgentModel', () => ({
    __esModule: true,
    default: {
        find: jest.fn().mockResolvedValue([]),
        findById: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    },
}));

jest.mock('../models/CommentModel', () => ({
    __esModule: true,
    default: {
        find: jest.fn().mockResolvedValue([]),
        findById: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    },
}));

jest.mock('../models/NotificationModel', () => ({
    __esModule: true,
    default: {
        find: jest.fn().mockResolvedValue([]),
        findById: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    },
}));

jest.mock('../models/ChatModel', () => ({
    __esModule: true,
    default: {
        findById: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([]),
        findOneAndUpdate: jest.fn().mockResolvedValue(null),
        updateOne: jest.fn().mockResolvedValue({}),
    },
}));

jest.mock('../models/AdsModel', () => ({
    __esModule: true,
    default: {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    },
}));

jest.mock('../models/CounterModel', () => ({
    __esModule: true,
    default: {
        findOneAndUpdate: jest.fn().mockResolvedValue({ seq: 1 }),
    },
}));

jest.mock('../emailService', () => ({
    sendNotificationEmail: jest.fn().mockResolvedValue({}),
    sendEmail: jest.fn().mockResolvedValue({}),
}));

// ---------------------------------------------------------------------------

import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

// ---------------------------------------------------------------------------

describe('Utility endpoints', () => {
    it('GET /healthz → 200 with status ok', async () => {
        const res = await request(app).get('/healthz');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    it('GET /api/test → 200 with status ok', async () => {
        const res = await request(app).get('/api/test');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body).toHaveProperty('timestamp');
    });

    it('GET /version → 200 with version field', async () => {
        const res = await request(app).get('/version');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('version');
        expect(res.body).toHaveProperty('timestamp');
    });
});

// ---------------------------------------------------------------------------

describe('Listing endpoints', () => {
    it('GET /listings → 200 with array of all listings', async () => {
        const res = await request(app).get('/listings');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

// ---------------------------------------------------------------------------

describe('Agent endpoints', () => {
    it('GET /agents → 200, returns array', async () => {
        const res = await request(app).get('/agents');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

// ---------------------------------------------------------------------------

describe('Comment endpoints', () => {
    it('GET /comments → 200, returns array', async () => {
        const res = await request(app).get('/comments');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

// ---------------------------------------------------------------------------

describe('Notification endpoints', () => {
    it('GET /api/notifications → 401 without auth (admin-only)', async () => {
        const res = await request(app).get('/api/notifications');
        expect(res.status).toBe(401);
    });
});

// ---------------------------------------------------------------------------

describe('Ads endpoints', () => {
    it('GET /api/videos → 200, returns array', async () => {
        const res = await request(app).get('/api/videos');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/video → 200', async () => {
        const res = await request(app).get('/api/video');
        expect(res.status).toBe(200);
    });
});

// ---------------------------------------------------------------------------

describe('Auth endpoints', () => {
    it('GET /session → 401 when no session is active', async () => {
        const res = await request(app).get('/session');
        expect(res.status).toBe(401);
    });

    it('POST /login with unknown email → 401', async () => {
        const res = await request(app)
            .post('/login')
            .send({ email: 'nobody@example.com', password: 'pass', authMethod: 'password' });
        expect(res.status).toBe(401);
    });

    it('POST /login with missing body → 401', async () => {
        const res = await request(app).post('/login').send({});
        expect(res.status).toBe(401);
    });

    it('POST /logout → 200', async () => {
        const res = await request(app).post('/logout');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Logged out');
    });

    it('POST /api/auth/forgot-password without email → 400', async () => {
        const res = await request(app).post('/api/auth/forgot-password').send({});
        expect(res.status).toBe(400);
    });

    it('POST /api/auth/forgot-password with unknown email → 200 (no email enumeration)', async () => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: 'nobody@example.com' });
        expect(res.status).toBe(200);
        expect(res.body.message).toContain('reset link');
    });

    it('GET /api/auth/reset-password/validate without token → 400', async () => {
        const res = await request(app).get('/api/auth/reset-password/validate');
        expect(res.status).toBe(400);
    });
});

// ---------------------------------------------------------------------------

describe('Chat endpoints', () => {
    it('POST /api/chat/init with missing fields → 400', async () => {
        const res = await request(app).post('/api/chat/init').send({});
        expect(res.status).toBe(400);
    });

    it('GET /api/chat/:chatId with non-existent id → 404', async () => {
        const res = await request(app).get('/api/chat/000000000000000000000000');
        expect(res.status).toBe(404);
    });
});
