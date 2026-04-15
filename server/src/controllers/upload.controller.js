const imageService = require('../services/image.service');

async function uploadImage(req, res) {
  const image = await imageService.uploadImage(req.user, req.file, req.body);
  res.status(201).json({ success: true, data: image });
}

async function listImages(req, res) {
  const images = await imageService.listImages(req.user, req.query);
  res.json({ success: true, data: images });
}

async function clearImagesHistory(req, res) {
  const result = await imageService.clearProofHistory(req.user);
  res.json({ success: true, data: result });
}

module.exports = {
  uploadImage,
  listImages,
  clearImagesHistory,
};
