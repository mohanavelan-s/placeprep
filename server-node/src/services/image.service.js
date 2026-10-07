const imageRepository = require('../repositories/image.repository');
const taskRepository = require('../repositories/task.repository');
const { deleteStoredAsset, uploadBuffer } = require('./storage.service');
const { normalizeDate } = require('../utils/date');
const AppError = require('../utils/appError');
const taskVerificationService = require('./taskVerification.service');
const progressService = require('./progress.service');

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

  const image = await imageRepository.createImage({
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

  if (payload.taskId) {
    const task = await taskRepository.findById(payload.taskId, user.id);
    if (task && taskVerificationService.taskSupportsProofVerification(task)) {
      const verificationResult = await taskVerificationService.verifyTaskAgainstProof(user, task, image);

      if (verificationResult?.verification?.verified) {
        await progressService.refreshProgressStats(user.id, user.timezone);
      }

      return {
        ...image,
        verification: verificationResult.verification,
      };
    }
  }

  return image;
}

async function listImages(user, filters = {}) {
  return imageRepository.listImages(user.id, {
    date: filters.date ? normalizeDate(filters.date, user.timezone) : undefined,
    limit: filters.limit,
  });
}

async function clearProofHistoryForUserId(userId) {
  const deletedImages = await imageRepository.deleteProofsByUser(userId);

  await Promise.allSettled(
    deletedImages
      .filter((image) => image.publicId && image.storageProvider)
      .map((image) =>
        deleteStoredAsset({
          publicId: image.publicId,
          storageProvider: image.storageProvider,
          resourceType: 'image',
        })
      )
  );

  return {
    deleted: deletedImages.length,
    clearedAt: new Date().toISOString(),
  };
}

async function clearProofHistory(user) {
  return clearProofHistoryForUserId(user.id);
}

module.exports = {
  uploadImage,
  listImages,
  clearProofHistory,
  clearProofHistoryForUserId,
};
