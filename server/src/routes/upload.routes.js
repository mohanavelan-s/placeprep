const express = require('express');
const { body, query } = require('express-validator');

const controller = require('../controllers/upload.controller');
const { imageUploader } = require('../config/multer');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth);

router.post(
  '/images',
  imageUploader.single('image'),
  [
    body('taskId').optional().isUUID(),
    body('dailyLogId').optional().isUUID(),
    body('proofDate').optional().isISO8601(),
    body('caption').optional().isString(),
  ],
  validate,
  asyncHandler(controller.uploadImage)
);

router.get(
  '/images',
  [
    query('date').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  asyncHandler(controller.listImages)
);

module.exports = router;
