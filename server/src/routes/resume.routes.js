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

router.get('/latest', asyncHandler(controller.getLatestResume));
router.get('/', asyncHandler(controller.listResumes));

module.exports = router;
