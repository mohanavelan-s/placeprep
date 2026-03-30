const powerPocketService = require('../services/powerPocket.service');

async function startSession(req, res) {
  const session = await powerPocketService.startSession(req.user, req.body);
  res.status(201).json({ success: true, data: session });
}

async function endSession(req, res) {
  const session = await powerPocketService.endSession(req.user, req.params.sessionId, req.body);
  res.json({ success: true, data: session });
}

async function getActiveSession(req, res) {
  const session = await powerPocketService.getActiveSession(req.user);
  res.json({ success: true, data: session });
}

async function listSessions(req, res) {
  const sessions = await powerPocketService.listSessions(req.user, req.query);
  res.json({ success: true, data: sessions });
}

module.exports = {
  startSession,
  endSession,
  getActiveSession,
  listSessions,
};
