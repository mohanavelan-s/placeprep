const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/coach.controller');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/students', asyncHandler(controller.listStudents));

router.post(
  '/practice-capsules',
  [
    body('studentUserId').isUUID(),
    body('title').optional().isString(),
    body('note').optional().isString(),
    body('scheduledFor').optional().isISO8601(),
    body('leetcodeOneUrl').isURL({ require_protocol: true }),
    body('leetcodeTwoUrl').isURL({ require_protocol: true }),
    body('verbalUrl').isURL({ require_protocol: true }),
    body('aptitudeUrl').isURL({ require_protocol: true }),
    body('leetcodeOneLabel').optional().isString(),
    body('leetcodeTwoLabel').optional().isString(),
    body('verbalLabel').optional().isString(),
    body('aptitudeLabel').optional().isString(),
  ],
  validate,
  asyncHandler(controller.createPracticeCapsule)
);

module.exports = router;
