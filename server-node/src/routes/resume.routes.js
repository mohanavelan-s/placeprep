const express = require('express');
const { body } = require('express-validator');

const controller = require('../controllers/resume.controller');
const { resumeUploader } = require('../config/multer');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth);

router.post(
  '/',
  resumeUploader.single('resume'),
  [
    body('resumeText').optional().isString(),
    body('targetRole').optional().isString(),
    body('jobDescription').optional().isString(),
  ],
  validate,
  asyncHandler(controller.uploadResume)
);

router.post(
  '/match',
  [
    body('jobDescription').trim().isLength({ min: 20, max: 12000 }),
    body('targetRole').optional().isString(),
    body('resumeText').optional().isString(),
  ],
  validate,
  asyncHandler(controller.scoreAgainstJobDescription)
);

router.get('/latest', asyncHandler(controller.getLatestResume));
router.get('/', asyncHandler(controller.listResumes));
router.delete('/history', asyncHandler(controller.clearHistory));

module.exports = router;
