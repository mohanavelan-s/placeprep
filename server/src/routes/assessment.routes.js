const express = require('express');
const { body, param } = require('express-validator');

const controller = require('../controllers/assessment.controller');
const { requireAuth, requireNonObserver } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth, requireNonObserver());

router.get('/overview', asyncHandler(controller.getOverview));

router.post(
  '/generate',
  [
    body('assessmentType').optional().isIn(['mcq', 'fill_blank', 'coding']),
    body('durationMinutes').optional().isInt({ min: 10, max: 90 }),
    body('assessmentScope').optional().isIn(['daily', 'weekly']),
    body('assessmentPhase').optional().isIn(['pre', 'post', 'surprise']),
  ],
  validate,
  asyncHandler(controller.generateAssessment)
);

router.post(
  '/:assessmentId/submit',
  [
    param('assessmentId').isUUID(),
    body('answers').custom((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Assessment answers must be an object.');
      }

      return true;
    }),
    body('timedOut').optional().isBoolean(),
  ],
  validate,
  asyncHandler(controller.submitAssessment)
);

router.post(
  '/:assessmentId/apply-plan-update',
  [param('assessmentId').isUUID()],
  validate,
  asyncHandler(controller.applyPlanUpdate)
);

module.exports = router;
