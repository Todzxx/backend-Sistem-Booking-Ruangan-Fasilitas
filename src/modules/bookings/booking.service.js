const prisma = require('../../config/prisma');
const { v4: uuidv4 } = require('uuid');
const { BOOKING_STATUS } = require('../../constants');

/**
 * Service for managing Bookings with overlap detection, status workflow, and recurrence logic.
 */
const bookingService = {
  /**
   * Internal helper to check for overlapping bookings
   */
  isOverlapping: async (facilityId, startTime, endTime) => {
    const overlapping = await prisma.booking.findFirst({
      where: {
        facilityId,
        status: { in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED] },
        OR: [
          {
            startTime: { lt: endTime, gte: startTime },
          },
          {
            endTime: { gt: startTime, lte: endTime },
          },
          {
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
   * Check availability
   */
  checkAvailability: async (facilityId, startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const error = new Error('Invalid date format');
      error.statusCode = 400;
      throw error;
    }

    const hasOverlap = await bookingService.isOverlapping(facilityId, start, end);
    return !hasOverlap;
  },

  /**
   * Create a new booking (Supports Recurrence)
   */
  createBooking: async (bookingData, userId) => {
    const { facilityId, startTime, endTime, purpose, isRecurring, recurrenceCount } = bookingData;

    // 1. Check if facility exists
    const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
    if (!facility) {
      const error = new Error('Facility not found');
      error.statusCode = 404;
      throw error;
    }

    // 2. Prepare dates
    const bookingDates = isRecurring
      ? bookingService.generateWeeklyDates(startTime, endTime, recurrenceCount)
      : [{ startTime, endTime }];

    // 3. Check for overlaps for ALL dates in the series
    for (const date of bookingDates) {
      const hasOverlap = await bookingService.isOverlapping(facilityId, date.startTime, date.endTime);
      if (hasOverlap) {
        const error = new Error(`Selected time slot is already booked or pending approval at ${date.startTime.toDateString()}`);
        error.statusCode = 409;
        throw error;
      }
    }

    // 4. Create booking(s) using a transaction
    const recurrenceGroupId = isRecurring ? uuidv4() : null;
    
    const result = await prisma.$transaction(
      bookingDates.map((date) =>
        prisma.booking.create({
          data: {
            userId,
            facilityId,
            startTime: date.startTime,
            endTime: date.endTime,
            purpose,
            status: BOOKING_STATUS.PENDING,
            recurrenceGroupId,
          },
          include: { facility: true },
        })
      )
    );

    return isRecurring ? result : result[0];
  },

  /**
   * Get bookings for a user
   */
  getUserBookings: async (userId) => {
    return await prisma.booking.findMany({
      where: { userId },
      include: { facility: true },
      orderBy: { startTime: 'desc' },
    });
  },

  /**
   * Get all bookings (Admin)
   */
  getAllBookings: async () => {
    return await prisma.booking.findMany({
      include: {
        facility: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Update booking status
   */
  updateStatus: async (id, status, notes) => {
    if (![BOOKING_STATUS.APPROVED, BOOKING_STATUS.REJECTED].includes(status)) {
      const error = new Error('Invalid status update');
      error.statusCode = 400;
      throw error;
    }

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      const error = new Error('Booking not found');
      error.statusCode = 404;
      throw error;
    }

    return await prisma.booking.update({
      where: { id },
      data: { status, notes },
    });
  },

  /**
   * Cancel booking
   */
  cancelBooking: async (id, userId, cancelAll = false) => {
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) {
      const error = new Error('Booking not found');
      error.statusCode = 404;
      throw error;
    }

    if (booking.userId !== userId) {
      const error = new Error('You can only cancel your own bookings');
      error.statusCode = 403;
      throw error;
    }

    if (booking.status !== BOOKING_STATUS.PENDING) {
      const error = new Error('Only pending bookings can be cancelled');
      error.statusCode = 400;
      throw error;
    }

    if (cancelAll === true && booking.recurrenceGroupId) {
      return await prisma.booking.updateMany({
        where: { 
          recurrenceGroupId: booking.recurrenceGroupId,
          status: BOOKING_STATUS.PENDING 
        },
        data: { status: BOOKING_STATUS.CANCELLED },
      });
    }

    return await prisma.booking.update({
      where: { id },
      data: { status: BOOKING_STATUS.CANCELLED },
    });
  },

  /**
   * Get bookings by facility
   */
  getBookingsByFacility: async (facilityId) => {
    return await prisma.booking.findMany({
      where: {
        facilityId,
        status: { in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED] },
      },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  },
};

module.exports = bookingService;
