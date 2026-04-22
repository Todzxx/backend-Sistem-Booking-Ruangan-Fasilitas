const prisma = require('../../config/prisma');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

/**
 * Controller for managing Bookings with overlap detection, status workflow, and recurrence logic.
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
   * Helper to generate a list of recurring dates (Weekly)
   * @param {Date} start - Base start date
   * @param {Date} end - Base end date
   * @param {number} count - Number of weeks
   * @returns {Array} - List of { startTime, endTime } pairs
   */
  generateWeeklyDates: (start, end, count) => {
    const dates = [];
    for (let i = 0; i < count; i++) {
      const nextStart = new Date(start);
      const nextEnd = new Date(end);
      nextStart.setDate(start.getDate() + i * 7);
      nextEnd.setDate(end.getDate() + i * 7);
      dates.push({ startTime: nextStart, endTime: nextEnd });
    }
    return dates;
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
   * Create a new booking request (Supports Recurrence)
   */
  createBooking: async (req, res, next) => {
    try {
      const schema = Joi.object({
        facilityId: Joi.string().required(),
        startTime: Joi.date().greater('now').required(),
        endTime: Joi.date().greater(Joi.ref('startTime')).required(),
        purpose: Joi.string().min(5).required(),
        isRecurring: Joi.boolean().default(false),
        recurrenceCount: Joi.number().integer().min(1).max(12).when('isRecurring', {
          is: true,
          then: Joi.required(),
          otherwise: Joi.optional(),
        }),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({ status: 'fail', message: error.details[0].message });
      }

      const { facilityId, startTime, endTime, purpose, isRecurring, recurrenceCount } = value;

      // 1. Check if facility exists
      const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
      if (!facility) {
        return res.status(404).json({ status: 'fail', message: 'Facility not found' });
      }

      // 2. Prepare dates
      const bookingDates = isRecurring
        ? bookingController.generateWeeklyDates(startTime, endTime, recurrenceCount)
        : [{ startTime, endTime }];

      // 3. Check for overlaps for ALL dates in the series
      for (const date of bookingDates) {
        const hasOverlap = await bookingController.isOverlapping(facilityId, date.startTime, date.endTime);
        if (hasOverlap) {
          return res.status(409).json({
            status: 'fail',
            message: `Selected time slot is already booked or pending approval at ${date.startTime.toDateString()}`,
          });
        }
      }

      // 4. Create booking(s) using a transaction
      const recurrenceGroupId = isRecurring ? uuidv4() : null;
      
      const result = await prisma.$transaction(
        bookingDates.map((date) =>
          prisma.booking.create({
            data: {
              userId: req.user.id,
              facilityId,
              startTime: date.startTime,
              endTime: date.endTime,
              purpose,
              status: 'PENDING',
              recurrenceGroupId,
            },
            include: { facility: true },
          })
        )
      );

      res.status(201).json({
        status: 'success',
        message: 'Booking request(s) submitted successfully',
        data: isRecurring ? result : result[0],
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
   * Cancel a booking by the owner (Supports Cancelling All in series)
   */
  cancelBooking: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { cancelAll } = req.query; // true if want to cancel entire series

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

      if (cancelAll === 'true' && booking.recurrenceGroupId) {
        // Cancel entire series
        const deleted = await prisma.booking.updateMany({
          where: { 
            recurrenceGroupId: booking.recurrenceGroupId,
            status: 'PENDING' 
          },
          data: { status: 'CANCELLED' },
        });

        return res.status(200).json({
          status: 'success',
          message: `${deleted.count} recurring bookings cancelled successfully`,
        });
      }

      // Cancel single booking
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
   */
  getBookingsByFacility: async (req, res, next) => {
    try {
      const { facilityId } = req.params;

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
