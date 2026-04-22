const prisma = require('../../config/prisma');
const Joi = require('joi');

/**
 * Controller for managing Facilities (Rooms, Labs, Projectors, etc.)
 * Follows Clean Code principles and includes detailed JSDoc comments.
 */
const facilityController = {
  /**
   * Get all registered facilities
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getAllFacilities: async (req, res, next) => {
    try {
      const facilities = await prisma.facility.findMany({
        orderBy: { name: 'asc' },
      });

      res.status(200).json({
        status: 'success',
        results: facilities.length,
        data: facilities,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get a single facility by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getFacilityById: async (req, res, next) => {
    try {
      const { id } = req.params;

      const facility = await prisma.facility.findUnique({
        where: { id },
      });

      if (!facility) {
        return res.status(404).json({
          status: 'fail',
          message: 'Facility not found',
        });
      }

      res.status(200).json({
        status: 'success',
        data: facility,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create a new facility (ADMIN only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  createFacility: async (req, res, next) => {
    try {
      // Validation schema for facility creation
      const schema = Joi.object({
        name: Joi.string().min(3).required(),
        description: Joi.string().allow('', null),
        capacity: Joi.number().integer().min(1).required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          status: 'fail',
          message: error.details[0].message,
        });
      }

      const facility = await prisma.facility.create({
        data: value,
      });

      res.status(201).json({
        status: 'success',
        message: 'Facility created successfully',
        data: facility,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update an existing facility by ID (ADMIN only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  updateFacility: async (req, res, next) => {
    try {
      const { id } = req.params;

      // Validation schema for facility update
      const schema = Joi.object({
        name: Joi.string().min(3),
        description: Joi.string().allow('', null),
        capacity: Joi.number().integer().min(1),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          status: 'fail',
          message: error.details[0].message,
        });
      }

      // Check if facility exists before updating
      const existingFacility = await prisma.facility.findUnique({
        where: { id },
      });

      if (!existingFacility) {
        return res.status(404).json({
          status: 'fail',
          message: 'Facility not found',
        });
      }

      const updatedFacility = await prisma.facility.update({
        where: { id },
        data: value,
      });

      res.status(200).json({
        status: 'success',
        message: 'Facility updated successfully',
        data: updatedFacility,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete a facility by ID (ADMIN only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  deleteFacility: async (req, res, next) => {
    try {
      const { id } = req.params;

      // Check if facility exists before deleting
      const existingFacility = await prisma.facility.findUnique({
        where: { id },
      });

      if (!existingFacility) {
        return res.status(404).json({
          status: 'fail',
          message: 'Facility not found',
        });
      }

      await prisma.facility.delete({
        where: { id },
      });

      res.status(204).json({
        status: 'success',
        data: null,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = facilityController;
