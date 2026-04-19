const express = require('express');
const { body, query } = require('express-validator');

const controller = require('../controllers/progress.controller');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth);

router.get('/summary', asyncHandler(controller.getSummary));

router.get(
  '/history',
  [query('days').optional().isInt({ min: 1, max: 90 })],
  validate,
  asyncHandler(controller.getHistory)
);

router.delete(
  '/history',
  [
    body('entryIds').optional().isArray({ min: 1, max: 60 }),
    body('entryIds.*').optional().isUUID(),
  ],
  validate,
  asyncHandler(controller.clearHistory)
);

module.exports = router;
