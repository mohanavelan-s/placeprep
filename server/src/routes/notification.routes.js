const express = require('express');
const { param, query } = require('express-validator');

const controller = require('../controllers/notification.controller');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  [
    query('unread').optional().isBoolean().toBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  asyncHandler(controller.listNotifications)
);

router.post('/sync', asyncHandler(controller.syncNotifications));
router.post('/test-push', asyncHandler(controller.testPushNotification));

router.post(
  '/:notificationId/read',
  [
    param('notificationId').isUUID(),
  ],
  validate,
  asyncHandler(controller.markRead)
);

router.post('/read-all', asyncHandler(controller.markAllRead));
router.delete('/history', asyncHandler(controller.clearHistory));

module.exports = router;
