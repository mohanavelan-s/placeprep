const express = require('express');
const { body, param, query } = require('express-validator');

const controller = require('../controllers/coding.controller');
const { requireAuth, requireNonObserver } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth, requireNonObserver());

router.get('/languages', asyncHandler(controller.listLanguages));

router.post(
  '/problem/resolve',
  [
    body('url').optional({ values: 'falsy' }).isString(),
    body('slug').optional({ values: 'falsy' }).isString(),
    body('title').optional({ values: 'falsy' }).isString(),
    body('problemTitle').optional({ values: 'falsy' }).isString(),
    body('problemNumber').optional({ values: 'falsy' }).isString(),
    body('description').optional({ values: 'falsy' }).isString(),
    body('testCases').optional().isArray(),
  ],
  validate,
  asyncHandler(controller.resolveProblem),
);

router.get(
  '/task/:taskId',
  [param('taskId').isUUID()],
  validate,
  asyncHandler(controller.getTask),
);

const runValidators = [
  body('taskId').optional({ values: 'falsy' }).isUUID(),
  body('language').trim().isLength({ min: 1, max: 40 }),
  body('sourceCode').isString(),
  body('stdin').optional({ values: 'falsy' }).isString(),
  body('expectedOutput').optional({ values: 'falsy' }).isString(),
  body('problem').optional().isObject(),
  body('durationSeconds').optional({ values: 'falsy' }).isNumeric(),
  body('timeLimitSeconds').optional({ values: 'falsy' }).isNumeric(),
  body('assessmentId').optional({ values: 'falsy' }).isUUID(),
  body('assessmentQuestionId').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
];

router.post('/runs', runValidators, validate, asyncHandler(controller.createRun));

router.get(
  '/runs/:runId',
  [param('runId').isUUID()],
  validate,
  asyncHandler(controller.getRun),
);

router.post('/submissions', runValidators, validate, asyncHandler(controller.submitCode));

router.get(
  '/submissions',
  [query('limit').optional().isInt({ min: 1, max: 50 })],
  validate,
  asyncHandler(controller.listSubmissions),
);

module.exports = router;
