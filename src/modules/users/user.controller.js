const userService = require('./user.service');
const { success } = require('../../utils/responseHandler');
const userValidation = require('../../validations/user.validation');

const userController = {
  // Register a new user
  register: async (req, res, next) => {
    try {
      const { error, value } = userValidation.register.validate(req.body);
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
      const { error, value } = userValidation.login.validate(req.body);
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
