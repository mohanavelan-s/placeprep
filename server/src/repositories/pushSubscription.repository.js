const { randomUUID } = require('crypto');

const { query } = require('../config/database');

const pushSubscriptionColumns = `
  id,
  user_id AS "userId",
  endpoint,
  p256dh,
  auth,
  expiration_time AS "expirationTime",
  user_agent AS "userAgent",
  metadata,
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  last_used_at AS "lastUsedAt"
`;

async function upsertSubscription(payload) {
  const result = await query(
    `INSERT INTO push_subscriptions (
      id,
      user_id,
      endpoint,
      p256dh,
      auth,
      expiration_time,
      user_agent,
      metadata,
      last_used_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (endpoint)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      expiration_time = EXCLUDED.expiration_time,
      user_agent = EXCLUDED.user_agent,
      metadata = EXCLUDED.metadata,
      last_used_at = NOW()
    RETURNING ${pushSubscriptionColumns}`,
    [
      randomUUID(),
      payload.userId,
      payload.endpoint,
      payload.p256dh,
      payload.auth,
      payload.expirationTime || null,
      payload.userAgent || null,
      payload.metadata || {},
    ]
  );

  return result.rows[0] || null;
}

async function listByUserId(userId) {
  const result = await query(
    `SELECT ${pushSubscriptionColumns}
     FROM push_subscriptions
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId]
  );

  return result.rows;
}

async function deleteByEndpoint(userId, endpoint) {
  const result = await query(
    `DELETE FROM push_subscriptions
     WHERE user_id = $1
       AND endpoint = $2
     RETURNING ${pushSubscriptionColumns}`,
    [userId, endpoint]
  );

  return result.rows[0] || null;
}

async function deleteByEndpointAnyUser(endpoint) {
  const result = await query(
    `DELETE FROM push_subscriptions
     WHERE endpoint = $1
     RETURNING ${pushSubscriptionColumns}`,
    [endpoint]
  );

  return result.rows[0] || null;
}

async function touchSubscription(endpoint) {
  const result = await query(
    `UPDATE push_subscriptions
     SET last_used_at = NOW()
     WHERE endpoint = $1
     RETURNING ${pushSubscriptionColumns}`,
    [endpoint]
  );

  return result.rows[0] || null;
}

module.exports = {
  upsertSubscription,
  listByUserId,
  deleteByEndpoint,
  deleteByEndpointAnyUser,
  touchSubscription,
  pushSubscriptionColumns,
};
