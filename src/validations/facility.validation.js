const Joi = require('joi');

const facilityValidation = {
  create: Joi.object({
    name: Joi.string().min(3).required(),
    description: Joi.string().allow('', null),
    capacity: Joi.number().integer().min(1).required(),
  }),

  update: Joi.object({
    name: Joi.string().min(3),
    description: Joi.string().allow('', null),
    capacity: Joi.number().integer().min(1),
  }),
};

module.exports = facilityValidation;
