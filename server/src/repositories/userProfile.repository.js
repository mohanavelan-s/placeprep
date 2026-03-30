const { randomUUID } = require('crypto');
const { query } = require('../config/database');
const { buildUpdateClause } = require('../utils/sql');

const profileColumns = `
  id,
  user_id AS "userId",
  linkedin_url AS "linkedinUrl",
  github_url AS "githubUrl",
  leetcode_url AS "leetcodeUrl",
  portfolio_url AS "portfolioUrl",
  resume_url AS "resumeUrl",
  avatar_url AS "avatarUrl",
  notifications_enabled AS "notificationsEnabled",
  notification_email_enabled AS "notificationEmailEnabled",
  notification_browser_enabled AS "notificationBrowserEnabled",
  notification_browser_permission AS "notificationBrowserPermission",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function findByUserId(userId) {
  const result = await query(
    `SELECT ${profileColumns}
     FROM user_profiles
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function createProfile(payload) {
  const result = await query(
    `INSERT INTO user_profiles (
      id,
      user_id,
      linkedin_url,
      github_url,
      leetcode_url,
      portfolio_url,
      resume_url,
      avatar_url,
      notifications_enabled,
      notification_email_enabled,
      notification_browser_enabled,
      notification_browser_permission
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING ${profileColumns}`,
    [
      randomUUID(),
      payload.userId,
      payload.linkedinUrl || null,
      payload.githubUrl || null,
      payload.leetcodeUrl || null,
      payload.portfolioUrl || null,
      payload.resumeUrl || null,
      payload.avatarUrl || null,
      payload.notificationsEnabled ?? true,
      payload.notificationEmailEnabled ?? true,
      payload.notificationBrowserEnabled ?? false,
      payload.notificationBrowserPermission || 'default',
    ]
  );

  return result.rows[0];
}

async function updateProfile(userId, updates) {
  const mappedUpdates = {
    linkedin_url: updates.linkedinUrl,
    github_url: updates.githubUrl,
    leetcode_url: updates.leetcodeUrl,
    portfolio_url: updates.portfolioUrl,
    resume_url: updates.resumeUrl,
    avatar_url: updates.avatarUrl,
    notifications_enabled: updates.notificationsEnabled,
    notification_email_enabled: updates.notificationEmailEnabled,
    notification_browser_enabled: updates.notificationBrowserEnabled,
    notification_browser_permission: updates.notificationBrowserPermission,
  };

  const { clause, values } = buildUpdateClause(mappedUpdates);

  if (!clause) {
    return findByUserId(userId);
  }

  const result = await query(
    `UPDATE user_profiles
     SET ${clause}
     WHERE user_id = $${values.length + 1}
     RETURNING ${profileColumns}`,
    [...values, userId]
  );

  return result.rows[0] || null;
}

async function upsertProfile(payload) {
  const existingProfile = await findByUserId(payload.userId);

  if (!existingProfile) {
    return createProfile(payload);
  }

  return updateProfile(payload.userId, payload);
}

module.exports = {
  findByUserId,
  upsertProfile,
};
