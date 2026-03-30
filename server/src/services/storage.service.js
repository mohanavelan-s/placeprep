const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const env = require('../config/env');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

function inferExtension(originalName, mimeType) {
  const fileExtension = path.extname(originalName || '');
  if (fileExtension) {
    return fileExtension;
  }

  const mimeMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/vnd.android.package-archive': '.apk',
    'application/octet-stream': '.apk',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };

  return mimeMap[mimeType] || '';
}

async function uploadToCloudinary(options) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: options.resourceType || 'auto',
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
          assetId: result.asset_id,
          format: result.format,
          bytes: result.bytes,
          width: result.width || null,
          height: result.height || null,
          storageProvider: 'cloudinary',
        });
      }
    );

    uploadStream.end(options.buffer);
  });
}

async function uploadToLocal(options) {
  const folderPath = path.join(env.uploadDir, options.folder);
  await fs.mkdir(folderPath, { recursive: true });

  const extension = inferExtension(options.originalName, options.mimeType);
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const absolutePath = path.join(folderPath, fileName);
  await fs.writeFile(absolutePath, options.buffer);

  return {
    secureUrl: `/uploads/${options.folder}/${fileName}`,
    publicId: `local:${options.folder}/${fileName}`,
    assetId: null,
    format: extension.replace('.', '') || null,
    bytes: options.buffer.length,
    width: null,
    height: null,
    storageProvider: 'local',
    relativePath: `${options.folder}/${fileName}`,
  };
}

async function uploadBuffer(options) {
  if (isCloudinaryConfigured) {
    return uploadToCloudinary(options);
  }

  return uploadToLocal(options);
}

module.exports = {
  uploadBuffer,
};
