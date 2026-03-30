const { randomUUID } = require('crypto');
const { query } = require('../config/database');

const mentorMessageColumns = `
  id,
  user_id AS "userId",
  role,
  content,
  metadata,
  created_at AS "createdAt"
`;

async function createMessage(payload) {
  const result = await query(
    `INSERT INTO mentor_messages (
      id,
      user_id,
      role,
      content,
      metadata
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING ${mentorMessageColumns}`,
    [
      randomUUID(),
      payload.userId,
      payload.role,
      payload.content,
      payload.metadata || {},
    ]
  );

  return result.rows[0];
}

async function listRecentByUser(userId, limit = 20) {
  const result = await query(
    `SELECT ${mentorMessageColumns}
     FROM mentor_messages
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows.reverse();
}

module.exports = {
  createMessage,
  listRecentByUser,
};
