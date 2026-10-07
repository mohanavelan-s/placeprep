const authService = require('../services/auth.service');

async function register(req, res) {
  const result = await authService.register(req.body);
  res.status(201).json({ success: true, data: result });
}

async function login(req, res) {
  const result = await authService.login(req.body);
  res.json({ success: true, data: result });
}

async function me(req, res) {
  const user = await authService.getProfile(req.user.id);
  res.json({ success: true, data: user });
}

async function updateMe(req, res) {
  const user = await authService.updateProfile(req.user.id, req.body);
  res.json({ success: true, data: user });
}

module.exports = {
  register,
  login,
  me,
  updateMe,
};
