const express = require('express');
const { body, query, param } = require('express-validator');

const controller = require('../controllers/powerPocket.controller');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth);

router.get('/active', asyncHandler(controller.getActiveSession));

router.post(
  '/start',
  [
    body('taskId').optional().isUUID(),
    body('title').optional().isString(),
    body('notes').optional().isString(),
    body('source').optional().isIn(['manual', 'suggested', 'ai']),
    body('startedAt').optional().isISO8601(),
  ],
  validate,
  asyncHandler(controller.startSession)
);

router.post(
  '/:sessionId/end',
  [
    param('sessionId').isUUID(),
    body('taskId').optional().isUUID(),
    body('title').optional().isString(),
    body('notes').optional().isString(),
    body('status').optional().isIn(['completed', 'abandoned']),
    body('endedAt').optional().isISO8601(),
    body('durationMinutes').optional().isInt({ min: 0, max: 720 }),
  ],
  validate,
  asyncHandler(controller.endSession)
);

router.get(
  '/',
  [
    query('date').optional().isString(),
    query('status').optional().isIn(['active', 'completed', 'abandoned']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  asyncHandler(controller.listSessions)
);

module.exports = router;
