const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userRepository = require('../repositories/user.repository');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');

const requireAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    throw new AppError('Authentication token is required.', 401);
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await userRepository.findById(payload.sub);

    if (!user) {
      throw new AppError('User account no longer exists.', 401);
    }

    req.user = user;
    req.auth = payload;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('Invalid or expired authentication token.', 401);
  }
});

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      next(new AppError('Authentication token is required.', 401));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError('You do not have permission to access this resource.', 403));
      return;
    }

    next();
  };
}

const requireAdmin = requireRole('admin');

module.exports = {
  requireAuth,
  requireRole,
  requireAdmin,
};
