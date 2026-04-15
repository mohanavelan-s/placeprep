const { randomUUID } = require('crypto');
const { query } = require('../config/database');
const { buildUpdateClause } = require('../utils/sql');
const { buildPrepArchitectTaskVisibilityClause } = require('../utils/taskVisibility');

function getExecutor(client) {
  return client ? client.query.bind(client) : query;
}

const taskColumns = `
  id,
  user_id AS "userId",
  title,
  description,
  category,
  subcategory,
  status,
  priority,
  intensity,
  reference_label AS "referenceLabel",
  reference_url AS "referenceUrl",
  due_date AS "dueDate",
  due_at AS "dueAt",
  scheduled_for AS "scheduledFor",
  estimated_minutes AS "estimatedMinutes",
  actual_minutes AS "actualMinutes",
  difficulty,
  weak_area AS "weakArea",
  ai_generated AS "aiGenerated",
  metadata,
  completed_at AS "completedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function createTask(payload, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `INSERT INTO tasks (
      id,
      user_id,
      title,
      description,
      category,
      subcategory,
      status,
      priority,
      intensity,
      reference_label,
      reference_url,
      due_date,
      due_at,
      scheduled_for,
      estimated_minutes,
      actual_minutes,
      difficulty,
      weak_area,
      ai_generated,
      metadata,
      completed_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
    )
    RETURNING ${taskColumns}`,
    [
      randomUUID(),
      payload.userId,
      payload.title,
      payload.description || null,
      payload.category || 'DSA',
      payload.subcategory || null,
      payload.status || 'pending',
      payload.priority || 'medium',
      payload.intensity || 'medium',
      payload.referenceLabel || null,
      payload.referenceUrl || null,
      payload.dueDate || null,
      payload.dueAt || null,
      payload.scheduledFor,
      payload.estimatedMinutes ?? 30,
      payload.actualMinutes ?? 0,
      payload.difficulty ?? 3,
      payload.weakArea || null,
      Boolean(payload.aiGenerated),
      payload.metadata || {},
      payload.completedAt || null,
    ]
  );

  return result.rows[0];
}

async function findById(taskId, userId) {
  const result = await query(
    `SELECT ${taskColumns}
     FROM tasks
     WHERE id = $1 AND user_id = $2`,
    [taskId, userId]
  );

  return result.rows[0] || null;
}

async function listByUser(userId, filters = {}) {
  const values = [userId];
  const where = ['tasks.user_id = $1'];

  if (filters.date) {
    values.push(filters.date);
    where.push(`tasks.scheduled_for = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    where.push(`tasks.status = $${values.length}`);
  }

  if (filters.category) {
    values.push(filters.category);
    where.push(`tasks.category = $${values.length}`);
  }

  const prepArchitectVisibility = buildPrepArchitectTaskVisibilityClause({
    taskRef: 'tasks',
    activePlanRef: 'user_context.active_plan_id',
  });

  const result = await query(
    `WITH user_context AS (
       SELECT COALESCE(coach_metadata->>'prepArchitectPlanId', '') AS active_plan_id
       FROM users
       WHERE id = $1
     )
     SELECT ${taskColumns}
     FROM tasks, user_context
     WHERE ${where.join(' AND ')}
       AND ${prepArchitectVisibility}
     ORDER BY COALESCE(tasks.due_at, tasks.scheduled_for::timestamp) ASC, tasks.created_at DESC`,
    values
  );

  return result.rows;
}

async function updateTask(taskId, userId, updates) {
  const mappedUpdates = {
    title: updates.title,
    description: updates.description,
    category: updates.category,
    subcategory: updates.subcategory,
    status: updates.status,
    priority: updates.priority,
    intensity: updates.intensity,
    reference_label: updates.referenceLabel,
    reference_url: updates.referenceUrl,
    due_date: updates.dueDate,
    due_at: updates.dueAt,
    scheduled_for: updates.scheduledFor,
    estimated_minutes: updates.estimatedMinutes,
    actual_minutes: updates.actualMinutes,
    difficulty: updates.difficulty,
    weak_area: updates.weakArea,
    ai_generated: updates.aiGenerated,
    metadata: updates.metadata,
    completed_at: updates.completedAt,
  };

  const { clause, values } = buildUpdateClause(mappedUpdates);

  if (!clause) {
    return findById(taskId, userId);
  }

  const result = await query(
    `UPDATE tasks
     SET ${clause}
     WHERE id = $${values.length + 1} AND user_id = $${values.length + 2}
     RETURNING ${taskColumns}`,
    [...values, taskId, userId]
  );

  return result.rows[0] || null;
}

