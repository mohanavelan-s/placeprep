const imageRepository = require('../repositories/image.repository');
const { uploadBuffer } = require('./storage.service');
const { normalizeDate } = require('../utils/date');
const AppError = require('../utils/appError');

async function uploadImage(user, file, payload) {
  if (!file) {
    throw new AppError('Image file is required.', 400);
  }

  const uploadResult = await uploadBuffer({
    buffer: file.buffer,
    folder: 'images',
    mimeType: file.mimetype,
    originalName: file.originalname,
    resourceType: 'image',
  });

  return imageRepository.createImage({
    userId: user.id,
    taskId: payload.taskId,
    dailyLogId: payload.dailyLogId,
    secureUrl: uploadResult.secureUrl,
    publicId: uploadResult.publicId,
    assetId: uploadResult.assetId,
    mimeType: file.mimetype,
    format: uploadResult.format,
    bytes: uploadResult.bytes,
    width: uploadResult.width,
    height: uploadResult.height,
    storageProvider: uploadResult.storageProvider,
    proofDate: normalizeDate(payload.proofDate, user.timezone),
    caption: payload.caption,
  });
}

async function listImages(user, filters = {}) {
  return imageRepository.listImages(user.id, {
    date: filters.date ? normalizeDate(filters.date, user.timezone) : undefined,
    limit: filters.limit,
  });
}

module.exports = {
  uploadImage,
  listImages,
};
