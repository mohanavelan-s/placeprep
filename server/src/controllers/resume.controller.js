const resumeService = require('../services/resume.service');

async function uploadResume(req, res) {
  const resume = await resumeService.uploadResume(req.user, req.file, req.body);
  res.status(201).json({ success: true, data: resume });
}

async function getLatestResume(req, res) {
  const resume = await resumeService.getLatestResume(req.user);
  res.json({ success: true, data: resume });
}

async function listResumes(req, res) {
  const resumes = await resumeService.listResumes(req.user);
  res.json({ success: true, data: resumes });
}

module.exports = {
  uploadResume,
  getLatestResume,
  listResumes,
};
