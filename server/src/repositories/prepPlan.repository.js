const { randomUUID } = require('crypto');
const { query } = require('../config/database');

const prepPlanColumns = `
  id,
  user_id AS "userId",
  known_topics AS "knownTopics",
  target_topics AS "targetTopics",
  roadmap,
  tasks,
  resources,
  flashcards,
  time_per_day AS "timePerDay",
  target_role AS "targetRole",
  version,
  is_active AS "isActive",
  source_plan_id AS "sourcePlanId",
  metadata,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function getExecutor(db) {
  return db?.query ? db : { query };
}

async function createPlan(payload, db) {
  const executor = getExecutor(db);
  const result = await executor.query(
    `INSERT INTO prep_plans (
      id,
      user_id,
      known_topics,
      target_topics,
      roadmap,
      tasks,
      resources,
      flashcards,
      time_per_day,
      target_role,
      version,
      is_active,
      source_plan_id,
      metadata
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )
    RETURNING ${prepPlanColumns}`,
    [
      randomUUID(),
      payload.userId,
      JSON.stringify(payload.knownTopics || []),
      JSON.stringify(payload.targetTopics || []),
      JSON.stringify(payload.roadmap || []),
      JSON.stringify(payload.tasks || []),
      JSON.stringify(payload.resources || []),
      JSON.stringify(payload.flashcards || []),
      payload.timePerDay ?? 120,
      payload.targetRole || null,
      payload.version ?? 1,
      payload.isActive !== false,
      payload.sourcePlanId || null,
      payload.metadata || {},
    ]
  );

  return result.rows[0];
}

async function deactivateActivePlans(userId, db) {
  const executor = getExecutor(db);
  await executor.query(
    `UPDATE prep_plans
     SET is_active = FALSE
     WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );
}

async function findById(planId, userId) {
  const result = await query(
    `SELECT ${prepPlanColumns}
     FROM prep_plans
     WHERE id = $1 AND user_id = $2`,
    [planId, userId]
  );

  return result.rows[0] || null;
}

async function findLatestActiveByUser(userId) {
  const result = await query(
    `SELECT ${prepPlanColumns}
     FROM prep_plans
     WHERE user_id = $1 AND is_active = TRUE
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function listByUser(userId, limit = 10) {
  const result = await query(
    `SELECT ${prepPlanColumns}
     FROM prep_plans
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
}

async function getNextVersion(userId, db) {
  const executor = getExecutor(db);
  const result = await executor.query(
    `SELECT COALESCE(MAX(version), 0)::INT AS version
     FROM prep_plans
     WHERE user_id = $1`,
    [userId]
  );

  return Number(result.rows[0]?.version || 0) + 1;
}

async function deleteByUser(userId) {
  const result = await query(
    `DELETE FROM prep_plans
     WHERE user_id = $1
     RETURNING id`,
    [userId]
  );

  return result.rowCount;
}

module.exports = {
  createPlan,
  deactivateActivePlans,
  findById,
  findLatestActiveByUser,
  listByUser,
  getNextVersion,
  deleteByUser,
};
