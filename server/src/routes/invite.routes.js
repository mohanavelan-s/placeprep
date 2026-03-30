const express = require('express');
const { body, query } = require('express-validator');

const controller = require('../controllers/invite.controller');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get(
  '/preview',
  [
    query('code').optional().isString(),
  ],
  validate,
  asyncHandler(controller.previewInvite)
);

router.get('/', requireAuth, requireAdmin, asyncHandler(controller.listInvites));

router.post(
  '/',
  requireAuth,
  requireAdmin,
  [
    body('role').optional().isIn(['admin', 'user']),
    body('code').optional().isString(),
    body('expiresAt').optional().isISO8601(),
    body('expiresInDays').optional().isInt({ min: 1, max: 90 }),
    body('label').optional().isString(),
    body('createdFrom').optional().isString(),
  ],
  validate,
  asyncHandler(controller.createInvite)
);

module.exports = router;
