const { randomUUID } = require('crypto');

const { query } = require('../config/database');

function getExecutor(client) {
  return client ? client.query.bind(client) : query;
}

const inviteColumns = `
  id,
  code,
  role,
  created_by AS "createdBy",
  expires_at AS "expiresAt",
  used,
  used_by AS "usedBy",
  used_at AS "usedAt",
  metadata,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function createInvite(payload, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `INSERT INTO invites (
      id,
      code,
      role,
      created_by,
      expires_at,
      metadata
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING ${inviteColumns}`,
    [
      randomUUID(),
      payload.code,
      payload.role || 'user',
      payload.createdBy || null,
      payload.expiresAt,
      payload.metadata || {},
    ]
  );

  return result.rows[0];
}

async function findByCode(code, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `SELECT ${inviteColumns}
     FROM invites
     WHERE code = $1`,
    [code]
  );

  return result.rows[0] || null;
}

async function listInvites(limit = 25) {
  const result = await query(
    `SELECT ${inviteColumns}
     FROM invites
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}

async function markInviteUsed(inviteId, userId, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `UPDATE invites
     SET used = TRUE,
         used_by = $1,
         used_at = NOW()
     WHERE id = $2
     RETURNING ${inviteColumns}`,
    [userId, inviteId]
  );

  return result.rows[0] || null;
}

async function deleteInactiveInvites(client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `DELETE FROM invites
     WHERE used = TRUE
        OR expires_at <= NOW()
     RETURNING id`
  );

  return result.rowCount || 0;
}

module.exports = {
  createInvite,
  findByCode,
  listInvites,
  markInviteUsed,
  deleteInactiveInvites,
};
