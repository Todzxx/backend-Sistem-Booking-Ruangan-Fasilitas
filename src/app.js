const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const userRoutes = require('./modules/users/user.routes');

dotenv.config();

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Basic Route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Room & Facility Booking API',
    status: 'Server is running'
  });
});

// Routes
app.use('/api/v1/auth', userRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: 'error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

module.exports = app;
