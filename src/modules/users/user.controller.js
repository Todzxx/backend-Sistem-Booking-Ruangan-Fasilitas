const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const { generateToken } = require('../../utils/token');
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
        return res.status(400).json({ status: 'fail', message: error.details[0].message });
      }

      const { name, email, password, role } = value;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ status: 'fail', message: 'Email already registered' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role,
        },
      });

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      res.status(201).json({
        status: 'success',
        message: 'User registered successfully',
        data: userWithoutPassword,
      });
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
        return res.status(400).json({ status: 'fail', message: error.details[0].message });
      }

      const { email, password } = value;

      // Find user
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ status: 'fail', message: 'Invalid email or password' });
      }

      // Generate token
      const token = generateToken({ id: user.id, role: user.role });

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      res.status(200).json({
        status: 'success',
        message: 'Logged in successfully',
        token,
        data: userWithoutPassword,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = userController;
