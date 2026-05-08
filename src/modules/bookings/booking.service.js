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
   * Helper to generate a list of recurring dates
   */
  generateRecurringDates: (start, end, type, count) => {
    const dates = [];
    for (let i = 0; i < count; i++) {
      const nextStart = new Date(start);
      const nextEnd = new Date(end);
      
      if (type === 'DAILY') {
        nextStart.setDate(start.getDate() + i);
        nextEnd.setDate(end.getDate() + i);
      } else if (type === 'WEEKLY') {
        nextStart.setDate(start.getDate() + i * 7);
        nextEnd.setDate(end.getDate() + i * 7);
      } else if (type === 'MONTHLY') {
        nextStart.setMonth(start.getMonth() + i);
        nextEnd.setMonth(end.getMonth() + i);
      }
      
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
    const { facilityId, startTime, endTime, purpose, isRecurring, recurrenceType, recurrenceCount } = bookingData;

    return await prisma.$transaction(async (tx) => {
      // 1. Check if facility exists and is active
      const facility = await tx.facility.findUnique({ 
        where: { id: facilityId } 
      });
      
      if (!facility || !facility.isActive) {
        const error = new Error('Facility not found or currently unavailable');
        error.statusCode = 404;
        throw error;
      }

      // 2. Prepare dates
      const bookingDates = isRecurring
        ? bookingService.generateRecurringDates(startTime, endTime, recurrenceType, recurrenceCount)
        : [{ startTime, endTime }];

      // 3. Create recurrence group ID if needed
      const recurrenceGroupId = isRecurring ? uuidv4() : null;

      // 4. Overlap check and Creation for each date
      const createdBookings = [];
      for (const date of bookingDates) {
        // Overlap checking INSIDE transaction
        const overlapping = await tx.booking.findFirst({
          where: {
            facilityId,
            status: { in: [BOOKING_STATUS.PENDING, BOOKING_STATUS.APPROVED] },
            OR: [
              { startTime: { lt: date.endTime, gte: date.startTime } },
              { endTime: { gt: date.startTime, lte: date.endTime } },
              { startTime: { lte: date.startTime }, endTime: { gte: date.endTime } },
            ],
          },
        });

        if (overlapping) {
          const error = new Error(`Time slot is already booked or pending at ${date.startTime.toLocaleString()}`);
          error.statusCode = 409;
          throw error;
        }

        const booking = await tx.booking.create({
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
        });
        createdBookings.push(booking);
      }

      return isRecurring ? createdBookings : createdBookings[0];
    });
  },

  /**
   * Get bookings for a user
   */
  getUserBookings: async (userId, query = {}) => {
    const { page = 1, limit = 20, sortBy = 'startTime', sortOrder = 'desc', status, startDate, endDate } = query;

    const skip = (page - 1) * limit;
    const take = Math.min(parseInt(limit), 100);

    const where = { userId };

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    const orderBy = {};
    const validSortFields = ['startTime', 'endTime', 'createdAt', 'status'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'startTime';
    orderBy[field] = sortOrder === 'desc' ? 'desc' : 'asc';

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { facility: true },
        orderBy,
        skip,
        take,
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      data: bookings,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  },

  /**
   * Get all bookings (Admin)
   */
  getAllBookings: async (query = {}) => {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', status, facilityId, startDate, endDate } = query;

    const skip = (page - 1) * limit;
    const take = Math.min(parseInt(limit), 100);

    const where = {};

    if (status) {
      where.status = status;
    }

    if (facilityId) {
      where.facilityId = facilityId;
    }

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    const orderBy = {};
    const validSortFields = ['startTime', 'endTime', 'createdAt', 'updatedAt', 'status'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    orderBy[field] = sortOrder === 'desc' ? 'desc' : 'asc';

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          facility: true,
          user: { select: { name: true, email: true } },
        },
        orderBy,
        skip,
        take,
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      data: bookings,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
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
      const count = await prisma.booking.updateMany({
        where: {
          recurrenceGroupId: booking.recurrenceGroupId,
          userId,
          status: BOOKING_STATUS.PENDING,
        },
        data: { status: BOOKING_STATUS.CANCELLED },
      });

      if (count.count === 0) {
        const error = new Error('No pending bookings found in this recurrence group');
        error.statusCode = 404;
        throw error;
      }

      return count;
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
