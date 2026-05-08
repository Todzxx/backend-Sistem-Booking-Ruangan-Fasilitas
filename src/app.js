const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { validateEnv } = require('./utils/env');
const logger = require('./utils/logger');
const sanitizeMiddleware = require('./middleware/sanitize.middleware');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiter.middleware');
const userRoutes = require('./modules/users/user.routes');
const facilityRoutes = require('./modules/facilities/facility.routes');
const bookingRoutes = require('./modules/bookings/booking.routes');

dotenv.config();
validateEnv();

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map(s => s.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Logging
app.use(morgan('dev', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// Body parsing
app.use(express.json({ limit: '10kb' }));

// Input sanitization (XSS prevention)
app.use(sanitizeMiddleware);

// General API rate limiter
app.use('/api/', apiLimiter);

// Basic Route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Room & Facility Booking API',
    status: 'Server is running',
  });
});

// Routes
app.use('/api/v1/auth', authLimiter, userRoutes);
app.use('/api/v1/facilities', facilityRoutes);
app.use('/api/v1/bookings', bookingRoutes);

// 404 Router handler
app.use((req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
});

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';

  if (statusCode === 500) {
    logger.error(`[${req.method}] ${req.originalUrl} - ${err.message}`, { stack: err.stack });
  }

  res.status(statusCode).json({
    status,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

module.exports = app;
