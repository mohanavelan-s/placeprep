const { randomUUID } = require('crypto');
const { query } = require('../config/database');

const imageColumns = `
  id,
  user_id AS "userId",
  task_id AS "taskId",
  daily_log_id AS "dailyLogId",
  secure_url AS "secureUrl",
  public_id AS "publicId",
  asset_id AS "assetId",
  mime_type AS "mimeType",
  format,
  bytes,
  width,
  height,
  storage_provider AS "storageProvider",
  proof_date AS "proofDate",
  caption,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const proofFilterClause = `COALESCE(caption, '') <> 'profile-avatar'`;

async function createImage(payload) {
  const result = await query(
    `INSERT INTO images (
      id,
      user_id,
      task_id,
      daily_log_id,
      secure_url,
      public_id,
      asset_id,
      mime_type,
      format,
      bytes,
      width,
      height,
      storage_provider,
      proof_date,
      caption
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15
    )
    RETURNING ${imageColumns}`,
    [
      randomUUID(),
      payload.userId,
      payload.taskId || null,
      payload.dailyLogId || null,
      payload.secureUrl,
      payload.publicId,
      payload.assetId || null,
      payload.mimeType || null,
      payload.format || null,
      payload.bytes ?? 0,
      payload.width ?? null,
      payload.height ?? null,
      payload.storageProvider || 'cloudinary',
      payload.proofDate,
      payload.caption || null,
    ]
  );

  return result.rows[0];
}

async function listImages(userId, filters = {}) {
  const values = [userId];
  const where = ['user_id = $1', proofFilterClause];

  if (filters.date) {
    values.push(filters.date);
    where.push(`proof_date = $${values.length}`);
  }

  const limit = filters.limit || 30;
  values.push(limit);

  const result = await query(
    `SELECT ${imageColumns}
     FROM images
     WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${values.length}`,
    values
  );

  return result.rows;
}

async function listRecentByUsers(userIds = [], limitPerUser = 4) {
  if (!userIds.length) {
    return [];
  }

  const result = await query(
    `SELECT * FROM (
       SELECT
         ${imageColumns},
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS row_number
       FROM images
       WHERE user_id = ANY($1::uuid[])
         AND ${proofFilterClause}
     ) AS ranked_images
     WHERE row_number <= $2
     ORDER BY "proofDate" DESC NULLS LAST, "createdAt" DESC`,
    [userIds, limitPerUser]
  );

  return result.rows;
}

async function deleteProofsByUser(userId) {
  const result = await query(
    `DELETE FROM images
     WHERE user_id = $1
       AND ${proofFilterClause}
     RETURNING ${imageColumns}`,
    [userId]
  );

  return result.rows;
}

module.exports = {
  createImage,
  listImages,
  listRecentByUsers,
  deleteProofsByUser,
  imageColumns,
};
