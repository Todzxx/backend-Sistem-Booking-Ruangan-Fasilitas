const express = require('express');
const facilityController = require('./facility.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const roleMiddleware = require('../../middleware/role.middleware');

const router = express.Router();

/**
 * Routes for Facility Management
 * All routes are protected by authMiddleware (requires login)
 */
router.use(authMiddleware);

// Publicly readable for logged-in users
router.get('/', facilityController.getAllFacilities);
router.get('/:id', facilityController.getFacilityById);

// Admin-only operations for managing facilities
router.post(
  '/',
  roleMiddleware('ADMIN'),
  facilityController.createFacility
);

router.patch(
  '/:id',
  roleMiddleware('ADMIN'),
  facilityController.updateFacility
);

router.delete(
  '/:id',
  roleMiddleware('ADMIN'),
  facilityController.deleteFacility
);

module.exports = router;
