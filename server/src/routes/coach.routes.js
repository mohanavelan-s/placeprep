const express = require('express');
const { body, param } = require('express-validator');

const controller = require('../controllers/coach.controller');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/students', asyncHandler(controller.listStudents));
router.get('/groups', asyncHandler(controller.listGroups));

router.post(
  '/groups',
  [
    body('name').isString().trim().isLength({ min: 2, max: 120 }),
    body('description').optional({ values: 'falsy' }).isString(),
    body('studentUserIds').optional().isArray(),
    body('studentUserIds.*').optional().isUUID(),
  ],
  validate,
  asyncHandler(controller.createGroup)
);

router.post(
  '/groups/:groupId/members',
  [
    param('groupId').isUUID(),
    body('studentUserIds').isArray({ min: 1 }),
    body('studentUserIds.*').isUUID(),
  ],
  validate,
  asyncHandler(controller.addGroupMembers)
);

router.delete(
  '/groups/:groupId/members/:studentUserId',
  [
    param('groupId').isUUID(),
    param('studentUserId').isUUID(),
  ],
  validate,
  asyncHandler(controller.removeGroupMember)
);

router.post(
  '/practice-capsules',
  [
    body().custom((value, { req }) => {
      const hasStudent = Boolean(req.body.studentUserId);
      const hasGroup = Boolean(req.body.groupId);

      if (hasStudent === hasGroup) {
        throw new Error('Choose either one student or one group.');
      }

      return true;
    }),
    body('studentUserId').optional().isUUID(),
    body('groupId').optional().isUUID(),
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
