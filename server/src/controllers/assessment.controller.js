const assessmentService = require('../services/assessment.service');

async function getOverview(req, res) {
  const overview = await assessmentService.getOverview(req.user);
  res.json({ success: true, data: overview });
}

async function generateAssessment(req, res) {
  const result = await assessmentService.generateAssessment(req.user, req.body || {});
  res.status(201).json({ success: true, data: result });
}

async function submitAssessment(req, res) {
  const session = await assessmentService.submitAssessment(req.user, req.params.assessmentId, req.body || {});
  res.json({ success: true, data: session });
}

async function applyPlanUpdate(req, res) {
  const result = await assessmentService.applyPlanUpdate(req.user, req.params.assessmentId);
  res.json({ success: true, data: result });
}

module.exports = {
  getOverview,
  generateAssessment,
  submitAssessment,
  applyPlanUpdate,
};
