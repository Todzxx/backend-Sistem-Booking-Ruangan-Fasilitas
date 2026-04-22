const prisma = require('../../config/prisma');
const Joi = require('joi');

/**
 * Controller for managing Bookings with overlap detection and status workflow.
 */
const bookingController = {
  /**
   * Internal helper to check for overlapping bookings
   * @param {string} facilityId - ID of the facility
   * @param {Date} startTime - New booking start time
   * @param {Date} endTime - New booking end time
   * @returns {Promise<boolean>} - True if overlap exists, false otherwise
   */
  isOverlapping: async (facilityId, startTime, endTime) => {
    const overlapping = await prisma.booking.findFirst({
      where: {
        facilityId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            // Case 1: Existing booking starts during the new booking
            startTime: { lt: endTime, gte: startTime },
          },
          {
            // Case 2: Existing booking ends during the new booking
            endTime: { gt: startTime, lte: endTime },
          },
          {
            // Case 3: New booking is entirely within an existing booking
            startTime: { lte: startTime },
            endTime: { gte: endTime },
          },
        ],
      },
    });

    return !!overlapping;
  },

  /**
   * Check availability for a facility at a specific time range
   */
  checkAvailability: async (req, res, next) => {
    try {
      const { facilityId, startTime, endTime } = req.query;

      if (!facilityId || !startTime || !endTime) {
        return res.status(400).json({
          status: 'fail',
          message: 'Missing required query parameters: facilityId, startTime, endTime',
        });
      }

      const start = new Date(startTime);
      const end = new Date(endTime);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ status: 'fail', message: 'Invalid date format' });
      }

      const hasOverlap = await bookingController.isOverlapping(facilityId, start, end);

      res.status(200).json({
        status: 'success',
        available: !hasOverlap,
        message: hasOverlap ? 'Time slot is already booked' : 'Time slot is available',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create a new booking request
   */
  createBooking: async (req, res, next) => {
    try {
      const schema = Joi.object({
        facilityId: Joi.string().required(),
        startTime: Joi.date().greater('now').required(),
        endTime: Joi.date().greater(Joi.ref('startTime')).required(),
        purpose: Joi.string().min(5).required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({ status: 'fail', message: error.details[0].message });
      }

      const { facilityId, startTime, endTime, purpose } = value;

      // 1. Check if facility exists
      const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
      if (!facility) {
        return res.status(404).json({ status: 'fail', message: 'Facility not found' });
      }

      // 2. Check for overlaps
      const hasOverlap = await bookingController.isOverlapping(facilityId, startTime, endTime);
      if (hasOverlap) {
        return res.status(409).json({
          status: 'fail',
          message: 'Selected time slot is already booked or pending approval',
        });
      }

      // 3. Create booking
      const booking = await prisma.booking.create({
        data: {
          userId: req.user.id,
          facilityId,
          startTime,
          endTime,
          purpose,
          status: 'PENDING',
        },
        include: { facility: true },
      });

      res.status(201).json({
        status: 'success',
        message: 'Booking request submitted successfully',
        data: booking,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get bookings for the current logged-in user
   */
  getMyBookings: async (req, res, next) => {
    try {
      const bookings = await prisma.booking.findMany({
        where: { userId: req.user.id },
        include: { facility: true },
        orderBy: { startTime: 'desc' },
      });

      res.status(200).json({
        status: 'success',
        results: bookings.length,
        data: bookings,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get all bookings (ADMIN ONLY)
   */
  getAllBookings: async (req, res, next) => {
    try {
      const bookings = await prisma.booking.findMany({
        include: {
          facility: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({
        status: 'success',
        results: bookings.length,
        data: bookings,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update booking status (ADMIN ONLY)
   */
  updateStatus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ status: 'fail', message: 'Invalid status update' });
      }

      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) {
        return res.status(404).json({ status: 'fail', message: 'Booking not found' });
      }

      const updatedBooking = await prisma.booking.update({
        where: { id },
        data: { status, notes },
      });

      res.status(200).json({
        status: 'success',
        message: `Booking has been ${status.toLowerCase()}`,
        data: updatedBooking,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Cancel a booking by the owner (User can only cancel if PENDING)
   */
  cancelBooking: async (req, res, next) => {
    try {
      const { id } = req.params;

      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) {
        return res.status(404).json({ status: 'fail', message: 'Booking not found' });
      }

      // Check ownership
      if (booking.userId !== req.user.id) {
        return res.status(403).json({
          status: 'fail',
          message: 'You can only cancel your own bookings',
        });
      }

      // Check status (Can only cancel if PENDING)
      if (booking.status !== 'PENDING') {
        return res.status(400).json({
          status: 'fail',
          message: 'Only pending bookings can be cancelled',
        });
      }

      const updatedBooking = await prisma.booking.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      res.status(200).json({
        status: 'success',
        message: 'Booking cancelled successfully',
        data: updatedBooking,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get all bookings for a specific facility (useful for calendar view)
   * This is part of the Calendar System feature.
   */
  getBookingsByFacility: async (req, res, next) => {
    try {
      const { facilityId } = req.params;

      // Find all bookings that are not REJECTED or CANCELLED
      const bookings = await prisma.booking.findMany({
        where: {
          facilityId,
          status: { in: ['PENDING', 'APPROVED'] },
        },
        include: {
          user: { select: { name: true } },
        },
        orderBy: { startTime: 'asc' },
      });

      res.status(200).json({
        status: 'success',
        results: bookings.length,
        data: bookings,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = bookingController;
