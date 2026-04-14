const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/userProfile.controller');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth);

router.get('/', asyncHandler(controller.getProfile));
router.get('/web-push/config', asyncHandler(controller.getWebPushConfig));

router.post(
  '/',
  [
    body('linkedinUrl').optional({ values: 'falsy' }).isURL(),
    body('githubUrl').optional({ values: 'falsy' }).isURL(),
    body('leetcodeUrl').optional({ values: 'falsy' }).isURL(),
    body('portfolioUrl').optional({ values: 'falsy' }).isURL(),
    body('resumeUrl').optional({ values: 'falsy' }).isURL(),
    body('avatarUrl').optional({ values: 'falsy' }).isURL(),
    body('notificationsEnabled').optional().isBoolean(),
    body('notificationEmailEnabled').optional().isBoolean(),
    body('notificationBrowserEnabled').optional().isBoolean(),
    body('notificationBrowserPermission').optional().isIn(['default', 'granted', 'denied']),
  ],
  validate,
  asyncHandler(controller.upsertProfile)
);

router.post(
  '/push-subscriptions',
  [
    body('subscription').isObject(),
    body('subscription.endpoint').isString().notEmpty(),
    body('subscription.expirationTime').optional({ values: 'falsy' }).isNumeric(),
    body('subscription.keys').isObject(),
    body('subscription.keys.p256dh').isString().notEmpty(),
    body('subscription.keys.auth').isString().notEmpty(),
  ],
  validate,
  asyncHandler(controller.savePushSubscription)
);

router.delete(
  '/push-subscriptions',
  [
    body('endpoint').isString().notEmpty(),
  ],
  validate,
  asyncHandler(controller.deletePushSubscription)
);

module.exports = router;
