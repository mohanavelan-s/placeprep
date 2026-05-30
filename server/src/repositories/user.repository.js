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
  tier,
  plan_generations AS "planGenerations",
  mentor_messages AS "mentorMessages",
  COALESCE(coach_metadata->>'preferredLanguage', 'english') AS "preferredLanguage",
  COALESCE(coach_metadata->>'accessTier', 'standard') AS "accessTier",
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
      tier,
      plan_generations,
      mentor_messages,
      coach_metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING ${publicColumns}`,
    [
      randomUUID(),
      payload.name,
      payload.username || null,
      payload.role || 'user',
      payload.email,
      payload.passwordHash,
      payload.weakAreas || [],
      payload.strongTopics || [],
      payload.targetRole || null,
      payload.placementDate || null,
      payload.timezone,
      payload.tier || 'free',
      payload.planGenerations ?? 0,
      payload.mentorMessages ?? 0,
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
    tier: updates.tier,
    plan_generations: updates.planGenerations,
    mentor_messages: updates.mentorMessages,
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

async function incrementUsageCounter(userId, counter, amount = 1, client = null) {
  const allowedCounters = new Set(['plan_generations', 'mentor_messages']);
  if (!allowedCounters.has(counter)) {
    throw new Error(`Unsupported usage counter: ${counter}`);
  }

  const execute = getExecutor(client);
  const result = await execute(
    `UPDATE users
     SET ${counter} = ${counter} + $2
     WHERE id = $1
     RETURNING ${publicColumns}`,
    [userId, amount]
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

async function listStudentsForOversight(limit = 40) {
  const result = await query(
    `SELECT
       student.id,
       student.name,
       student.username,
       student.role,
       student.email,
       student.weak_areas AS "weakAreas",
       student.strong_topics AS "strongTopics",
       student.target_role AS "targetRole",
       student.placement_date AS "placementDate",
       student.timezone,
       student.solved_problems AS "solvedProblems",
       student.average_time_per_problem AS "averageTimePerProblem",
       student.failed_attempts AS "failedAttempts",
       student.mistake_count AS "mistakeCount",
       student.consistency_score AS "consistencyScore",
       student.current_streak AS "currentStreak",
       student.readiness_score AS "readinessScore",
       COALESCE(student.coach_metadata->>'accessTier', 'standard') AS "accessTier",
       student.coach_metadata AS "coachMetadata",
       student.last_login_at AS "lastLoginAt",
       student.created_at AS "createdAt",
       student.updated_at AS "updatedAt",
       inviter.id AS "inviterId",
       inviter.name AS "inviterName",
       inviter.username AS "inviterUsername",
       source.code AS "inviteCode",
       source.used_at AS "inviteAcceptedAt"
     FROM users AS student
     LEFT JOIN invites AS source
       ON source.used_by = student.id
     LEFT JOIN users AS inviter
       ON inviter.id = source.created_by
     WHERE student.role = 'user'
       AND COALESCE(student.coach_metadata->>'accessTier', 'standard') <> 'observer'
     ORDER BY student.created_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}

async function listGroupCandidates(limit = 80) {
  const result = await query(
    `SELECT ${publicColumns}
     FROM users
     WHERE role = 'admin'
        OR (
          role = 'user'
          AND COALESCE(coach_metadata->>'accessTier', 'standard') <> 'observer'
        )
     ORDER BY
       CASE WHEN role = 'admin' THEN 0 ELSE 1 END ASC,
       created_at DESC
     LIMIT $1`,
    [limit]
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
  incrementUsageCounter,
  touchLastLogin,
  listUsersForNotificationSweep,
  listStudentsForOversight,
  listGroupCandidates,
};
