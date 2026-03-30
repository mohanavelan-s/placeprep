const { randomUUID } = require('crypto');
const { query } = require('../config/database');
const { buildUpdateClause } = require('../utils/sql');

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

async function createTask(payload) {
  const result = await query(
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
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
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
  const where = ['user_id = $1'];

  if (filters.date) {
    values.push(filters.date);
    where.push(`scheduled_for = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    where.push(`status = $${values.length}`);
  }

  if (filters.category) {
    values.push(filters.category);
    where.push(`category = $${values.length}`);
  }

  const result = await query(
    `SELECT ${taskColumns}
     FROM tasks
     WHERE ${where.join(' AND ')}
     ORDER BY scheduled_for ASC, created_at DESC`,
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

module.exports = {
  createTask,
  findById,
  listByUser,
  updateTask,
  deleteTask,
  deleteAiGeneratedByDate,
  taskColumns,
};
