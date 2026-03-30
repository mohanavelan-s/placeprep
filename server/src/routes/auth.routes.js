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
    body('name').trim().isLength({ min: 2, max: 120 }),
    body('username').optional().trim().matches(/^[a-zA-Z0-9._-]{3,60}$/),
    body('email').isEmail(),
    body('password').isLength({ min: 8, max: 128 }),
    body('inviteCode').optional().isString(),
    body('weakAreas').optional().isArray(),
    body('targetRole').optional().isString(),
    body('placementDate').optional().isISO8601(),
    body('timezone').optional().isString(),
  ],
  validate,
  asyncHandler(authController.register)
);

router.post(
  '/login',
  [
    body('identifier').optional().trim().isLength({ min: 3, max: 255 }),
    body('email').optional().trim().isLength({ min: 3, max: 255 }),
    body('password').isLength({ min: 8, max: 128 }),
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
  ],
  validate,
  asyncHandler(authController.updateMe)
);

module.exports = router;
