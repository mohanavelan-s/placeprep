const { randomUUID } = require('crypto');
const { query } = require('../config/database');
const { buildUpdateClause } = require('../utils/sql');

function getExecutor(client) {
  return client ? client.query.bind(client) : query;
}

const publicColumns = `
  id,
  name,
  username,
  role,
  email,
  weak_areas AS "weakAreas",
  strong_topics AS "strongTopics",
  target_role AS "targetRole",
  placement_date AS "placementDate",
  timezone,
  solved_problems AS "solvedProblems",
  average_time_per_problem AS "averageTimePerProblem",
  failed_attempts AS "failedAttempts",
  mistake_count AS "mistakeCount",
  consistency_score AS "consistencyScore",
  current_streak AS "currentStreak",
  readiness_score AS "readinessScore",
  coach_metadata AS "coachMetadata",
  last_login_at AS "lastLoginAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const authColumns = `
  ${publicColumns},
  password_hash AS "passwordHash"
`;

async function createUser(payload, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `INSERT INTO users (
      id,
      name,
      username,
      role,
      email,
      password_hash,
      weak_areas,
      strong_topics,
      target_role,
      placement_date,
      timezone,
      coach_metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING ${publicColumns}`,
    [
      randomUUID(),
      payload.name,
      payload.username || null,
      payload.role || 'viewer',
      payload.email,
      payload.passwordHash,
      payload.weakAreas || [],
      payload.strongTopics || [],
      payload.targetRole || null,
      payload.placementDate || null,
      payload.timezone,
      payload.coachMetadata || {},
    ]
  );

  return result.rows[0];
}

async function findByEmail(email) {
  const result = await query(
    `SELECT ${authColumns}
     FROM users
     WHERE email = $1`,
    [email]
  );

  return result.rows[0] || null;
}

async function findByUsername(username) {
  const result = await query(
    `SELECT ${authColumns}
     FROM users
     WHERE LOWER(username) = LOWER($1)`,
    [username]
  );

  return result.rows[0] || null;
}

async function findByIdentifier(identifier) {
  const normalized = String(identifier || '').trim();
  if (!normalized) {
    return null;
  }

  if (normalized.includes('@')) {
    return findByEmail(normalized.toLowerCase());
  }

  return findByUsername(normalized);
}

async function findById(id) {
  const result = await query(
    `SELECT ${publicColumns}
     FROM users
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
}

async function updateUser(id, updates) {
  const mappedUpdates = {
    name: updates.name,
    username: updates.username,
    role: updates.role,
    weak_areas: updates.weakAreas,
    strong_topics: updates.strongTopics,
    target_role: updates.targetRole,
    placement_date: updates.placementDate,
    timezone: updates.timezone,
    solved_problems: updates.solvedProblems,
    average_time_per_problem: updates.averageTimePerProblem,
    failed_attempts: updates.failedAttempts,
    mistake_count: updates.mistakeCount,
    consistency_score: updates.consistencyScore,
    current_streak: updates.currentStreak,
    readiness_score: updates.readinessScore,
    coach_metadata: updates.coachMetadata,
    last_login_at: updates.lastLoginAt,
  };

  const { clause, values } = buildUpdateClause(mappedUpdates);

  if (!clause) {
    return findById(id);
  }

  const result = await query(
    `UPDATE users
     SET ${clause}
     WHERE id = $${values.length + 1}
     RETURNING ${publicColumns}`,
    [...values, id]
  );

  return result.rows[0] || null;
}

async function touchLastLogin(id) {
  const result = await query(
    `UPDATE users
     SET last_login_at = NOW()
     WHERE id = $1
     RETURNING ${authColumns}`,
    [id]
  );

  return result.rows[0] || null;
}

async function listUsersForNotificationSweep() {
  const result = await query(
    `SELECT
       ${publicColumns},
       COALESCE(user_profiles.notifications_enabled, TRUE) AS "notificationsEnabled",
       COALESCE(user_profiles.notification_email_enabled, TRUE) AS "notificationEmailEnabled",
       COALESCE(user_profiles.notification_browser_enabled, FALSE) AS "notificationBrowserEnabled",
       COALESCE(user_profiles.notification_browser_permission, 'default') AS "notificationBrowserPermission"
     FROM users
     LEFT JOIN user_profiles
       ON user_profiles.user_id = users.id
     WHERE COALESCE(user_profiles.notifications_enabled, TRUE) = TRUE
     ORDER BY users.created_at ASC`
  );

  return result.rows;
}

module.exports = {
  createUser,
  findByEmail,
  findByUsername,
  findByIdentifier,
  findById,
  updateUser,
  touchLastLogin,
  listUsersForNotificationSweep,
};
