const { randomUUID } = require('crypto');

const { query } = require('../config/database');
const { buildUpdateClause } = require('../utils/sql');

function getExecutor(client) {
  return client ? client.query.bind(client) : query;
}

const baseGroupColumns = `
  coach_groups.id,
  coach_groups.name,
  coach_groups.description,
  coach_groups.created_by AS "createdBy",
  coach_groups.metadata,
  coach_groups.created_at AS "createdAt",
  coach_groups.updated_at AS "updatedAt"
`;

const groupColumns = `
  ${baseGroupColumns},
  creator.name AS "createdByName"
`;

const groupMemberColumns = `
  coach_group_members.group_id AS "groupId",
  coach_group_members.user_id AS "userId",
  student.name,
  student.username,
  student.email,
  student.target_role AS "targetRole",
  student.readiness_score AS "readinessScore",
  COALESCE(student.coach_metadata->>'accessTier', 'standard') AS "accessTier",
  coach_group_members.added_by AS "addedBy",
  admin.name AS "addedByName",
  coach_group_members.created_at AS "createdAt"
`;

async function createGroup(payload, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `INSERT INTO coach_groups (
      id,
      name,
      description,
      created_by,
      metadata
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING ${baseGroupColumns}`,
    [
      randomUUID(),
      payload.name,
      payload.description || null,
      payload.createdBy || null,
      payload.metadata || {},
    ]
  );

  return result.rows[0] || null;
}

async function findGroupById(groupId, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `SELECT ${groupColumns}
     FROM coach_groups
     LEFT JOIN users AS creator
       ON creator.id = coach_groups.created_by
     WHERE coach_groups.id = $1`,
    [groupId]
  );

  return result.rows[0] || null;
}

async function findGroupByNormalizedName(name, client = null) {
  const execute = getExecutor(client);
  const normalizedName = String(name || '').trim();
  if (!normalizedName) {
    return null;
  }

  const result = await execute(
    `SELECT ${groupColumns}
     FROM coach_groups
     LEFT JOIN users AS creator
       ON creator.id = coach_groups.created_by
     WHERE LOWER(coach_groups.name) = LOWER($1)
     LIMIT 1`,
    [normalizedName]
  );

  return result.rows[0] || null;
}

async function listGroups() {
  const result = await query(
    `SELECT ${groupColumns}
     FROM coach_groups
     LEFT JOIN users AS creator
       ON creator.id = coach_groups.created_by
     ORDER BY coach_groups.created_at DESC, LOWER(coach_groups.name) ASC`
  );

  return result.rows;
}

async function updateGroup(groupId, updates, client = null) {
  const execute = getExecutor(client);
  const mappedUpdates = {
    name: updates.name,
    description: updates.description,
    metadata: updates.metadata,
  };

  const { clause, values } = buildUpdateClause(mappedUpdates);
  if (!clause) {
    return findGroupById(groupId, client);
  }

  const result = await execute(
    `UPDATE coach_groups
     SET ${clause}
     WHERE id = $${values.length + 1}
     RETURNING ${baseGroupColumns}`,
    [...values, groupId]
  );

  const updatedGroup = result.rows[0] || null;
  return updatedGroup ? findGroupById(updatedGroup.id, client) : null;
}

async function addMembers(groupId, userIds = [], addedBy = null, client = null) {
  if (!userIds.length) {
    return [];
  }

  const execute = getExecutor(client);
  const result = await execute(
    `INSERT INTO coach_group_members (
      group_id,
      user_id,
      added_by
    )
    SELECT $1, member_id, $3
    FROM UNNEST($2::UUID[]) AS member_id
    ON CONFLICT (group_id, user_id) DO NOTHING
    RETURNING group_id AS "groupId", user_id AS "userId"`,
    [groupId, userIds, addedBy]
  );

  return result.rows;
}

async function removeMember(groupId, userId, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `DELETE FROM coach_group_members
     WHERE group_id = $1
       AND user_id = $2
     RETURNING group_id AS "groupId", user_id AS "userId"`,
    [groupId, userId]
  );

  return result.rows[0] || null;
}

async function listMembershipsByUserIds(userIds = [], client = null) {
  if (!userIds.length) {
    return [];
  }

  const execute = getExecutor(client);
  const result = await execute(
    `SELECT
       coach_group_members.group_id AS "groupId",
       coach_group_members.user_id AS "userId",
       coach_groups.name AS "groupName"
     FROM coach_group_members
     JOIN coach_groups
       ON coach_groups.id = coach_group_members.group_id
     WHERE coach_group_members.user_id = ANY($1::UUID[])`,
    [userIds]
  );

  return result.rows;
}

async function listMembers(groupIds = []) {
  if (!groupIds.length) {
    return [];
  }

  const result = await query(
    `SELECT ${groupMemberColumns}
     FROM coach_group_members
     JOIN users AS student
       ON student.id = coach_group_members.user_id
     LEFT JOIN users AS admin
       ON admin.id = coach_group_members.added_by
     WHERE coach_group_members.group_id = ANY($1::UUID[])
       AND student.role = 'user'
       AND COALESCE(student.coach_metadata->>'accessTier', 'standard') <> 'observer'
     ORDER BY coach_group_members.group_id ASC, LOWER(student.name) ASC`,
    [groupIds]
  );

  return result.rows;
}

module.exports = {
  createGroup,
  findGroupById,
  findGroupByNormalizedName,
  listGroups,
  updateGroup,
  addMembers,
  removeMember,
  listMembershipsByUserIds,
  listMembers,
  groupColumns,
  groupMemberColumns,
};
