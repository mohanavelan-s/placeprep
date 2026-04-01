const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { Readable } = require('stream');

const { isCloudinaryConfigured } = require('../config/cloudinary');
const env = require('../config/env');
const { withTransaction } = require('../config/database');
const apkVersionRepository = require('../repositories/apkVersion.repository');
const { uploadBuffer } = require('./storage.service');
const AppError = require('../utils/appError');

function buildDownloadPath(apk) {
  return `/api/apk/${apk.id}/download`;
}

function decorateApk(apk) {
  if (!apk) {
    return null;
  }

  return {
    ...apk,
    downloadPath: buildDownloadPath(apk),
  };
}

function resolveVersion(fileName, providedVersion) {
  if (providedVersion) {
    return String(providedVersion).trim();
  }

  return `v${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}`;
}

async function uploadApkLocally(file) {
  const privateRoot = path.join(env.uploadDir, '..', 'private-uploads', 'apk');
  await fsp.mkdir(privateRoot, { recursive: true });

  const extension = path.extname(file.originalname || '') || '.apk';
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const absolutePath = path.join(privateRoot, fileName);
  await fsp.writeFile(absolutePath, file.buffer);

  return {
    secureUrl: `private://apk/${fileName}`,
    publicId: `private:apk/${fileName}`,
    bytes: file.size || file.buffer.length,
    storageProvider: 'local_private',
    relativePath: fileName,
  };
}

async function uploadApk(user, file, payload) {
  if (!file) {
    throw new AppError('APK file is required.', 400);
  }

  let uploadResult;

  if (isCloudinaryConfigured) {
    try {
      uploadResult = await uploadBuffer({
        buffer: file.buffer,
        folder: 'apk',
        mimeType: file.mimetype,
        originalName: file.originalname,
        resourceType: 'raw',
      });
    } catch (error) {
      const cloudinaryMessage = String(error?.message || '');
      const shouldFallbackToLocal =
        /File size too large/i.test(cloudinaryMessage)
        || /Maximum is 10485760/i.test(cloudinaryMessage);

      if (!shouldFallbackToLocal) {
        throw error;
      }

      uploadResult = await uploadApkLocally(file);
    }
  } else {
    uploadResult = await uploadApkLocally(file);
  }

  const savedVersion = await withTransaction(async (client) => {
    await apkVersionRepository.deactivateAll(client);

    return apkVersionRepository.createVersion(
      {
        version: resolveVersion(file.originalname, payload.version),
        fileName: file.originalname,
        fileUrl: uploadResult.secureUrl,
        publicId: uploadResult.publicId,
        mimeType: file.mimetype,
        bytes: uploadResult.bytes || file.size || 0,
        storageProvider: uploadResult.storageProvider,
        uploadedBy: user.id,
        metadata: {
          relativePath: uploadResult.relativePath || null,
        },
      },
      client
    );
  });

  return decorateApk(savedVersion);
}

async function getLatestApk() {
  const apk = await apkVersionRepository.findLatestActive();
  return decorateApk(apk);
}

async function listApkVersions(limit = 10) {
  const versions = await apkVersionRepository.listVersions(limit);
  return versions.map(decorateApk);
}

async function getApkVersion(id) {
  const apk = await apkVersionRepository.findById(id);

  if (!apk) {
    throw new AppError('APK version not found.', 404);
  }

  return apk;
}

async function pipeRemoteFile(url, res) {
  const response = await fetch(url);

  if (!response.ok || !response.body) {
    throw new AppError('Unable to download APK from storage.', 502);
  }

  const nodeStream = Readable.fromWeb(response.body);
  nodeStream.pipe(res);
}

async function streamApkById(id, res) {
  const apk = await getApkVersion(id);
  res.setHeader('Content-Type', apk.mimeType || 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', `attachment; filename="${apk.fileName || 'placeprep-app.apk'}"`);

    if (apk.storageProvider.startsWith('local')) {
      const relativePath = apk.metadata?.relativePath;

      if (!relativePath) {
        throw new AppError('Stored APK path is missing.', 500);
      }

      const baseRoot = apk.storageProvider === 'local_private'
        ? path.join(env.uploadDir, '..', 'private-uploads', 'apk')
        : env.uploadDir;
      const absolutePath = path.join(baseRoot, relativePath);

    if (!fs.existsSync(absolutePath)) {
      throw new AppError('Stored APK file is no longer available.', 404);
    }

    fs.createReadStream(absolutePath).pipe(res);
    return;
  }

  await pipeRemoteFile(apk.fileUrl, res);
}

module.exports = {
  uploadApk,
  getLatestApk,
  listApkVersions,
  streamApkById,
};
