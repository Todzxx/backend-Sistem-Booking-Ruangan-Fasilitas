const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const { generateToken } = require('../../utils/token');

/**
 * Service for handling User related logic (Auth, Profile, etc.)
 */
const userService = {
  /**
   * Register a new user
   * @param {Object} userData - User data (name, email, password, role)
   */
  registerUser: async (userData) => {
    const { name, email, password, role } = userData;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const error = new Error('Email already registered');
      error.statusCode = 400;
      throw error;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'USER',
      },
    });

    // Remove password from returned object
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  /**
   * Login user and return token
   * @param {string} email 
   * @param {string} password 
   */
  loginUser: async (email, password) => {
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    // Generate token
    const token = generateToken({ id: user.id, role: user.role });

    // Remove password from returned object
    const { password: _, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      token,
    };
  },
};

module.exports = userService;
