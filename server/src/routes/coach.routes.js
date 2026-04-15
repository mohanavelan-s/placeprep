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
router.get('/group-candidates', asyncHandler(controller.listGroupCandidates));

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

router.delete(
  '/students/:studentUserId/proofs',
  [
    param('studentUserId').isUUID(),
  ],
  validate,
  asyncHandler(controller.clearStudentProofHistory)
);

router.post(
  '/practice-capsules',
  [
    body().custom((value, { req }) => {
      const hasStudent = Boolean(req.body.studentUserId);
      const hasGroup = Boolean(req.body.groupId);
      const hasItems = Array.isArray(req.body.items) && req.body.items.length > 0;
      const hasLegacyLinks = Boolean(
        req.body.leetcodeOneUrl
        || req.body.leetcodeTwoUrl
        || req.body.verbalUrl
        || req.body.aptitudeUrl
      );

      if (hasStudent === hasGroup) {
        throw new Error('Choose either one student or one group.');
      }

      if (!hasItems && !hasLegacyLinks) {
        throw new Error('Add at least one task item before assigning.');
      }

      return true;
    }),
    body('studentUserId').optional().isUUID(),
    body('groupId').optional().isUUID(),
    body('title').optional().isString(),
    body('note').optional().isString(),
    body('scheduledFor').optional().isISO8601(),
    body('deadlineAt').optional({ values: 'falsy' }).isISO8601(),
    body('items').optional().isArray({ min: 1, max: 12 }),
    body('items.*.title').optional().isString().trim().isLength({ min: 2, max: 180 }),
    body('items.*.description').optional({ values: 'falsy' }).isString().isLength({ max: 1000 }),
    body('items.*.category').optional().isIn(['DSA', 'Core', 'Project', 'Aptitude', 'Resume', 'MockInterview', 'Other']),
    body('items.*.subcategory').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
    body('items.*.referenceLabel').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
    body('items.*.referenceUrl').optional({ values: 'falsy' }).isURL({ require_protocol: true }),
    body('items.*.estimatedMinutes').optional().isInt({ min: 5, max: 480 }),
    body('items.*.difficulty').optional().isInt({ min: 1, max: 5 }),
    body('items.*.weakArea').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
    body('items.*.type').optional({ values: 'falsy' }).isString().isLength({ max: 60 }),
    body('leetcodeOneUrl').optional({ values: 'falsy' }).isURL({ require_protocol: true }),
    body('leetcodeTwoUrl').optional({ values: 'falsy' }).isURL({ require_protocol: true }),
    body('verbalUrl').optional({ values: 'falsy' }).isURL({ require_protocol: true }),
    body('aptitudeUrl').optional({ values: 'falsy' }).isURL({ require_protocol: true }),
    body('leetcodeOneLabel').optional().isString(),
    body('leetcodeTwoLabel').optional().isString(),
    body('verbalLabel').optional().isString(),
    body('aptitudeLabel').optional().isString(),
  ],
  validate,
  asyncHandler(controller.createPracticeCapsule)
);

module.exports = router;
