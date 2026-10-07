const apkService = require('../services/apk.service');

async function getLatestApk(req, res) {
  const apk = await apkService.getLatestApk();
  res.json({ success: true, data: apk });
}

async function listApkVersions(req, res) {
  const limit = Number(req.query.limit || 10);
  const versions = await apkService.listApkVersions(limit);
  res.json({ success: true, data: versions });
}

async function uploadApk(req, res) {
  const apk = await apkService.uploadApk(req.user, req.file, req.body);
  res.status(201).json({ success: true, data: apk });
}

async function downloadApk(req, res) {
  await apkService.streamApkById(req.params.id, res);
}

module.exports = {
  getLatestApk,
  listApkVersions,
  uploadApk,
  downloadApk,
};
