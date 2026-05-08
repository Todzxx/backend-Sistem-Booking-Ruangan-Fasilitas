const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('uuid', () => ({ v4: () => 'mocked-uuid' }));

const mockPrisma = {
  booking: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  facility: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  $transaction: jest.fn(),
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

describe('GET /api/v1/bookings/check', () => {
  it('should return available when no overlap', async () => {
    mockPrisma.booking.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/bookings/check')
      .query({ facilityId: 'f-1', startTime: '2026-06-01T10:00:00Z', endTime: '2026-06-01T12:00:00Z' })
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(true);
  });

  it('should return booked when overlap exists', async () => {
    mockPrisma.booking.findFirst.mockResolvedValue({ id: 'b-1' });

    const res = await request(app)
      .get('/api/v1/bookings/check')
      .query({ facilityId: 'f-1', startTime: '2026-06-01T10:00:00Z', endTime: '2026-06-01T12:00:00Z' })
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(false);
  });
});

describe('POST /api/v1/bookings', () => {
  it('should create a booking', async () => {
    const mockTx = {
      facility: { findUnique: jest.fn().mockResolvedValue({ id: 'f-1', isActive: true }) },
      booking: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'b-1', ...data, facility: { id: 'f-1', name: 'Room A' },
        })),
      },
    };
    mockPrisma.$transaction.mockImplementation((cb) => cb(mockTx));

    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ facilityId: 'f-1', startTime: '2026-06-10T10:00:00Z', endTime: '2026-06-10T12:00:00Z', purpose: 'Team meeting' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
  });

  it('should return 400 for invalid input', async () => {
    const res = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ facilityId: 'f-1', purpose: 'AB' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/bookings/my', () => {
  it('should return paginated user bookings', async () => {
    mockPrisma.booking.findMany.mockResolvedValue([{ id: 'b-1', startTime: new Date(), facility: { name: 'Room A' } }]);
    mockPrisma.booking.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/bookings/my')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pagination).toBeDefined();
  });
});

describe('GET /api/v1/bookings', () => {
  it('should return all bookings for admin', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    mockPrisma.booking.findMany.mockResolvedValue([]);
    mockPrisma.booking.count.mockResolvedValue(0);

    const res = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pagination).toBeDefined();
  });

  it('should return 403 for non-admin', async () => {
    const res = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/v1/bookings/:id/status', () => {
  it('should update booking status', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });
    mockPrisma.booking.findUnique.mockResolvedValue({ id: 'b-1', status: 'PENDING' });
    mockPrisma.booking.update.mockResolvedValue({ id: 'b-1', status: 'APPROVED' });

    const res = await request(app)
      .patch('/api/v1/bookings/b-1/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('PATCH /api/v1/bookings/:id/cancel', () => {
  it('should cancel own booking', async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({ id: 'b-1', userId: 'user-1', status: 'PENDING', recurrenceGroupId: null });
    mockPrisma.booking.update.mockResolvedValue({ id: 'b-1', status: 'CANCELLED' });

    const res = await request(app)
      .patch('/api/v1/bookings/b-1/cancel')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  it('should return 403 when cancelling others booking', async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({ id: 'b-1', userId: 'user-2', status: 'PENDING' });

    const res = await request(app)
      .patch('/api/v1/bookings/b-1/cancel')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});
