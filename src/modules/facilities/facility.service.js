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

    if (!facility) {
      const error = new Error('Facility not found');
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
    if (!existingFacility) {
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
   * Delete a facility
   * @param {string} id 
   */
  deleteFacility: async (id) => {
    // Check if exists
    const existingFacility = await prisma.facility.findUnique({ where: { id } });
    if (!existingFacility) {
      const error = new Error('Facility not found');
      error.statusCode = 404;
      throw error;
    }

    return await prisma.facility.delete({
      where: { id },
    });
  },
};

module.exports = facilityService;
