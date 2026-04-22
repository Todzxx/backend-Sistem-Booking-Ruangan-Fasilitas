const facilityService = require('./facility.service');
const { success } = require('../../utils/responseHandler');
const Joi = require('joi');

/**
 * Controller for managing Facilities (Rooms, Labs, Projectors, etc.)
 */
const facilityController = {
  getAllFacilities: async (req, res, next) => {
    try {
      const data = await facilityService.getAllFacilities();
      return success(res, 'Facilities fetched successfully', data);
    } catch (error) {
      next(error);
    }
  },

  getFacilityById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const data = await facilityService.getFacilityById(id);
      return success(res, 'Facility fetched successfully', data);
    } catch (error) {
      next(error);
    }
  },

  createFacility: async (req, res, next) => {
    try {
      const schema = Joi.object({
        name: Joi.string().min(3).required(),
        description: Joi.string().allow('', null),
        capacity: Joi.number().integer().min(1).required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        const err = new Error(error.details[0].message);
        err.statusCode = 400;
        throw err;
      }

      const data = await facilityService.createFacility(value);
      return success(res, 'Facility created successfully', data, 201);
    } catch (error) {
      next(error);
    }
  },

  updateFacility: async (req, res, next) => {
    try {
      const { id } = req.params;
      const schema = Joi.object({
        name: Joi.string().min(3),
        description: Joi.string().allow('', null),
        capacity: Joi.number().integer().min(1),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        const err = new Error(error.details[0].message);
        err.statusCode = 400;
        throw err;
      }

      const data = await facilityService.updateFacility(id, value);
      return success(res, 'Facility updated successfully', data);
    } catch (error) {
      next(error);
    }
  },

  deleteFacility: async (req, res, next) => {
    try {
      const { id } = req.params;
      await facilityService.deleteFacility(id);
      return success(res, 'Facility deleted successfully', null, 204);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = facilityController;
