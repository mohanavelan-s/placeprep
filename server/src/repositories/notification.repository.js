const { randomUUID } = require('crypto');
const { query } = require('../config/database');

function getExecutor(client) {
  return client ? client.query.bind(client) : query;
}

const notificationColumns = `
  id,
  user_id AS "userId",
  type,
  message,
  sent_at AS "sentAt",
  metadata->>'emailedAt' AS "emailedAt",
  read,
  read_at AS "readAt",
  delivery_channels AS "deliveryChannels",
  metadata,
  dedupe_key AS "dedupeKey",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function createNotification(payload, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `INSERT INTO notifications (
      id,
      user_id,
      type,
      message,
      sent_at,
      read,
      delivery_channels,
      metadata,
      dedupe_key
    ) VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7, $8)
    ON CONFLICT (user_id, type, dedupe_key)
    DO NOTHING
    RETURNING ${notificationColumns}`,
    [
      randomUUID(),
      payload.userId,
      payload.type,
      payload.message,
      payload.sentAt || new Date().toISOString(),
      payload.deliveryChannels || [],
      payload.metadata || {},
      payload.dedupeKey,
    ]
  );

  return result.rows[0] || null;
}

async function listNotifications(userId, filters = {}) {
  const values = [userId];
  const where = ['user_id = $1'];

  if (filters.unreadOnly) {
    where.push('read = FALSE');
  }

  values.push(Math.min(Math.max(Number(filters.limit || 20), 1), 100));

  const result = await query(
    `SELECT ${notificationColumns}
     FROM notifications
     WHERE ${where.join(' AND ')}
     ORDER BY sent_at DESC
     LIMIT $${values.length}`,
    values
  );

  return result.rows;
}

async function findNotificationsByKeys(userId, notificationKeys = []) {
  if (!notificationKeys.length) {
    return [];
  }

  const types = [...new Set(notificationKeys.map((item) => item.type).filter(Boolean))];
  const dedupeKeys = [...new Set(notificationKeys.map((item) => item.dedupeKey).filter(Boolean))];

  if (!types.length || !dedupeKeys.length) {
    return [];
  }

  const result = await query(
    `SELECT ${notificationColumns}
     FROM notifications
     WHERE user_id = $1
       AND type = ANY($2::TEXT[])
       AND dedupe_key = ANY($3::TEXT[])
     ORDER BY sent_at DESC`,
    [userId, types, dedupeKeys]
  );

  return result.rows;
}

async function markRead(userId, notificationId) {
  const result = await query(
    `UPDATE notifications
     SET read = TRUE,
         read_at = COALESCE(read_at, NOW())
     WHERE user_id = $1
       AND id = $2
     RETURNING ${notificationColumns}`,
    [userId, notificationId]
  );

  return result.rows[0] || null;
}

async function markAllRead(userId) {
  const result = await query(
    `UPDATE notifications
     SET read = TRUE,
         read_at = COALESCE(read_at, NOW())
     WHERE user_id = $1
       AND read = FALSE
     RETURNING id`,
    [userId]
  );

  return result.rowCount;
}

async function markEmailed(notificationIds = []) {
  const ids = notificationIds.filter(Boolean);
  if (!ids.length) {
    return 0;
  }

  const result = await query(
    `UPDATE notifications
     SET metadata = jsonb_set(
       COALESCE(metadata, '{}'::JSONB),
       '{emailedAt}',
       to_jsonb(NOW()::TEXT),
       TRUE
     )
     WHERE id = ANY($1::UUID[])
     RETURNING id`,
    [ids]
  );

  return result.rowCount;
}

module.exports = {
  createNotification,
  findNotificationsByKeys,
  listNotifications,
  markRead,
  markAllRead,
  markEmailed,
  notificationColumns,
};
