const userProfileService = require('../services/userProfile.service');

async function getProfile(req, res) {
  const profile = await userProfileService.getProfile(req.user);
  res.json({ success: true, data: profile });
}

async function upsertProfile(req, res) {
  const profile = await userProfileService.upsertProfile(req.user, req.body);
  res.json({ success: true, data: profile });
}

module.exports = {
  getProfile,
  upsertProfile,
};
