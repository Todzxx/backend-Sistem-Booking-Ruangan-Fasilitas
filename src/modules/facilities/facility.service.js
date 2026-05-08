const prisma = require('../../config/prisma');

const facilityService = {
  getAllFacilities: async (query = {}) => {
    const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc', search, minCapacity } = query;

    const skip = (page - 1) * limit;
    const take = Math.min(parseInt(limit), 100);

    const where = { isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (minCapacity) {
      where.capacity = { gte: parseInt(minCapacity) };
    }

    const orderBy = {};
    const validSortFields = ['name', 'capacity', 'createdAt', 'updatedAt'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'name';
    orderBy[field] = sortOrder === 'desc' ? 'desc' : 'asc';

    const [facilities, total] = await Promise.all([
      prisma.facility.findMany({ where, orderBy, skip, take }),
      prisma.facility.count({ where }),
    ]);

    return {
      data: facilities,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  },

  getFacilityById: async (id) => {
    const facility = await prisma.facility.findUnique({ where: { id } });

    if (!facility || !facility.isActive) {
      const error = new Error('Facility not found or inactive');
      error.statusCode = 404;
      throw error;
    }

    return facility;
  },

  createFacility: async (facilityData) => {
    return await prisma.facility.create({ data: facilityData });
  },

  updateFacility: async (id, updateData) => {
    const existingFacility = await prisma.facility.findUnique({ where: { id } });
    if (!existingFacility || !existingFacility.isActive) {
      const error = new Error('Facility not found');
      error.statusCode = 404;
      throw error;
    }

    return await prisma.facility.update({ where: { id }, data: updateData });
  },

  deleteFacility: async (id) => {
    try {
      const existingFacility = await prisma.facility.findUnique({ where: { id } });
      if (!existingFacility) {
        const error = new Error('Facility not found');
        error.statusCode = 404;
        throw error;
      }

      return await prisma.facility.update({
        where: { id },
        data: { isActive: false },
      });
    } catch (error) {
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
