const inviteService = require('../services/invite.service');

async function previewInvite(req, res) {
  const preview = await inviteService.previewInviteCode(req.query.code);
  res.json({ success: true, data: preview });
}

async function listInvites(req, res) {
  const limit = Number(req.query.limit || 25);
  const invites = await inviteService.listInvites(limit);
  res.json({ success: true, data: invites });
}

async function createInvite(req, res) {
  const invite = await inviteService.generateInvite(req.user, req.body);
  res.status(201).json({ success: true, data: invite });
}

async function createInviteBatch(req, res) {
  const invites = await inviteService.generateInviteBatch(req.user, req.body);
  res.status(201).json({ success: true, data: invites });
}

async function clearInviteHistory(req, res) {
  const result = await inviteService.clearInviteHistory();
  res.json({ success: true, data: result });
}

module.exports = {
  previewInvite,
  listInvites,
  createInvite,
  createInviteBatch,
  clearInviteHistory,
};
