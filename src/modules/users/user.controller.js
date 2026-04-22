const userService = require('./user.service');
const { success } = require('../../utils/responseHandler');
const Joi = require('joi');

const userController = {
  // Register a new user
  register: async (req, res, next) => {
    try {
      // Validation schema
      const schema = Joi.object({
        name: Joi.string().min(3).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        role: Joi.string().valid('USER', 'ADMIN').default('USER'),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        const err = new Error(error.details[0].message);
        err.statusCode = 400;
        throw err;
      }

      const user = await userService.registerUser(value);
      
      return success(res, 'User registered successfully', user, 201);
    } catch (error) {
      next(error);
    }
  },

  // Login user
  login: async (req, res, next) => {
    try {
      const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        const err = new Error(error.details[0].message);
        err.statusCode = 400;
        throw err;
      }

      const { email, password } = value;
      const result = await userService.loginUser(email, password);

      return success(res, 'Logged in successfully', result);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = userController;
