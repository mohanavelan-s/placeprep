const powerPocketRepository = require('../repositories/powerPocket.repository');
const taskRepository = require('../repositories/task.repository');
const AppError = require('../utils/appError');
const { minutesBetween, normalizeDate } = require('../utils/date');

async function refreshProgress(user) {
  const progressService = require('./progress.service');
  await progressService.refreshProgressStats(user.id, user.timezone);
}

async function startSession(user, payload) {
  const activeSession = await powerPocketRepository.findActiveSession(user.id);
  if (activeSession) {
    throw new AppError('There is already an active Power Pocket session.', 409);
  }

  let title = payload.title;
  if (!title && payload.taskId) {
    const task = await taskRepository.findById(payload.taskId, user.id);
    if (!task) {
      throw new AppError('Assigned task not found.', 404);
    }

    title = task.title;
  }

  const session = await powerPocketRepository.createSession({
    userId: user.id,
    taskId: payload.taskId,
    title,
    notes: payload.notes,
    status: 'active',
    source: payload.source || 'manual',
    startedAt: payload.startedAt ? new Date(payload.startedAt) : new Date(),
  });

  await refreshProgress(user);
  return session;
}

async function endSession(user, sessionId, payload) {
  const session = await powerPocketRepository.findById(sessionId, user.id);

  if (!session) {
    throw new AppError('Power Pocket session not found.', 404);
  }

  if (session.status !== 'active') {
    throw new AppError('This Power Pocket session has already ended.', 400);
  }

  const endedAt = payload.endedAt ? new Date(payload.endedAt) : new Date();
  const durationMinutes = payload.durationMinutes ?? minutesBetween(session.startedAt, endedAt);
  const updatedSession = await powerPocketRepository.updateSession(sessionId, user.id, {
    endedAt,
    durationMinutes,
    notes: payload.notes !== undefined ? payload.notes : session.notes,
    status: payload.status || 'completed',
    taskId: payload.taskId,
    title: payload.title,
  });

  await refreshProgress(user);
  return updatedSession;
}

async function getActiveSession(user) {
  return powerPocketRepository.findActiveSession(user.id);
}

async function listSessions(user, filters = {}) {
  return powerPocketRepository.listSessions(user.id, {
    date: filters.date ? normalizeDate(filters.date, user.timezone) : undefined,
    status: filters.status,
    limit: filters.limit,
  });
}

module.exports = {
  startSession,
  endSession,
  getActiveSession,
  listSessions,
};
