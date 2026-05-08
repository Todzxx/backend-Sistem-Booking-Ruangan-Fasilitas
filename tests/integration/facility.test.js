const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('uuid', () => ({ v4: () => 'mocked-uuid' }));

const mockPrisma = {
  facility: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
  user: { findUnique: jest.fn() },
};

jest.mock('../../src/config/prisma', () => mockPrisma);

const userToken = jwt.sign({ id: 'user-1', role: 'USER' }, process.env.JWT_SECRET, { expiresIn: '1d' });
const adminToken = jwt.sign({ id: 'admin-1', role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: '1d' });
let app;

beforeAll(() => {
  app = require('../../src/app');
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: 'USER' });
});

describe('GET /api/v1/facilities', () => {
  it('should return paginated facilities', async () => {
    mockPrisma.facility.findMany.mockResolvedValue([{ id: 'f-1', name: 'Room A', capacity: 10, isActive: true }]);
    mockPrisma.facility.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/facilities')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.data).toHaveLength(1);
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.total).toBe(1);
  });

  it('should return 401 without token', async () => {
    const res = await request(app).get('/api/v1/facilities');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/facilities', () => {
  it('should create facility as admin', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    mockPrisma.facility.create.mockResolvedValue({ id: 'f-1', name: 'New Room', capacity: 20, isActive: true });

    const res = await request(app)
      .post('/api/v1/facilities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Room', capacity: 20 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
  });

  it('should reject creation as regular user', async () => {
    const res = await request(app)
      .post('/api/v1/facilities')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'New Room', capacity: 20 });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/facilities/:id', () => {
  it('should return facility by id', async () => {
    mockPrisma.facility.findUnique.mockResolvedValue({ id: 'f-1', name: 'Room A', capacity: 10, isActive: true });

    const res = await request(app)
      .get('/api/v1/facilities/f-1')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Room A');
  });

  it('should return 404 for inactive facility', async () => {
    mockPrisma.facility.findUnique.mockResolvedValue({ id: 'f-1', isActive: false });

    const res = await request(app)
      .get('/api/v1/facilities/f-1')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });
});
