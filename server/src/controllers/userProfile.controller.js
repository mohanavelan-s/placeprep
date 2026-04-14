const userProfileService = require('../services/userProfile.service');
const webPushService = require('../services/webPush.service');

async function getProfile(req, res) {
  const profile = await userProfileService.getProfile(req.user);
  res.json({ success: true, data: profile });
}

async function upsertProfile(req, res) {
  const profile = await userProfileService.upsertProfile(req.user, req.body);
  res.json({ success: true, data: profile });
}

async function getWebPushConfig(req, res) {
  const config = await webPushService.getWebPushConfig();
  res.json({ success: true, data: config });
}

async function savePushSubscription(req, res) {
  const subscription = await webPushService.saveSubscription(
    req.user,
    req.body.subscription,
    req.get('user-agent')
  );

  res.json({ success: true, data: subscription });
}

async function deletePushSubscription(req, res) {
  const deleted = await webPushService.removeSubscription(req.user, req.body.endpoint);
  res.json({ success: true, data: deleted });
}

module.exports = {
  getProfile,
  upsertProfile,
  getWebPushConfig,
  savePushSubscription,
  deletePushSubscription,
};
