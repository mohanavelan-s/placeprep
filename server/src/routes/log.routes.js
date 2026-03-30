const express = require('express');
const { body, query, param } = require('express-validator');

const logController = require('../controllers/log.controller');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth);

router.get('/today', asyncHandler(logController.getTodayLog));

router.post(
  '/',
  [
    body('logDate').optional().isISO8601(),
    body('summary').optional().isString(),
    body('wins').optional().isString(),
    body('blockers').optional().isString(),
    body('mood').optional().isInt({ min: 1, max: 5 }),
    body('energy').optional().isInt({ min: 1, max: 5 }),
    body('productivityScore').optional().isInt({ min: 0, max: 100 }),
    body('focusMinutes').optional().isInt({ min: 0, max: 1440 }),
    body('hoursStudied').optional().isFloat({ min: 0, max: 24 }),
    body('tasksCompletedCount').optional().isInt({ min: 0, max: 100 }),
    body('notes').optional().isString(),
    body('improvementPlan').optional().isString(),
  ],
  validate,
  asyncHandler(logController.upsertLog)
);

router.get(
  '/',
  [
    query('date').optional().isString(),
    query('from').optional().isString(),
    query('to').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 120 }),
  ],
  validate,
  asyncHandler(logController.listLogs)
);

router.delete(
  '/:logId',
  [param('logId').isUUID()],
  validate,
  asyncHandler(logController.deleteLog)
);

module.exports = router;
