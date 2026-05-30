const { randomUUID } = require('crypto');

const { query } = require('../config/database');
const { buildUpdateClause } = require('../utils/sql');

const codingSubmissionColumns = `
  id,
  user_id AS "userId",
  task_id AS "taskId",
  problem,
  language,
  source_code AS "sourceCode",
  stdin,
  expected_output AS "expectedOutput",
  status,
  stdout,
  stderr,
  compile_output AS "compileOutput",
  judge_token AS "judgeToken",
  time,
  memory,
  test_results AS "testResults",
  analysis,
  rubric,
  score,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function getExecutor(client) {
  return client ? client.query.bind(client) : query;
}

function toJsonbValue(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

async function createSubmission(payload, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `INSERT INTO coding_submissions (
      id,
      user_id,
      task_id,
      problem,
      language,
      source_code,
      stdin,
      expected_output,
      status,
      stdout,
      stderr,
      compile_output,
      judge_token,
      time,
      memory,
      test_results,
      analysis,
      rubric,
      score
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19
    )
    RETURNING ${codingSubmissionColumns}`,
    [
      randomUUID(),
      payload.userId,
      payload.taskId || null,
      toJsonbValue(payload.problem, {}),
      payload.language || 'python',
      payload.sourceCode || '',
      payload.stdin || null,
      payload.expectedOutput || null,
      payload.status || 'queued',
      payload.stdout || null,
      payload.stderr || null,
      payload.compileOutput || null,
      payload.judgeToken || null,
      payload.time ?? null,
      payload.memory ?? null,
      toJsonbValue(payload.testResults, []),
      toJsonbValue(payload.analysis, {}),
      toJsonbValue(payload.rubric, {}),
      payload.score ?? 0,
    ],
  );

  return result.rows[0] || null;
}

async function updateSubmission(submissionId, userId, updates = {}, client = null) {
  const execute = getExecutor(client);
  const mappedUpdates = {
    task_id: updates.taskId,
    problem: updates.problem === undefined ? undefined : toJsonbValue(updates.problem, {}),
    language: updates.language,
    source_code: updates.sourceCode,
    stdin: updates.stdin,
    expected_output: updates.expectedOutput,
    status: updates.status,
    stdout: updates.stdout,
    stderr: updates.stderr,
    compile_output: updates.compileOutput,
    judge_token: updates.judgeToken,
    time: updates.time,
    memory: updates.memory,
    test_results: updates.testResults === undefined ? undefined : toJsonbValue(updates.testResults, []),
    analysis: updates.analysis === undefined ? undefined : toJsonbValue(updates.analysis, {}),
    rubric: updates.rubric === undefined ? undefined : toJsonbValue(updates.rubric, {}),
    score: updates.score,
  };
  const { clause, values } = buildUpdateClause(mappedUpdates);

  if (!clause) {
    return findById(submissionId, userId, client);
  }

  const result = await execute(
    `UPDATE coding_submissions
     SET ${clause}
     WHERE id = $${values.length + 1}
       AND user_id = $${values.length + 2}
     RETURNING ${codingSubmissionColumns}`,
    [...values, submissionId, userId],
  );

  return result.rows[0] || null;
}

async function findById(submissionId, userId, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `SELECT ${codingSubmissionColumns}
     FROM coding_submissions
     WHERE id = $1
       AND user_id = $2`,
    [submissionId, userId],
  );

  return result.rows[0] || null;
}

async function findByIdForAdmin(submissionId, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `SELECT ${codingSubmissionColumns}
     FROM coding_submissions
     WHERE id = $1`,
    [submissionId],
  );

  return result.rows[0] || null;
}

async function listByUser(userId, limit = 20, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `SELECT ${codingSubmissionColumns}
     FROM coding_submissions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );

  return result.rows;
}

async function listByTask(userId, taskId, limit = 10, client = null) {
  const execute = getExecutor(client);
  const result = await execute(
    `SELECT ${codingSubmissionColumns}
     FROM coding_submissions
     WHERE user_id = $1
       AND task_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, taskId, limit],
  );

  return result.rows;
}

async function listSummaryByUsers(userIds = [], limitPerUser = 5, client = null) {
  if (!userIds.length) {
    return [];
  }

  const execute = getExecutor(client);
  const result = await execute(
    `SELECT * FROM (
       SELECT
         ${codingSubmissionColumns},
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS row_number
       FROM coding_submissions
       WHERE user_id = ANY($1::uuid[])
     ) AS ranked_submissions
     WHERE row_number <= $2
     ORDER BY "createdAt" DESC`,
    [userIds, limitPerUser],
  );

  return result.rows;
}

module.exports = {
  createSubmission,
  updateSubmission,
  findById,
  findByIdForAdmin,
  listByUser,
  listByTask,
  listSummaryByUsers,
  codingSubmissionColumns,
};
