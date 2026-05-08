describe('Environment Validation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should pass when all required env vars are set', () => {
    process.env.DATABASE_URL = 'mysql://test';
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    const { validateEnv } = require('../../src/utils/env');
    expect(() => validateEnv()).not.toThrow();
  });

  it('should throw when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    const { validateEnv } = require('../../src/utils/env');
    expect(() => validateEnv()).toThrow('Missing required environment variables');
  });

  it('should throw when JWT_SECRET is missing', () => {
    process.env.DATABASE_URL = 'mysql://test';
    delete process.env.JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    const { validateEnv } = require('../../src/utils/env');
    expect(() => validateEnv()).toThrow('Missing required environment variables');
  });

  it('should throw when JWT_REFRESH_SECRET is missing', () => {
    process.env.DATABASE_URL = 'mysql://test';
    process.env.JWT_SECRET = 'test-secret';
    delete process.env.JWT_REFRESH_SECRET;

    const { validateEnv } = require('../../src/utils/env');
    expect(() => validateEnv()).toThrow('Missing required environment variables');
  });
});
