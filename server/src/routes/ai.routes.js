const express = require('express');
const { body, query } = require('express-validator');

const controller = require('../controllers/ai.controller');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/status',
  asyncHandler(controller.getStatus)
);

router.get(
  '/prep-architect/latest',
  asyncHandler(controller.getLatestPrepArchitectPlan)
);

router.get(
  '/prep-architect/history',
  [query('limit').optional().isInt({ min: 1, max: 20 })],
  validate,
  asyncHandler(controller.getPrepArchitectHistory)
);

const generateTasksValidation = [
  body('weakAreas').optional().isArray(),
  body('weakTopics').optional().isArray(),
  body('strongTopics').optional().isArray(),
  body('availableMinutes').optional().isInt({ min: 60, max: 360 }),
  body('persist').optional().isBoolean(),
  body('replaceExisting').optional().isBoolean(),
];

router.post(
  '/generate-tasks',
  generateTasksValidation,
  validate,
  asyncHandler(controller.generateTasks)
);

router.post(
  '/prep-architect',
  [
    body('knownTopics').optional().isArray({ max: 8 }),
    body('targetTopics').optional().isArray({ max: 8 }),
    body('timePerDay').optional().isInt({ min: 60, max: 480 }),
    body('targetRole').optional().isString(),
  ],
  validate,
  asyncHandler(controller.generatePrepArchitectPlan)
);

router.post(
  '/prep-architect/update',
  [
    body('planId').isUUID(),
    body('knownTopics').optional().isArray({ max: 8 }),
    body('targetTopics').optional().isArray({ max: 8 }),
    body('timePerDay').optional().isInt({ min: 60, max: 480 }),
    body('targetRole').optional().isString(),
  ],
  validate,
  asyncHandler(controller.updatePrepArchitectPlan)
);

router.post(
  '/tasks/generate',
  [
    ...generateTasksValidation,
  ],
  validate,
  asyncHandler(controller.generateTasks)
);

router.post(
  '/help',
  [
    body('topic').optional().isString(),
    body('problem').optional().isString(),
    body('problemName').optional().isString(),
    body('attempt').optional().isString(),
    body('language').optional().isString(),
    body('notes').optional().isString(),
  ],
  validate,
  asyncHandler(controller.getStuckHelp)
);

router.post(
  '/evaluate',
  [
    body('tasks').optional().isArray(),
    body('totalTasks').optional().isInt({ min: 0, max: 100 }),
    body('tasksCompleted').optional().isInt({ min: 0, max: 100 }),
    body('studyHours').optional().isFloat({ min: 0, max: 24 }),
    body('timeSpent').optional().isInt({ min: 0, max: 720 }),
    body('timeSpentMinutes').optional().isInt({ min: 0, max: 720 }),
    body('powerPocketMinutes').optional().isInt({ min: 0, max: 1440 }),
    body('notes').optional().isString(),
    body('struggles').optional().isString(),
    body('persistLog').optional().isBoolean(),
  ],
  validate,
  asyncHandler(controller.evaluateDailyPerformance)
);

router.post(
  '/daily-evaluation',
  [
    body('tasks').optional().isArray(),
    body('totalTasks').optional().isInt({ min: 0, max: 100 }),
    body('tasksCompleted').optional().isInt({ min: 0, max: 100 }),
    body('studyHours').optional().isFloat({ min: 0, max: 24 }),
    body('timeSpent').optional().isInt({ min: 0, max: 720 }),
    body('timeSpentMinutes').optional().isInt({ min: 0, max: 720 }),
    body('powerPocketMinutes').optional().isInt({ min: 0, max: 1440 }),
    body('notes').optional().isString(),
    body('struggles').optional().isString(),
    body('persistLog').optional().isBoolean(),
  ],
  validate,
  asyncHandler(controller.evaluateDailyPerformance)
);

router.post(
  '/quick-task',
  [body('availableMinutes').optional().isInt({ min: 15, max: 45 })],
  validate,
  asyncHandler(controller.generateQuickTask)
);

router.get(
  '/chat',
  asyncHandler(controller.getMentorHistory)
);

router.post(
  '/chat',
  [body('message').trim().isLength({ min: 1, max: 4000 })],
  validate,
  asyncHandler(controller.sendMentorMessage)
);

module.exports = router;
