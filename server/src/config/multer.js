const multer = require('multer');
const env = require('./env');
const AppError = require('../utils/appError');

const storage = multer.memoryStorage();

function buildUploader(allowedMimeTypes, fileSize = env.maxUploadFileSize) {
  return multer({
    storage,
    limits: {
      fileSize,
    },
    fileFilter: (req, file, callback) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        callback(null, true);
        return;
      }

      callback(new AppError(`Unsupported file type: ${file.mimetype}`, 400));
    },
  });
}

const imageUploader = buildUploader([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
]);

const resumeUploader = buildUploader([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

const apkUploader = buildUploader(
  [
    'application/vnd.android.package-archive',
    'application/octet-stream',
  ],
  env.maxApkUploadFileSize
);

module.exports = {
  imageUploader,
  resumeUploader,
  apkUploader,
};
