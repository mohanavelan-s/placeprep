const dailyLogRepository = require('../repositories/dailyLog.repository');
const taskRepository = require('../repositories/task.repository');
const AppError = require('../utils/appError');
const { normalizeDate } = require('../utils/date');

async function refreshProgress(user) {
  const progressService = require('./progress.service');
  await progressService.refreshProgressStats(user.id, user.timezone);
}

async function upsertLog(user, payload) {
  const logDate = normalizeDate(payload.logDate, user.timezone);

  let tasksCompletedCount = payload.tasksCompletedCount;
  if (tasksCompletedCount === undefined) {
    const tasks = await taskRepository.listByUser(user.id, { date: logDate });
    tasksCompletedCount = tasks.filter((task) => task.status === 'completed').length;
  }

  const log = await dailyLogRepository.upsertLog({
    userId: user.id,
    logDate,
    summary: payload.summary,
    wins: payload.wins,
    blockers: payload.blockers,
    mood: payload.mood,
    energy: payload.energy,
    productivityScore: payload.productivityScore,
    focusMinutes: payload.focusMinutes,
    hoursStudied: payload.hoursStudied,
    tasksCompletedCount,
    notes: payload.notes,
    improvementPlan: payload.improvementPlan,
  });

  await refreshProgress(user);
  return log;
}

async function listLogs(user, filters = {}) {
  return dailyLogRepository.listLogs(user.id, {
    date: filters.date ? normalizeDate(filters.date, user.timezone) : undefined,
    from: filters.from ? normalizeDate(filters.from, user.timezone) : undefined,
    to: filters.to ? normalizeDate(filters.to, user.timezone) : undefined,
    limit: filters.limit,
  });
}

async function getLogByDate(user, logDate) {
  const log = await dailyLogRepository.findByDate(user.id, normalizeDate(logDate, user.timezone));

  if (!log) {
    throw new AppError('Daily log not found.', 404);
  }

  return log;
}

async function deleteLog(user, logId) {
  const deletedLog = await dailyLogRepository.deleteLog(logId, user.id);

  if (!deletedLog) {
    throw new AppError('Daily log not found.', 404);
  }

  await refreshProgress(user);
  return deletedLog;
}

module.exports = {
  upsertLog,
  listLogs,
  getLogByDate,
  deleteLog,
};
