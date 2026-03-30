const { randomUUID } = require('crypto');
const { query } = require('../config/database');

const notificationColumns = `
  id,
  user_id AS "userId",
  type,
  message,
  sent_at AS "sentAt",
  read,
  read_at AS "readAt",
  delivery_channels AS "deliveryChannels",
  metadata,
  dedupe_key AS "dedupeKey",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function createNotification(payload) {
  const result = await query(
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

module.exports = {
  createNotification,
  listNotifications,
  markRead,
  markAllRead,
  notificationColumns,
};
