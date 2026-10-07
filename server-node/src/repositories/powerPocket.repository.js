const { randomUUID } = require('crypto');
const { query } = require('../config/database');

const sessionColumns = `
  id,
  user_id AS "userId",
  task_id AS "taskId",
  title,
  notes,
  status,
  source,
  started_at AS "startedAt",
  ended_at AS "endedAt",
  duration_minutes AS "durationMinutes",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function createSession(payload) {
  const result = await query(
    `INSERT INTO power_pocket_sessions (
      id,
      user_id,
      task_id,
      title,
      notes,
      status,
      source,
      started_at,
      ended_at,
      duration_minutes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING ${sessionColumns}`,
    [
      randomUUID(),
      payload.userId,
      payload.taskId || null,
      payload.title || null,
      payload.notes || null,
      payload.status || 'active',
      payload.source || 'manual',
      payload.startedAt || new Date(),
      payload.endedAt || null,
      payload.durationMinutes ?? 0,
    ]
  );

  return result.rows[0];
}

async function findActiveSession(userId) {
  const result = await query(
    `SELECT ${sessionColumns}
     FROM power_pocket_sessions
     WHERE user_id = $1 AND status = 'active'
     ORDER BY started_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function findById(sessionId, userId) {
  const result = await query(
    `SELECT ${sessionColumns}
     FROM power_pocket_sessions
     WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );

  return result.rows[0] || null;
}

async function updateSession(sessionId, userId, updates) {
  const fields = [];
  const values = [];

  Object.entries({
    task_id: updates.taskId,
    title: updates.title,
    notes: updates.notes,
    status: updates.status,
    source: updates.source,
    started_at: updates.startedAt,
    ended_at: updates.endedAt,
    duration_minutes: updates.durationMinutes,
  }).forEach(([column, value]) => {
    if (value !== undefined) {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    }
  });

  if (!fields.length) {
    return findById(sessionId, userId);
  }

  values.push(sessionId, userId);

  const result = await query(
    `UPDATE power_pocket_sessions
     SET ${fields.join(', ')}
     WHERE id = $${values.length - 1} AND user_id = $${values.length}
     RETURNING ${sessionColumns}`,
    values
  );

  return result.rows[0] || null;
}

async function listSessions(userId, filters = {}) {
  const values = [userId];
  const where = ['user_id = $1'];

  if (filters.date) {
    values.push(filters.date);
    where.push(`DATE(started_at) = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    where.push(`status = $${values.length}`);
  }

  const limit = filters.limit || 25;
  values.push(limit);

  const result = await query(
    `SELECT ${sessionColumns}
     FROM power_pocket_sessions
     WHERE ${where.join(' AND ')}
     ORDER BY started_at DESC
     LIMIT $${values.length}`,
    values
  );

  return result.rows;
}

module.exports = {
  createSession,
  findActiveSession,
  findById,
  updateSession,
  listSessions,
  sessionColumns,
};
