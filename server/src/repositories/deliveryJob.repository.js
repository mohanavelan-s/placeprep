const { randomUUID } = require('crypto');
const { query } = require('../config/database');

function getExecutor(client) {
  return client ? client.query.bind(client) : query;
}

function buildDeliveryJobColumns(alias = '') {
  const prefix = alias ? `${alias}.` : '';

  return `
    ${prefix}id,
    ${prefix}type,
    ${prefix}dedupe_key AS "dedupeKey",
    ${prefix}status,
    ${prefix}attempts,
    ${prefix}max_attempts AS "maxAttempts",
    ${prefix}available_at AS "availableAt",
    ${prefix}locked_at AS "lockedAt",
    ${prefix}locked_by AS "lockedBy",
    ${prefix}payload,
    ${prefix}last_error AS "lastError",
    ${prefix}created_at AS "createdAt",
    ${prefix}updated_at AS "updatedAt"
  `;
}

const deliveryJobColumns = buildDeliveryJobColumns();

async function createJob(payload, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `INSERT INTO delivery_jobs (
      id,
      type,
      dedupe_key,
      status,
      attempts,
      max_attempts,
      available_at,
      payload
    ) VALUES ($1, $2, $3, 'queued', 0, $4, COALESCE($5, NOW()), $6)
    ON CONFLICT (type, dedupe_key)
    DO NOTHING
    RETURNING ${deliveryJobColumns}`,
    [
      randomUUID(),
      payload.type,
      payload.dedupeKey || null,
      Number(payload.maxAttempts || 5),
      payload.availableAt || null,
      payload.payload || {},
    ]
  );

  return result.rows[0] || null;
}

async function claimJobs(limit = 10, workerId = 'delivery-worker') {
  const result = await query(
    `WITH next_jobs AS (
       SELECT id
       FROM delivery_jobs
       WHERE status = 'queued'
         AND available_at <= NOW()
       ORDER BY available_at ASC, created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE delivery_jobs AS jobs
     SET
       status = 'processing',
       attempts = jobs.attempts + 1,
       locked_at = NOW(),
       locked_by = $2,
       last_error = NULL
     FROM next_jobs
     WHERE jobs.id = next_jobs.id
     RETURNING ${buildDeliveryJobColumns('jobs')}`,
    [Math.min(Math.max(Number(limit || 10), 1), 100), workerId]
  );

  return result.rows;
}

async function completeJob(jobId) {
  const result = await query(
    `UPDATE delivery_jobs
     SET
       status = 'completed',
       locked_at = NULL,
       locked_by = NULL,
       last_error = NULL
     WHERE id = $1
     RETURNING ${deliveryJobColumns}`,
    [jobId]
  );

  return result.rows[0] || null;
}

async function releaseJob(jobId, lastError, nextAvailableAt) {
  const result = await query(
    `UPDATE delivery_jobs
     SET
       status = CASE
         WHEN attempts >= max_attempts THEN 'failed'
         ELSE 'queued'
       END,
       available_at = CASE
         WHEN attempts >= max_attempts THEN available_at
         ELSE COALESCE($3, NOW() + INTERVAL '5 minutes')
       END,
       locked_at = NULL,
       locked_by = NULL,
       last_error = $2
     WHERE id = $1
     RETURNING ${deliveryJobColumns}`,
    [jobId, lastError || null, nextAvailableAt || null]
  );

  return result.rows[0] || null;
}

module.exports = {
  createJob,
  claimJobs,
  completeJob,
  releaseJob,
  deliveryJobColumns,
};
