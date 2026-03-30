const { randomUUID } = require('crypto');

const { query } = require('../config/database');

function getExecutor(client) {
  return client ? client.query.bind(client) : query;
}

const apkColumns = `
  id,
  version,
  file_name AS "fileName",
  file_url AS "fileUrl",
  public_id AS "publicId",
  mime_type AS "mimeType",
  bytes,
  storage_provider AS "storageProvider",
  uploaded_by AS "uploadedBy",
  is_active AS "isActive",
  metadata,
  uploaded_at AS "uploadedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function createVersion(payload, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `INSERT INTO apk_versions (
      id,
      version,
      file_name,
      file_url,
      public_id,
      mime_type,
      bytes,
      storage_provider,
      uploaded_by,
      is_active,
      metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10)
    RETURNING ${apkColumns}`,
    [
      randomUUID(),
      payload.version,
      payload.fileName,
      payload.fileUrl,
      payload.publicId || null,
      payload.mimeType || 'application/vnd.android.package-archive',
      payload.bytes || 0,
      payload.storageProvider || 'local',
      payload.uploadedBy || null,
      payload.metadata || {},
    ]
  );

  return result.rows[0];
}

async function deactivateAll(client = null) {
  const execute = getExecutor(client);
  await execute(
    `UPDATE apk_versions
     SET is_active = FALSE
     WHERE is_active = TRUE`
  );
}

async function findLatestActive() {
  const result = await query(
    `SELECT ${apkColumns}
     FROM apk_versions
     WHERE is_active = TRUE
     ORDER BY uploaded_at DESC
     LIMIT 1`
  );

  return result.rows[0] || null;
}

async function findById(id) {
  const result = await query(
    `SELECT ${apkColumns}
     FROM apk_versions
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
}

async function listVersions(limit = 10) {
  const result = await query(
    `SELECT ${apkColumns}
     FROM apk_versions
     ORDER BY uploaded_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}

module.exports = {
  createVersion,
  deactivateAll,
  findLatestActive,
  findById,
  listVersions,
};
