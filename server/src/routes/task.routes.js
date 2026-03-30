const express = require('express');
const { body, query, param } = require('express-validator');

const taskController = require('../controllers/task.controller');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth);

router.get('/today', asyncHandler(taskController.listTodayTasks));

router.post(
  '/',
  [
    body('title').trim().isLength({ min: 2, max: 180 }),
    body('description').optional().isString(),
    body('category').optional().isIn(['DSA', 'Core', 'Project', 'Aptitude', 'Resume', 'MockInterview', 'Other']),
    body('subcategory').optional().isString(),
    body('status').optional().isIn(['pending', 'in_progress', 'completed', 'skipped']),
    body('priority').optional().isIn(['low', 'medium', 'high']),
    body('intensity').optional().isString(),
    body('referenceLabel').optional().isString(),
    body('referenceUrl').optional().isURL(),
    body('dueDate').optional({ values: 'falsy' }).isISO8601(),
    body('scheduledFor').optional({ values: 'falsy' }).isISO8601(),
    body('estimatedMinutes').optional().isInt({ min: 0, max: 720 }),
    body('actualMinutes').optional().isInt({ min: 0, max: 720 }),
    body('difficulty').optional().isInt({ min: 1, max: 5 }),
    body('weakArea').optional().isString(),
    body('aiGenerated').optional().isBoolean(),
    body('metadata').optional().isObject(),
  ],
  validate,
  asyncHandler(taskController.createTask)
);

router.get(
  '/',
  [
    query('date').optional().isString(),
    query('status').optional().isIn(['pending', 'in_progress', 'completed', 'skipped']),
    query('category').optional().isString(),
  ],
  validate,
  asyncHandler(taskController.listTasks)
);

router.get(
  '/:taskId',
  [param('taskId').isUUID()],
  validate,
  asyncHandler(taskController.getTask)
);

router.patch(
  '/:taskId',
  [
    param('taskId').isUUID(),
    body('title').optional().trim().isLength({ min: 2, max: 180 }),
    body('description').optional().isString(),
    body('category').optional().isIn(['DSA', 'Core', 'Project', 'Aptitude', 'Resume', 'MockInterview', 'Other']),
    body('subcategory').optional({ values: 'falsy' }).isString(),
    body('status').optional().isIn(['pending', 'in_progress', 'completed', 'skipped']),
    body('priority').optional().isIn(['low', 'medium', 'high']),
    body('intensity').optional().isString(),
    body('referenceLabel').optional({ values: 'falsy' }).isString(),
    body('referenceUrl').optional({ values: 'falsy' }).isURL(),
    body('dueDate').optional({ values: 'falsy' }).isISO8601(),
    body('scheduledFor').optional({ values: 'falsy' }).isISO8601(),
    body('estimatedMinutes').optional().isInt({ min: 0, max: 720 }),
    body('actualMinutes').optional().isInt({ min: 0, max: 720 }),
    body('difficulty').optional().isInt({ min: 1, max: 5 }),
    body('weakArea').optional({ values: 'falsy' }).isString(),
    body('aiGenerated').optional().isBoolean(),
    body('metadata').optional().isObject(),
  ],
  validate,
  asyncHandler(taskController.updateTask)
);

router.delete(
  '/:taskId',
  [param('taskId').isUUID()],
  validate,
  asyncHandler(taskController.deleteTask)
);

module.exports = router;
