const coachService = require('../services/coach.service');

async function listStudents(req, res) {
  const students = await coachService.listStudentsForAdmin(req.user);
  res.json({ success: true, data: students });
}

async function createPracticeCapsule(req, res) {
  const capsule = await coachService.createPracticeCapsule(req.user, req.body);
  res.status(201).json({ success: true, data: capsule });
}

module.exports = {
  listStudents,
  createPracticeCapsule,
};
