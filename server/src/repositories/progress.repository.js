const { randomUUID } = require('crypto');
const { query } = require('../config/database');

const statColumns = `
  id,
  user_id AS "userId",
  stat_date AS "statDate",
  streak,
  bonus_streak AS "bonusStreak",
  consistency_score AS "consistencyScore",
  readiness_score AS "readinessScore",
  execution_rate AS "executionRate",
  total_hours AS "totalHours",
  tasks_completed AS "tasksCompleted",
  power_pocket_minutes AS "powerPocketMinutes",
  metadata,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function upsertProgressStat(payload) {
  const result = await query(
    `INSERT INTO progress_stats (
      id,
      user_id,
      stat_date,
      streak,
      bonus_streak,
      consistency_score,
      readiness_score,
      execution_rate,
      total_hours,
      tasks_completed,
      power_pocket_minutes,
      metadata
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
    )
    ON CONFLICT (user_id, stat_date)
    DO UPDATE SET
      streak = EXCLUDED.streak,
      bonus_streak = EXCLUDED.bonus_streak,
      consistency_score = EXCLUDED.consistency_score,
      readiness_score = EXCLUDED.readiness_score,
      execution_rate = EXCLUDED.execution_rate,
      total_hours = EXCLUDED.total_hours,
      tasks_completed = EXCLUDED.tasks_completed,
      power_pocket_minutes = EXCLUDED.power_pocket_minutes,
      metadata = EXCLUDED.metadata
    RETURNING ${statColumns}`,
    [
      randomUUID(),
      payload.userId,
      payload.statDate,
      payload.streak ?? 0,
      payload.bonusStreak ?? 0,
      payload.consistencyScore ?? 0,
      payload.readinessScore ?? 0,
      payload.executionRate ?? 0,
      payload.totalHours ?? 0,
      payload.tasksCompleted ?? 0,
      payload.powerPocketMinutes ?? 0,
      payload.metadata || {},
    ]
  );

  return result.rows[0];
}

async function listHistory(userId, limit = 14) {
  const result = await query(
    `SELECT ${statColumns}
     FROM progress_stats
     WHERE user_id = $1
     ORDER BY stat_date DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
}

module.exports = {
  upsertProgressStat,
  listHistory,
};
