const taskRepository = require('../repositories/task.repository');
const AppError = require('../utils/appError');
const { formatDateInTimezone, getTodayInTimezone, normalizeDate, normalizeDateTime } = require('../utils/date');
const taskVerificationService = require('./taskVerification.service');

function assertAutoVerifiableTaskIsNotManuallyCompleted(task, nextStatus) {
  if (
    nextStatus === 'completed'
    && task?.status !== 'completed'
    && taskVerificationService.canAutoVerifyTask(task)
  ) {
    throw new AppError(
      'This task is auto-verified. Complete it through the linked account sync or by uploading proof.',
      400
    );
  }
}

async function refreshProgress(user, options = {}) {
  const progressService = require('./progress.service');
  await progressService.refreshProgressStats(user.id, user.timezone, options);
}

async function createTask(user, payload) {
  const status = payload.status || 'pending';
  assertAutoVerifiableTaskIsNotManuallyCompleted(payload, status);
  const dueAt = payload.dueAt ? normalizeDateTime(payload.dueAt, user.timezone) : null;
  const scheduledFor = payload.scheduledFor
    ? normalizeDate(payload.scheduledFor, user.timezone)
    : (dueAt ? formatDateInTimezone(new Date(dueAt), user.timezone) : normalizeDate(undefined, user.timezone));
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
    dueDate: payload.dueDate || (dueAt ? formatDateInTimezone(new Date(dueAt), user.timezone) : null),
    dueAt,
    scheduledFor,
    estimatedMinutes: payload.estimatedMinutes,
    actualMinutes: payload.actualMinutes,
    difficulty: payload.difficulty,
    weakArea: payload.weakArea,
    aiGenerated: payload.aiGenerated,
    metadata: payload.metadata,
    completedAt: status === 'completed' ? new Date() : null,
  });

  await refreshProgress(user, { skipAutoVerification: true });
  return task;
}

async function listTasks(user, filters = {}) {
  const dateFilter = filters.date === 'today'
    ? getTodayInTimezone(user.timezone)
    : (filters.date ? normalizeDate(filters.date, user.timezone) : undefined);

  if (dateFilter === getTodayInTimezone(user.timezone) && !filters.status && !filters.category) {
    const prepArchitectService = require('./prepArchitect.service');
    await prepArchitectService.ensureTodayTasksForActivePlan(user);
  }

  const tasks = await taskRepository.listByUser(user.id, {
    date: dateFilter,
    status: filters.status,
    category: filters.category,
  });

  const autoVerifiedTaskIds = await taskVerificationService.autoVerifyOpenTasksFromLeetCode(user, { tasks });
  if (autoVerifiedTaskIds.length) {
    await refreshProgress(user, { skipAutoVerification: true });

    return taskRepository.listByUser(user.id, {
      date: dateFilter,
      status: filters.status,
      category: filters.category,
    });
  }

  return tasks;
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
  assertAutoVerifiableTaskIsNotManuallyCompleted(existingTask, nextStatus);
  const dueAt = updates.dueAt ? normalizeDateTime(updates.dueAt, user.timezone) : undefined;
  const task = await taskRepository.updateTask(taskId, user.id, {
    ...updates,
    dueAt,
    dueDate: updates.dueDate
      || (dueAt ? formatDateInTimezone(new Date(dueAt), user.timezone) : undefined),
    scheduledFor: updates.scheduledFor
      ? normalizeDate(updates.scheduledFor, user.timezone)
      : (dueAt ? formatDateInTimezone(new Date(dueAt), user.timezone) : undefined),
    completedAt: nextStatus === 'completed'
      ? (updates.completedAt || existingTask.completedAt || new Date())
      : (updates.status && updates.status !== 'completed' ? null : undefined),
  });

  await refreshProgress(user, { skipAutoVerification: true });
  return task;
}

async function deleteTask(user, taskId) {
  const deletedTask = await taskRepository.deleteTask(taskId, user.id);

  if (!deletedTask) {
    throw new AppError('Task not found.', 404);
  }

  await refreshProgress(user, { skipAutoVerification: true });
  return deletedTask;
}

module.exports = {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
};
