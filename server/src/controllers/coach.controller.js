const coachService = require('../services/coach.service');

async function listStudents(req, res) {
  const students = await coachService.listStudentsForAdmin(req.user);
  res.json({ success: true, data: students });
}

async function listGroups(req, res) {
  const groups = await coachService.listGroupsForAdmin(req.user);
  res.json({ success: true, data: groups });
}

async function listGroupCandidates(req, res) {
  const candidates = await coachService.listGroupCandidatesForAdmin(req.user);
  res.json({ success: true, data: candidates });
}

async function createGroup(req, res) {
  const group = await coachService.createGroup(req.user, req.body);
  res.status(201).json({ success: true, data: group });
}

async function addGroupMembers(req, res) {
  const group = await coachService.addGroupMembers(
    req.user,
    req.params.groupId,
    req.body.studentUserIds || []
  );
  res.json({ success: true, data: group });
}

async function removeGroupMember(req, res) {
  const group = await coachService.removeGroupMember(req.params.groupId, req.params.studentUserId);
  res.json({ success: true, data: group });
}

async function createPracticeCapsule(req, res) {
  const capsule = await coachService.createPracticeCapsule(req.user, req.body);
  res.status(201).json({ success: true, data: capsule });
}

async function clearStudentProofHistory(req, res) {
  const result = await coachService.clearStudentProofHistory(req.params.studentUserId);
  res.json({ success: true, data: result });
}

module.exports = {
  listStudents,
  listGroups,
  listGroupCandidates,
  createGroup,
  addGroupMembers,
  removeGroupMember,
  createPracticeCapsule,
  clearStudentProofHistory,
};
