const taskService = require('../services/task.service');

async function createTask(req, res) {
  const task = await taskService.createTask(req.user, req.body);
  res.status(201).json({ success: true, data: task });
}

async function listTasks(req, res) {
  const tasks = await taskService.listTasks(req.user, req.query);
  res.json({ success: true, data: tasks });
}

async function listTodayTasks(req, res) {
  const tasks = await taskService.listTasks(req.user, { ...req.query, date: 'today' });
  res.json({ success: true, data: tasks });
}

async function getTask(req, res) {
  const task = await taskService.getTask(req.user, req.params.taskId);
  res.json({ success: true, data: task });
}

async function updateTask(req, res) {
  const task = await taskService.updateTask(req.user, req.params.taskId, req.body);
  res.json({ success: true, data: task });
}

async function deleteTask(req, res) {
  const task = await taskService.deleteTask(req.user, req.params.taskId);
  res.json({ success: true, data: task });
}

module.exports = {
  createTask,
  listTasks,
  listTodayTasks,
  getTask,
  updateTask,
  deleteTask,
};
