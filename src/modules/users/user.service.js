const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../../utils/token');

const userService = {
  registerUser: async (userData) => {
    const { name, email, password } = userData;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const error = new Error('Email already registered');
      error.statusCode = 400;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'USER',
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  loginUser: async (email, password) => {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const payload = { id: user.id, role: user.role };
    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
      refreshToken,
    };
  },

  refreshToken: async (token) => {
    const decoded = verifyRefreshToken(token);
    if (!decoded) {
      const error = new Error('Invalid or expired refresh token');
      error.statusCode = 401;
      throw error;
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      const error = new Error('User belonging to this token no longer exists');
      error.statusCode = 401;
      throw error;
    }

    const payload = { id: user.id, role: user.role };
    const newToken = generateToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    return { token: newToken, refreshToken: newRefreshToken };
  },
};

module.exports = userService;
