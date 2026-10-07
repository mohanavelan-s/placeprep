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

async function listLatestByUsers(userIds = []) {
  if (!userIds.length) {
    return [];
  }

  const result = await query(
    `SELECT DISTINCT ON (user_id) ${statColumns}
     FROM progress_stats
     WHERE user_id = ANY($1::uuid[])
     ORDER BY user_id, stat_date DESC, created_at DESC`,
    [userIds]
  );

  return result.rows;
}

async function listHistoryByUsers(userIds = [], limitPerUser = 14) {
  if (!userIds.length) {
    return [];
  }

  const result = await query(
    `SELECT * FROM (
       SELECT
         ${statColumns},
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY stat_date DESC, created_at DESC
         ) AS row_number
       FROM progress_stats
       WHERE user_id = ANY($1::uuid[])
     ) AS ranked_stats
     WHERE row_number <= $2
     ORDER BY "createdAt" DESC`,
    [userIds, limitPerUser]
  );

  return result.rows;
}

async function deleteHistory(userId) {
  const result = await query(
    `DELETE FROM progress_stats
     WHERE user_id = $1
     RETURNING id`,
    [userId]
  );

  return result.rowCount;
}

async function deleteHistoryByUserIds(userIds = [], client = null) {
  if (!userIds.length) {
    return 0;
  }

  const execute = client?.query ? client.query.bind(client) : query;
  const result = await execute(
    `DELETE FROM progress_stats
     WHERE user_id = ANY($1::uuid[])
     RETURNING id`,
    [userIds]
  );

  return result.rowCount || 0;
}

async function deleteHistoryByIds(userIds = [], entryIds = [], client = null) {
  if (!userIds.length || !entryIds.length) {
    return 0;
  }

  const execute = client?.query ? client.query.bind(client) : query;
  const result = await execute(
    `DELETE FROM progress_stats
     WHERE user_id = ANY($1::uuid[])
       AND id = ANY($2::uuid[])
     RETURNING id`,
    [userIds, entryIds]
  );

  return result.rowCount || 0;
}

module.exports = {
  upsertProgressStat,
  listHistory,
  listLatestByUsers,
  listHistoryByUsers,
  deleteHistory,
  deleteHistoryByUserIds,
  deleteHistoryByIds,
};
