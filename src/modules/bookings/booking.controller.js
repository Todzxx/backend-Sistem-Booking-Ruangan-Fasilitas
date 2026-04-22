const bookingService = require('./booking.service');
const { success } = require('../../utils/responseHandler');
const Joi = require('joi');

const bookingController = {
  checkAvailability: async (req, res, next) => {
    try {
      const { facilityId, startTime, endTime } = req.query;

      if (!facilityId || !startTime || !endTime) {
        const error = new Error('Missing required query parameters: facilityId, startTime, endTime');
        error.statusCode = 400;
        throw error;
      }

      const available = await bookingService.checkAvailability(facilityId, startTime, endTime);

      return success(res, available ? 'Time slot is available' : 'Time slot is already booked', { available });
    } catch (error) {
      next(error);
    }
  },

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
        const err = new Error(error.details[0].message);
        err.statusCode = 400;
        throw err;
      }

      const data = await bookingService.createBooking(value, req.user.id);

      return success(res, 'Booking request(s) submitted successfully', data, 201);
    } catch (error) {
      next(error);
    }
  },

  getMyBookings: async (req, res, next) => {
    try {
      const data = await bookingService.getUserBookings(req.user.id);
      return success(res, 'My bookings fetched successfully', data);
    } catch (error) {
      next(error);
    }
  },

  getAllBookings: async (req, res, next) => {
    try {
      const data = await bookingService.getAllBookings();
      return success(res, 'All bookings fetched successfully', data);
    } catch (error) {
      next(error);
    }
  },

  updateStatus: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const data = await bookingService.updateStatus(id, status, notes);
      return success(res, `Booking has been ${status.toLowerCase()}`, data);
    } catch (error) {
      next(error);
    }
  },

  cancelBooking: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { cancelAll } = req.query;
      const data = await bookingService.cancelBooking(id, req.user.id, cancelAll === 'true');
      return success(res, 'Booking cancelled successfully', data);
    } catch (error) {
      next(error);
    }
  },

  getBookingsByFacility: async (req, res, next) => {
    try {
      const { facilityId } = req.params;
      const data = await bookingService.getBookingsByFacility(facilityId);
      return success(res, 'Facility bookings fetched successfully', data);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = bookingController;
