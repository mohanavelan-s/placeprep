const express = require('express');
const { body, query, param } = require('express-validator');

const controller = require('../controllers/apk.controller');
const { apkUploader } = require('../config/multer');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth);

router.get('/latest', asyncHandler(controller.getLatestApk));

router.get(
  '/versions',
  [
    query('limit').optional().isInt({ min: 1, max: 25 }),
  ],
  validate,
  asyncHandler(controller.listApkVersions)
);

router.get(
  '/:id/download',
  [
    param('id').isUUID(),
  ],
  validate,
  asyncHandler(controller.downloadApk)
);

router.post(
  '/',
  requireAdmin,
  apkUploader.single('apk'),
  [
    body('version').optional().isString(),
  ],
  validate,
  asyncHandler(controller.uploadApk)
);

module.exports = router;
