const { randomUUID } = require('crypto');

const { query } = require('../config/database');
const { buildUpdateClause } = require('../utils/sql');

const assessmentColumns = `
  id,
  user_id AS "userId",
  plan_id AS "planId",
  status,
  assessment_type AS "assessmentType",
  duration_minutes AS "durationMinutes",
  weak_spots AS "weakSpots",
  recommendations,
  questions,
  submission,
  score,
  metadata,
  started_at AS "startedAt",
  submitted_at AS "submittedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function getExecutor(client) {
  return client ? client.query.bind(client) : query;
}

function toJsonbValue(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

async function createSession(payload, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `INSERT INTO assessment_sessions (
      id,
      user_id,
      plan_id,
      status,
      assessment_type,
      duration_minutes,
      weak_spots,
      recommendations,
      questions,
      submission,
      score,
      metadata,
      started_at,
      submitted_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )
    RETURNING ${assessmentColumns}`,
    [
      randomUUID(),
      payload.userId,
      payload.planId || null,
      payload.status || 'draft',
      payload.assessmentType || 'mcq',
      payload.durationMinutes ?? 20,
      payload.weakSpots || [],
      toJsonbValue(payload.recommendations, []),
      toJsonbValue(payload.questions, []),
      toJsonbValue(payload.submission, {}),
      payload.score ?? 0,
      toJsonbValue(payload.metadata, {}),
      payload.startedAt || null,
      payload.submittedAt || null,
    ]
  );

  return result.rows[0] || null;
}

async function findById(sessionId, userId, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `SELECT ${assessmentColumns}
     FROM assessment_sessions
     WHERE id = $1
       AND user_id = $2`,
    [sessionId, userId]
  );

  return result.rows[0] || null;
}

async function listByUser(userId, limit = 8, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `SELECT ${assessmentColumns}
     FROM assessment_sessions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
}

async function updateSession(sessionId, userId, updates = {}, client = null) {
  const execute = getExecutor(client);
  const mappedUpdates = {
    plan_id: updates.planId,
    status: updates.status,
    assessment_type: updates.assessmentType,
    duration_minutes: updates.durationMinutes,
    weak_spots: updates.weakSpots,
    recommendations: updates.recommendations === undefined ? undefined : toJsonbValue(updates.recommendations, []),
    questions: updates.questions === undefined ? undefined : toJsonbValue(updates.questions, []),
    submission: updates.submission === undefined ? undefined : toJsonbValue(updates.submission, {}),
    score: updates.score,
    metadata: updates.metadata === undefined ? undefined : toJsonbValue(updates.metadata, {}),
    started_at: updates.startedAt,
    submitted_at: updates.submittedAt,
  };

  const { clause, values } = buildUpdateClause(mappedUpdates);
  if (!clause) {
    return findById(sessionId, userId, client);
  }

  const result = await execute(
    `UPDATE assessment_sessions
     SET ${clause}
     WHERE id = $${values.length + 1}
       AND user_id = $${values.length + 2}
     RETURNING ${assessmentColumns}`,
    [...values, sessionId, userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createSession,
  findById,
  listByUser,
  updateSession,
  assessmentColumns,
};
