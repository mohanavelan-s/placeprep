const express = require('express');
const { body } = require('express-validator');

const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post(
  '/register',
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 120 })
      .withMessage('Full name must be between 2 and 120 characters.'),
    body('username')
      .optional({ values: 'falsy' })
      .trim()
      .matches(/^[a-zA-Z0-9._-]{3,60}$/)
      .withMessage('Username must be 3 to 60 characters and use only letters, numbers, dot, underscore, or hyphen.'),
    body('email')
      .isEmail()
      .withMessage('Enter a valid email address.'),
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be at least 8 characters long.'),
    body('inviteCode')
      .optional({ values: 'falsy' })
      .isString()
      .withMessage('Invite code is invalid.'),
    body('weakAreas')
      .optional()
      .isArray()
      .withMessage('Weak areas must be sent as a list.'),
    body('targetRole')
      .optional({ values: 'falsy' })
      .isString()
      .withMessage('Target role is invalid.'),
    body('placementDate')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('Placement date must be a valid date.'),
    body('timezone')
      .optional({ values: 'falsy' })
      .isString()
      .withMessage('Timezone is invalid.'),
  ],
  validate,
  asyncHandler(authController.register)
);

router.post(
  '/login',
  [
    body('identifier')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ min: 3, max: 255 })
      .withMessage('Username or email must be at least 3 characters.'),
    body('email')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ min: 3, max: 255 })
      .withMessage('Email is invalid.'),
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be at least 8 characters long.'),
  ],
  validate,
  asyncHandler(authController.login)
);

router.get('/me', requireAuth, asyncHandler(authController.me));

router.patch(
  '/me',
  requireAuth,
  [
    body('name').optional().trim().isLength({ min: 2, max: 120 }),
    body('username').optional().trim().matches(/^[a-zA-Z0-9._-]{3,60}$/),
    body('weakAreas').optional().isArray(),
    body('targetRole').optional().isString(),
    body('placementDate').optional({ values: 'falsy' }).isISO8601(),
    body('timezone').optional().isString(),
    body('preferredLanguage').optional().isIn(['english', 'tamil', 'hindi']),
  ],
  validate,
  asyncHandler(authController.updateMe)
);

module.exports = router;
