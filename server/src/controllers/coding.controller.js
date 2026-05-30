const codingService = require('../services/coding.service');

async function resolveProblem(req, res) {
  const problem = await codingService.resolveProblem(req.body || {});
  res.json({ success: true, data: problem });
}

async function listLanguages(req, res) {
  const languages = await codingService.getLanguages();
  res.json({ success: true, data: languages });
}

async function getTask(req, res) {
  const taskWorkspace = await codingService.getCodingTask(req.user, req.params.taskId);
  res.json({ success: true, data: taskWorkspace });
}

async function createRun(req, res) {
  const run = await codingService.runCode(req.user, req.body || {});
  res.status(201).json({ success: true, data: run });
}

async function getRun(req, res) {
  const run = await codingService.getRun(req.user, req.params.runId);
  res.json({ success: true, data: run });
}

async function submitCode(req, res) {
  const submission = await codingService.submitCode(req.user, req.body || {});
  res.status(201).json({ success: true, data: submission });
}

async function listSubmissions(req, res) {
  const submissions = await codingService.listSubmissions(req.user, req.query || {});
  res.json({ success: true, data: submissions });
}

module.exports = {
  resolveProblem,
  listLanguages,
  getTask,
  createRun,
  getRun,
  submitCode,
  listSubmissions,
};
