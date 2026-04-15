const aiService = require('../services/ai.service');
const prepArchitectService = require('../services/prepArchitect.service');
const mentorService = require('../services/mentor.service');

async function generateTasks(req, res) {
  const result = await aiService.generateTasks(req.user, req.body);
  res.json({ success: true, data: result });
}

async function getStatus(req, res) {
  const status = aiService.getStatus();
  res.json({ success: true, data: status });
}

async function getStuckHelp(req, res) {
  const result = await aiService.getStuckHelp(req.user, req.body);
  res.json({ success: true, data: result });
}

async function evaluateDailyPerformance(req, res) {
  const result = await aiService.evaluateDailyPerformance(req.user, req.body);
  res.json({ success: true, data: result });
}

async function generateQuickTask(req, res) {
  const result = await aiService.generateQuickTask(req.user, req.body);
  res.json({ success: true, data: result });
}

async function generatePrepArchitectPlan(req, res) {
  const result = await prepArchitectService.generatePlan(req.user, req.body);
  res.status(201).json({ success: true, data: result });
}

async function updatePrepArchitectPlan(req, res) {
  const result = await prepArchitectService.updatePlan(req.user, req.body);
  res.json({ success: true, data: result });
}

async function getLatestPrepArchitectPlan(req, res) {
  const result = await prepArchitectService.getLatestPlan(req.user);
  res.json({ success: true, data: result });
}

async function getPrepArchitectHistory(req, res) {
  const result = await prepArchitectService.getPlanHistory(req.user, Number(req.query.limit || 10));
  res.json({ success: true, data: result });
}

async function activatePrepArchitectPlan(req, res) {
  const result = await prepArchitectService.activatePlan(req.user, req.body.planId);
  res.json({ success: true, data: result });
}

async function sendMentorMessage(req, res) {
  const result = await mentorService.sendMessage(req.user, req.body);
  res.json({ success: true, data: result });
}

async function getMentorHistory(req, res) {
  const result = await mentorService.getHistory(req.user);
  res.json({ success: true, data: result });
}

async function clearPrepArchitectHistory(req, res) {
  const result = await prepArchitectService.clearPlanHistory(req.user, req.body?.planIds);
  res.json({ success: true, data: result });
}

async function clearMentorHistory(req, res) {
  const result = await mentorService.clearHistory(req.user);
  res.json({ success: true, data: result });
}

module.exports = {
  generateTasks,
  getStatus,
  getStuckHelp,
  evaluateDailyPerformance,
  generateQuickTask,
  generatePrepArchitectPlan,
  updatePrepArchitectPlan,
  getLatestPrepArchitectPlan,
  getPrepArchitectHistory,
  activatePrepArchitectPlan,
  clearPrepArchitectHistory,
  sendMentorMessage,
  getMentorHistory,
  clearMentorHistory,
};