async function deleteTask(taskId, userId) {
  const result = await query(
    `DELETE FROM tasks
     WHERE id = $1 AND user_id = $2
     RETURNING ${taskColumns}`,
    [taskId, userId]
  );

  return result.rows[0] || null;
}

async function deleteAiGeneratedByDate(userId, scheduledFor) {
  const result = await query(
    `DELETE FROM tasks
     WHERE user_id = $1
       AND scheduled_for = $2
       AND ai_generated = TRUE
       AND status IN ('pending', 'in_progress')
     RETURNING id`,
    [userId, scheduledFor]
  );

  return result.rowCount || 0;
}

async function listPrepArchitectTasksByPlanAndDate(userId, planId, scheduledFor, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `SELECT ${taskColumns}
     FROM tasks
     WHERE user_id = $1
       AND scheduled_for = $2
       AND COALESCE(metadata->>'source', '') = 'prep-architect'
       AND COALESCE(metadata->>'planId', '') = $3
     ORDER BY created_at ASC`,
    [userId, scheduledFor, planId]
  );

  return result.rows;
}

async function listRecentPrepArchitectTasksByPlan(userId, planId, limit = 24, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `SELECT ${taskColumns}
     FROM tasks
     WHERE user_id = $1
       AND COALESCE(metadata->>'source', '') = 'prep-architect'
       AND COALESCE(metadata->>'planId', '') = $2
     ORDER BY scheduled_for DESC, created_at DESC
     LIMIT $3`,
    [userId, planId, limit]
  );

  return result.rows;
}

async function deletePrepArchitectTasksByPlanIds(userId, planIds = [], client = null) {
  if (!planIds.length) {
    return 0;
  }

  const execute = getExecutor(client);
  const result = await execute(
    `DELETE FROM tasks
     WHERE user_id = $1
       AND COALESCE(metadata->>'source', '') = 'prep-architect'
       AND COALESCE(metadata->>'planId', '') = ANY($2::text[])
     RETURNING id`,
    [userId, planIds]
  );

  return result.rowCount || 0;
}

async function listSummaryByUsers(userIds = []) {
  if (!userIds.length) {
    return [];
  }

  const prepArchitectVisibility = buildPrepArchitectTaskVisibilityClause({
    taskRef: 'tasks',
    activePlanRef: "COALESCE(owner.coach_metadata->>'prepArchitectPlanId', '')",
    includeInactiveCompleted: true,
  });

  const result = await query(
    `SELECT
       user_id AS "userId",
       COUNT(*)::INT AS total,
       COUNT(*) FILTER (WHERE status = 'pending')::INT AS pending,
       COUNT(*) FILTER (WHERE status = 'in_progress')::INT AS "inProgress",
       COUNT(*) FILTER (WHERE status = 'completed')::INT AS completed,
       COUNT(*) FILTER (WHERE status = 'skipped')::INT AS skipped,
       COUNT(*) FILTER (
         WHERE status IN ('pending', 'in_progress')
           AND (
             (due_at IS NOT NULL AND due_at < NOW())
             OR (due_at IS NULL AND scheduled_for < CURRENT_DATE)
           )
       )::INT AS overdue
     FROM tasks
     JOIN users AS owner
       ON owner.id = tasks.user_id
     WHERE user_id = ANY($1::uuid[])
       AND ${prepArchitectVisibility}
     GROUP BY user_id`,
    [userIds]
  );

  return result.rows;
}

async function listRecentAdminPracticeTasksByUsers(userIds = [], limitPerUser = 12) {
  if (!userIds.length) {
    return [];
  }

  const result = await query(
    `SELECT * FROM (
       SELECT
         ${taskColumns},
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS row_number
       FROM tasks
       WHERE user_id = ANY($1::uuid[])
         AND metadata->>'shareKind' IN ('admin-practice-link', 'admin-assignment')
     ) AS ranked_tasks
     WHERE row_number <= $2
     ORDER BY "createdAt" DESC`,
    [userIds, limitPerUser]
  );

  return result.rows;
}

module.exports = {
  createTask,
  findById,
  listByUser,
  updateTask,
  deleteTask,
  deleteAiGeneratedByDate,
  listPrepArchitectTasksByPlanAndDate,
  listRecentPrepArchitectTasksByPlan,
  deletePrepArchitectTasksByPlanIds,
  listSummaryByUsers,
  listRecentAdminPracticeTasksByUsers,
  taskColumns,
};
