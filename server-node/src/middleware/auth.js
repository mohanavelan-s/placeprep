const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userRepository = require('../repositories/user.repository');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');
const { isAndroidPublisherUser } = require('../utils/ownerAccess');

function isObserverUser(user) {
  return Boolean(
    user
    && user.role !== 'admin'
    && (user.accessTier === 'observer' || user.coachMetadata?.accessTier === 'observer')
  );
}

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

function requireAndroidPublisher(req, res, next) {
  if (!req.user) {
    next(new AppError('Authentication token is required.', 401));
    return;
  }

  if (!isAndroidPublisherUser(req.user)) {
    next(new AppError('Only the owner account can publish Android builds.', 403));
    return;
  }

  next();
}

function requireNonObserver(message = 'Observer access is limited for this resource.') {
  return (req, res, next) => {
    if (!req.user) {
      next(new AppError('Authentication token is required.', 401));
      return;
    }

    if (isObserverUser(req.user)) {
      next(new AppError(message, 403));
      return;
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
  requireAdmin,
  requireAndroidPublisher,
  requireNonObserver,
  isObserverUser,
};
