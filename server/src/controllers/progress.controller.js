const progressService = require('../services/progress.service');

async function getSummary(req, res) {
  const summary = await progressService.getSummary(req.user);
  res.json({ success: true, data: summary });
}

async function getHistory(req, res) {
  const days = Number(req.query.days || 14);
  const history = await progressService.getHistory(req.user, days);
  res.json({ success: true, data: history });
}

async function clearHistory(req, res) {
  const result = await progressService.clearHistory(req.user);
  res.json({ success: true, data: result });
}

module.exports = {
  getSummary,
  getHistory,
  clearHistory,
};
