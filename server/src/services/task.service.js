const taskRepository = require('../repositories/task.repository');
const AppError = require('../utils/appError');
const { getTodayInTimezone, normalizeDate } = require('../utils/date');

async function refreshProgress(user) {
  const progressService = require('./progress.service');
  await progressService.refreshProgressStats(user.id, user.timezone);
}

async function createTask(user, payload) {
  const status = payload.status || 'pending';
  const task = await taskRepository.createTask({
    userId: user.id,
    title: payload.title,
    description: payload.description,
    category: payload.category,
    subcategory: payload.subcategory,
    status,
    priority: payload.priority,
    intensity: payload.intensity,
    referenceLabel: payload.referenceLabel,
    referenceUrl: payload.referenceUrl,
    dueDate: payload.dueDate || null,
    scheduledFor: normalizeDate(payload.scheduledFor, user.timezone),
    estimatedMinutes: payload.estimatedMinutes,
    actualMinutes: payload.actualMinutes,
    difficulty: payload.difficulty,
    weakArea: payload.weakArea,
    aiGenerated: payload.aiGenerated,
    metadata: payload.metadata,
    completedAt: status === 'completed' ? new Date() : null,
  });

  await refreshProgress(user);
  return task;
}

async function listTasks(user, filters = {}) {
  const dateFilter = filters.date === 'today'
    ? getTodayInTimezone(user.timezone)
    : (filters.date ? normalizeDate(filters.date, user.timezone) : undefined);

  return taskRepository.listByUser(user.id, {
    date: dateFilter,
    status: filters.status,
    category: filters.category,
  });
}

async function getTask(user, taskId) {
  const task = await taskRepository.findById(taskId, user.id);

  if (!task) {
    throw new AppError('Task not found.', 404);
  }

  return task;
}

async function updateTask(user, taskId, updates) {
  const existingTask = await getTask(user, taskId);
  const nextStatus = updates.status || existingTask.status;
  const task = await taskRepository.updateTask(taskId, user.id, {
    ...updates,
    scheduledFor: updates.scheduledFor ? normalizeDate(updates.scheduledFor, user.timezone) : undefined,
    completedAt: nextStatus === 'completed'
      ? (updates.completedAt || existingTask.completedAt || new Date())
      : (updates.status && updates.status !== 'completed' ? null : undefined),
  });

  await refreshProgress(user);
  return task;
}

async function deleteTask(user, taskId) {
  const deletedTask = await taskRepository.deleteTask(taskId, user.id);

  if (!deletedTask) {
    throw new AppError('Task not found.', 404);
  }

  await refreshProgress(user);
  return deletedTask;
}

module.exports = {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
};
