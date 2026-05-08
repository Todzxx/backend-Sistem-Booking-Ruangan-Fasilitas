const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('uuid', () => ({ v4: () => 'mocked-uuid' }));

const mockPrisma = {
  user: { findUnique: jest.fn(), create: jest.fn() },
};

jest.mock('../../src/config/prisma', () => mockPrisma);

const bcrypt = require('bcryptjs');
let app;

beforeAll(() => {
  app = require('../../src/app');
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/v1/auth/register', () => {
  it('should register a new user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-1', name: 'Test User', email: 'test@example.com', role: 'USER',
      password: await bcrypt.hash('password123', 12), createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(res.body.data.name).toBe('Test User');
    expect(res.body.data.password).toBeUndefined();
  });

  it('should return 400 on duplicate email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'test@example.com' });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
  });

  it('should return 400 for invalid input', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'AB', email: 'invalid', password: '12' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('should login successfully', async () => {
    const hashedPassword = await bcrypt.hash('password123', 12);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1', name: 'Test User', email: 'test@example.com',
      password: hashedPassword, role: 'USER', createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('should return 401 for wrong password', async () => {
    const hashedPassword = await bcrypt.hash('password123', 12);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'test@example.com', password: hashedPassword,
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.status).toBe('fail');
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('should refresh token successfully', async () => {
    const validRefreshToken = jwt.sign({ id: 'user-1', role: 'USER' }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@example.com', role: 'USER' });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: validRefreshToken });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });

  it('should return 400 when refresh token is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('fail');
  });
});
