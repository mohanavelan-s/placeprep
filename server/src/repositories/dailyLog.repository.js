const { randomUUID } = require('crypto');
const { query } = require('../config/database');

const logColumns = `
  id,
  user_id AS "userId",
  log_date AS "logDate",
  summary,
  wins,
  blockers,
  mood,
  energy,
  productivity_score AS "productivityScore",
  focus_minutes AS "focusMinutes",
  hours_studied AS "hoursStudied",
  tasks_completed_count AS "tasksCompletedCount",
  notes,
  improvement_plan AS "improvementPlan",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function upsertLog(payload) {
  const result = await query(
    `INSERT INTO daily_logs (
      id,
      user_id,
      log_date,
      summary,
      wins,
      blockers,
      mood,
      energy,
      productivity_score,
      focus_minutes,
      hours_studied,
      tasks_completed_count,
      notes,
      improvement_plan
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )
    ON CONFLICT (user_id, log_date)
    DO UPDATE SET
      summary = EXCLUDED.summary,
      wins = EXCLUDED.wins,
      blockers = EXCLUDED.blockers,
      mood = EXCLUDED.mood,
      energy = EXCLUDED.energy,
      productivity_score = EXCLUDED.productivity_score,
      focus_minutes = EXCLUDED.focus_minutes,
      hours_studied = EXCLUDED.hours_studied,
      tasks_completed_count = EXCLUDED.tasks_completed_count,
      notes = EXCLUDED.notes,
      improvement_plan = EXCLUDED.improvement_plan
    RETURNING ${logColumns}`,
    [
      randomUUID(),
      payload.userId,
      payload.logDate,
      payload.summary || null,
      payload.wins || null,
      payload.blockers || null,
      payload.mood ?? null,
      payload.energy ?? null,
      payload.productivityScore ?? 0,
      payload.focusMinutes ?? 0,
      payload.hoursStudied ?? 0,
      payload.tasksCompletedCount ?? 0,
      payload.notes || null,
      payload.improvementPlan || null,
    ]
  );

  return result.rows[0];
}

async function findByDate(userId, logDate) {
  const result = await query(
    `SELECT ${logColumns}
     FROM daily_logs
     WHERE user_id = $1 AND log_date = $2`,
    [userId, logDate]
  );

  return result.rows[0] || null;
}

async function listLogs(userId, filters = {}) {
  const values = [userId];
  const where = ['user_id = $1'];

  if (filters.date) {
    values.push(filters.date);
    where.push(`log_date = $${values.length}`);
  }

  if (filters.from) {
    values.push(filters.from);
    where.push(`log_date >= $${values.length}`);
  }

  if (filters.to) {
    values.push(filters.to);
    where.push(`log_date <= $${values.length}`);
  }

  const limit = filters.limit || 30;
  values.push(limit);

  const result = await query(
    `SELECT ${logColumns}
     FROM daily_logs
     WHERE ${where.join(' AND ')}
     ORDER BY log_date DESC
     LIMIT $${values.length}`,
    values
  );

  return result.rows;
}

async function deleteLog(logId, userId) {
  const result = await query(
    `DELETE FROM daily_logs
     WHERE id = $1 AND user_id = $2
     RETURNING ${logColumns}`,
    [logId, userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  upsertLog,
  findByDate,
  listLogs,
  deleteLog,
  logColumns,
};
