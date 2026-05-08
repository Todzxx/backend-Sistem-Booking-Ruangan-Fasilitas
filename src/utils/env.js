const logger = require('./logger');

const requiredVars = [
  { name: 'DATABASE_URL', message: 'Database connection string is required' },
  { name: 'JWT_SECRET', message: 'JWT secret key is required for authentication' },
  { name: 'JWT_REFRESH_SECRET', message: 'JWT refresh secret is required for refresh tokens' },
];

const optionalVars = [
  { name: 'PORT', default: '5000' },
  { name: 'NODE_ENV', default: 'development' },
  { name: 'CORS_ORIGIN', default: '*' },
];

const validateEnv = () => {
  const missing = [];

  for (const { name, message } of requiredVars) {
    if (!process.env[name]) {
      missing.push(`  - ${name}: ${message}`);
    }
  }

  if (missing.length > 0) {
    const errorMsg = `Missing required environment variables:\n${missing.join('\n')}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  for (const { name, default: defaultValue } of optionalVars) {
    if (!process.env[name]) {
      process.env[name] = defaultValue;
      logger.warn(`Environment variable ${name} not set, using default: "${defaultValue}"`);
    }
  }

  logger.info('All environment variables validated successfully');
};

module.exports = { validateEnv };
