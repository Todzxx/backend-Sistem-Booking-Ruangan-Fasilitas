const express = require('express');
const bookingController = require('./booking.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const roleMiddleware = require('../../middleware/role.middleware');

const router = express.Router();

/**
 * Routes for Booking System
 * All routes require authentication
 */
router.use(authMiddleware);

// Check availability (Query params: facilityId, startTime, endTime)
router.get('/check', bookingController.checkAvailability);

// User operations
router.post('/', bookingController.createBooking);
router.get('/my', bookingController.getMyBookings);
router.patch('/:id/cancel', bookingController.cancelBooking);

// Admin operations
router.get('/', roleMiddleware('ADMIN'), bookingController.getAllBookings);
router.patch('/:id/status', roleMiddleware('ADMIN'), bookingController.updateStatus);

module.exports = router;
