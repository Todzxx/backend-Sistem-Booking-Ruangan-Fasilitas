const prisma = require('../../config/prisma');

/**
 * Service for managing Facility related logic
 */
const facilityService = {
  /**
   * Get all registered facilities
   */
  getAllFacilities: async () => {
    return await prisma.facility.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  },

  /**
   * Get a single facility by ID
   * @param {string} id 
   */
  getFacilityById: async (id) => {
    const facility = await prisma.facility.findUnique({
      where: { id },
    });

    if (!facility || !facility.isActive) {
      const error = new Error('Facility not found or inactive');
      error.statusCode = 404;
      throw error;
    }

    return facility;
  },

  /**
   * Create a new facility
   * @param {Object} facilityData 
   */
  createFacility: async (facilityData) => {
    return await prisma.facility.create({
      data: facilityData,
    });
  },

  /**
   * Update an existing facility
   * @param {string} id 
   * @param {Object} updateData 
   */
  updateFacility: async (id, updateData) => {
    // Check if exists
    const existingFacility = await prisma.facility.findUnique({ where: { id } });
    if (!existingFacility || !existingFacility.isActive) {
      const error = new Error('Facility not found');
      error.statusCode = 404;
      throw error;
    }

    return await prisma.facility.update({
      where: { id },
      data: updateData,
    });
  },

  /**
   * Delete a facility (Soft Delete)
   * @param {string} id 
   */
  deleteFacility: async (id) => {
    try {
      // Check if exists
      const existingFacility = await prisma.facility.findUnique({ where: { id } });
      if (!existingFacility) {
        const error = new Error('Facility not found');
        error.statusCode = 404;
        throw error;
      }

      // Instead of hard delete, we use soft delete
      return await prisma.facility.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (error) {
      // Prisma error code for foreign key constraint violation
      if (error.code === 'P2003') {
        const customError = new Error('Cannot delete facility because it has associated booking records. Please cancel all bookings first.');
        customError.statusCode = 409;
        throw customError;
      }
      throw error;
    }
  },
};

module.exports = facilityService;
