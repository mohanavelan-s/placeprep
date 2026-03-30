const { randomUUID } = require('crypto');
const { query } = require('../config/database');

const resumeColumns = `
  id,
  user_id AS "userId",
  file_name AS "fileName",
  mime_type AS "mimeType",
  secure_url AS "secureUrl",
  public_id AS "publicId",
  storage_provider AS "storageProvider",
  size_bytes AS "sizeBytes",
  extracted_text AS "extractedText",
  analysis_summary AS "analysisSummary",
  score,
  strengths,
  improvements,
  keywords,
  sections,
  is_active AS "isActive",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function deactivateActiveResumes(userId) {
  await query(
    `UPDATE resumes
     SET is_active = FALSE
     WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );
}

async function createResume(payload) {
  const result = await query(
    `INSERT INTO resumes (
      id,
      user_id,
      file_name,
      mime_type,
      secure_url,
      public_id,
      storage_provider,
      size_bytes,
      extracted_text,
      analysis_summary,
      score,
      strengths,
      improvements,
      keywords,
      sections,
      is_active
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16
    )
    RETURNING ${resumeColumns}`,
    [
      randomUUID(),
      payload.userId,
      payload.fileName || null,
      payload.mimeType || null,
      payload.secureUrl || null,
      payload.publicId || null,
      payload.storageProvider || 'cloudinary',
      payload.sizeBytes ?? 0,
      payload.extractedText || null,
      payload.analysisSummary || null,
      payload.score ?? 0,
      payload.strengths || [],
      payload.improvements || [],
      payload.keywords || [],
      payload.sections || {},
      payload.isActive !== false,
    ]
  );

  return result.rows[0];
}

async function getLatestResume(userId) {
  const result = await query(
    `SELECT ${resumeColumns}
     FROM resumes
     WHERE user_id = $1
     ORDER BY is_active DESC, created_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function listResumes(userId) {
  const result = await query(
    `SELECT ${resumeColumns}
     FROM resumes
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
}

module.exports = {
  deactivateActiveResumes,
  createResume,
  getLatestResume,
  listResumes,
};
