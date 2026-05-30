const env = require('../config/env');
const assessmentRepository = require('../repositories/assessment.repository');
const codingSubmissionRepository = require('../repositories/codingSubmission.repository');
const prepPlanRepository = require('../repositories/prepPlan.repository');
const taskRepository = require('../repositories/task.repository');
const AppError = require('../utils/appError');
const judge0Service = require('./judge0.service');
const progressService = require('./progress.service');

const SQL_LANGUAGES = new Set(['mysql', 'postgresql']);
const DEFAULT_STARTER_CODE = {
  python: '# Write your solution here\n',
  c: '#include <stdio.h>\n\nint main(void) {\n  return 0;\n}\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  return 0;\n}\n',
  java: 'class Main {\n  public static void main(String[] args) {\n  }\n}\n',
  mysql: '-- Write your MySQL query here\n',
  postgresql: '-- Write your PostgreSQL query here\n',
};

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return normalizeText(value).replace(/\s+/g, '-').replace(/[+#]/g, '').slice(0, 80) || 'practice-problem';
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function isSqlLanguage(language) {
  return SQL_LANGUAGES.has(judge0Service.normalizeLanguageKey(language));
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<pre>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripSecrets(value) {
  return String(value || '')
    .replace(/(sk-[a-zA-Z0-9_-]{16,})/g, '[redacted-secret]')
    .replace(/((?:api|access|auth|secret|token|password|passwd|pwd)[\w-]*\s*[:=]\s*)["']?[^"'\s]{8,}/gi, '$1[redacted-secret]')
    .slice(0, 12000);
}

function assertPayloadSize(sourceCode, stdin = '') {
  const sourceBytes = Buffer.byteLength(String(sourceCode || ''), 'utf8');
  const stdinBytes = Buffer.byteLength(String(stdin || ''), 'utf8');

  if (!sourceCode || !String(sourceCode).trim()) {
    throw new AppError('Source code is required before execution.', 400);
  }

  if (sourceBytes > env.judge0MaxSourceBytes) {
    throw new AppError(`Source code is too large. Keep it under ${env.judge0MaxSourceBytes} bytes.`, 413);
  }

  if (stdinBytes > env.judge0MaxStdinBytes) {
    throw new AppError(`Input is too large. Keep stdin under ${env.judge0MaxStdinBytes} bytes.`, 413);
  }
}

function extractLeetCodeSlug(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const urlMatch = text.match(/leetcode\.com\/problems\/([^/?#]+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1].trim();
  }

  if (/^[a-z0-9-]+$/i.test(text) && text.includes('-')) {
    return text.toLowerCase();
  }

  return '';
}

function inferPlatform(value) {
  const text = String(value || '').trim();
  if (/leetcode\.com/i.test(text)) {
    return 'leetcode';
  }
  if (/hackerrank\.com/i.test(text)) {
    return 'hackerrank';
  }
  if (/codechef\.com/i.test(text)) {
    return 'codechef';
  }
  return 'custom';
}

function normalizeProblemPayload(payload = {}) {
  const source = payload.url || payload.slug || payload.title || payload.problemTitle || payload.problemNumber || '';
  const platform = payload.platform || inferPlatform(source);
  const leetCodeSlug = extractLeetCodeSlug(payload.url || payload.slug || payload.title);
  const title = String(payload.title || payload.problemTitle || '').trim()
    || (leetCodeSlug ? leetCodeSlug.split('-').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ') : '')
    || String(payload.url || payload.slug || 'Practice problem').trim();

  return {
    platform,
    number: payload.number || payload.problemNumber || null,
    slug: leetCodeSlug || String(payload.slug || '').trim() || slugify(title),
    title,
    url: String(payload.url || (leetCodeSlug ? `https://leetcode.com/problems/${leetCodeSlug}/` : '')).trim() || null,
    description: String(payload.description || '').trim(),
    difficulty: String(payload.difficulty || '').trim() || null,
    examples: toArray(payload.examples),
    constraints: toArray(payload.constraints),
    starterCode: payload.starterCode && typeof payload.starterCode === 'object' ? payload.starterCode : {},
  };
}

async function fetchLeetCodeProblem(titleSlug) {
  const response = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: `
        query questionData($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            questionFrontendId
            title
            titleSlug
            content
            difficulty
            exampleTestcases
            topicTags { name }
          }
        }
      `,
      variables: { titleSlug },
    }),
  });

  if (!response.ok) {
    throw new Error(`LeetCode responded with ${response.status}`);
  }

  const json = await response.json();
  const question = json?.data?.question;
  if (!question) {
    throw new Error('Question was not found on LeetCode.');
  }

  return {
    platform: 'leetcode',
    number: question.questionFrontendId || null,
    slug: question.titleSlug || titleSlug,
    title: question.title || titleSlug,
    url: `https://leetcode.com/problems/${question.titleSlug || titleSlug}/`,
    description: stripHtml(question.content || ''),
    difficulty: question.difficulty || null,
    examples: String(question.exampleTestcases || '')
      .split(/\n{2,}/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 3),
    constraints: toArray(question.topicTags).map((tag) => tag?.name).filter(Boolean).slice(0, 8),
  };
}

async function resolveProblem(payload = {}) {
  const normalizedProblem = normalizeProblemPayload(payload);

  if (normalizedProblem.platform === 'leetcode' && normalizedProblem.slug) {
    try {
      return {
        ...normalizedProblem,
        ...(await fetchLeetCodeProblem(normalizedProblem.slug)),
        extractionStatus: 'resolved',
      };
    } catch (error) {
      return {
        ...normalizedProblem,
        extractionStatus: 'fallback',
        extractionMessage: 'Live LeetCode extraction was unavailable, so PlacePrep built the workspace from the provided title or URL.',
      };
    }
  }

  return {
    ...normalizedProblem,
    extractionStatus: normalizedProblem.description ? 'provided' : 'manual',
  };
}

function problemFromTask(task) {
  const metadata = task?.metadata || {};
  return normalizeProblemPayload({
    platform: metadata.problemPlatform || metadata.platform || inferPlatform(task?.referenceUrl || task?.referenceLabel || task?.title),
    number: metadata.problemNumber || null,
    slug: metadata.problemSlug || metadata.slug || extractLeetCodeSlug(task?.referenceUrl || task?.referenceLabel || task?.title),
    title: metadata.problemTitle || task?.referenceLabel || task?.title,
    url: task?.referenceUrl || metadata.problemUrl || null,
    description: task?.description || metadata.summary || '',
    difficulty: task?.difficulty >= 4 ? 'Hard' : task?.difficulty <= 2 ? 'Easy' : 'Medium',
  });
}

async function getCodingTask(user, taskId) {
  const task = await taskRepository.findById(taskId, user.id);
  if (!task) {
    throw new AppError('Coding task not found.', 404);
  }

  const [languages, submissions] = await Promise.all([
    getLanguages(),
    codingSubmissionRepository.listByTask(user.id, taskId, 8),
  ]);

  return {
    task,
    problem: await resolveProblem(problemFromTask(task)),
    languages,
    submissions,
  };
}

async function getLanguages() {
  const discovered = await judge0Service.listLanguages();

  return discovered.map((language) => ({
    ...language,
    setupWarning: !language.enabled && isSqlLanguage(language.key)
      ? 'SQL execution not configured on this Judge0 provider. Static SQL analysis is still available.'
      : language.unavailableReason,
  }));
}

function detectComplexity(sourceCode) {
  const source = String(sourceCode || '');
  const lower = source.toLowerCase();

  if (/o\s*\(\s*(1|log\s*n|n|n\s*log\s*n|n\^2|n2)\s*\)/i.test(source)) {
    return source.match(/o\s*\([^)]*\)/i)?.[0] || 'mentioned';
  }

  const loopCount = (source.match(/\b(for|while)\b/g) || []).length;
  if (loopCount >= 2 && /for[\s\S]*for|while[\s\S]*while|for[\s\S]*while|while[\s\S]*for/.test(lower)) {
    return 'likely O(n^2)';
  }
  if (loopCount === 1) {
    return 'likely O(n)';
  }
  if (/\b(select|join|group by|order by)\b/i.test(source)) {
    return 'query-plan dependent';
  }
  return 'not stated';
}

function scoreComplexity(sourceCode, status) {
  const source = String(sourceCode || '');
  const complexity = detectComplexity(source);
  let score = 55;

  if (/o\s*\(/i.test(source)) {
    score += 20;
  }
  if (/\b(hash|map|set|queue|stack|heap|binary search|two pointer|window|index|join|group by)\b/i.test(source)) {
    score += 12;
  }
  if (/likely O\(n\^2\)/i.test(complexity) && !/o\s*\(\s*n\^?2/i.test(source)) {
    score -= 15;
  }
  if (['compile_error', 'runtime_error', 'timeout'].includes(status)) {
    score -= 18;
  }

  return clampScore(score);
}

function scoreLogic(sourceCode, status, problem) {
  const source = String(sourceCode || '');
  let score = 45;

  if (source.trim().length > 120) {
    score += 12;
  }
  if (/\b(if|else|case|switch|where|having)\b/i.test(source)) {
    score += 10;
  }
  if (/\b(empty|null|edge|boundary|duplicate|negative|overflow|constraint)\b/i.test(source)) {
    score += 10;
  }
  if (/\b(return|print|select)\b/i.test(source)) {
    score += 8;
  }
  if (problem?.description && normalizeText(source).includes(normalizeText(problem.title).split(' ')[0])) {
    score += 5;
  }
  if (status === 'accepted') {
    score += 10;
  }
  if (['compile_error', 'runtime_error', 'timeout'].includes(status)) {
    score -= 20;
  }

  return clampScore(score);
}

function scoreReadability(sourceCode) {
  const source = String(sourceCode || '');
  const lines = source.split('\n');
  let score = 55;

  if (lines.length >= 4 && lines.length <= 90) {
    score += 12;
  }
  if (/\b[a-z][a-zA-Z0-9_]{2,}\b/.test(source)) {
    score += 10;
  }
  if (lines.some((line) => /^\s{2,}\S/.test(line)) || /\n\s+(SELECT|FROM|WHERE|JOIN)/i.test(source)) {
    score += 8;
  }
  if (source.length > 12000) {
    score -= 20;
  }
  if ((source.match(/;/g) || []).length > 0 || /\b(def|class|function|int main|public static|select)\b/i.test(source)) {
    score += 8;
  }

  return clampScore(score);
}

function compareOutput(stdout, expectedOutput) {
  if (!String(expectedOutput || '').trim()) {
    return null;
  }

  const normalizeOutput = (value) => String(value || '').replace(/\r\n/g, '\n').trim();
  return normalizeOutput(stdout) === normalizeOutput(expectedOutput);
}

function buildRubric({ sourceCode, status, stdout, expectedOutput, compileOutput, stderr, problem }) {
  const outputMatched = compareOutput(stdout, expectedOutput);
  const accepted = status === 'accepted';
  const failedAtRuntime = ['compile_error', 'runtime_error', 'timeout', 'failed'].includes(status);
  const executionScore = status === 'accepted'
    ? 100
    : status === 'wrong_answer'
      ? 42
      : status === 'compile_error'
        ? 18
        : status === 'timeout'
          ? 12
          : status === 'runtime_error'
            ? 20
            : status === 'analysis_only'
              ? 30
              : 25;
  const correctnessScore = outputMatched === true
    ? 100
    : outputMatched === false
      ? 20
      : accepted
        ? 70
        : failedAtRuntime
          ? 10
          : 45;
  const complexityScore = scoreComplexity(sourceCode, status);
  const logicScore = scoreLogic(sourceCode, status, problem);
  const readabilityScore = scoreReadability(sourceCode);
  const finalScore = clampScore(
    correctnessScore * 0.45
    + executionScore * 0.2
    + complexityScore * 0.15
    + logicScore * 0.15
    + readabilityScore * 0.05,
  );
  const recommendations = [];

  if (status === 'compile_error') {
    recommendations.push('Fix the compile error first; scoring stays low until the code can run.');
  }
  if (status === 'runtime_error') {
    recommendations.push('Add guards for null, empty, and boundary inputs before optimizing.');
  }
  if (status === 'timeout') {
    recommendations.push('Revisit the algorithmic complexity and remove repeated scanning.');
  }
  if (outputMatched === false) {
    recommendations.push('Dry-run the expected output and compare formatting, ordering, and edge cases.');
  }
  if (!/o\s*\(/i.test(sourceCode)) {
    recommendations.push('State time and space complexity in the final explanation.');
  }
  if (!recommendations.length) {
    recommendations.push(finalScore >= 75
      ? 'Good submission. Copy the final code when you are ready to reuse it on the original platform.'
      : 'Improve the edge-case handling and add a clearer complexity note before resubmitting.');
  }

  return {
    weights: {
      correctness: 45,
      execution: 20,
      complexity: 15,
      logic: 15,
      readability: 5,
    },
    correctnessScore,
    executionScore,
    complexityScore,
    logicScore,
    readabilityScore,
    finalScore,
    outputMatched,
    detectedComplexity: detectComplexity(sourceCode),
    recommendations,
    signals: {
      stdoutPresent: Boolean(stdout),
      stderrPresent: Boolean(stderr),
      compileOutputPresent: Boolean(compileOutput),
    },
  };
}

function buildAnalysis({ problem, language, status, stdout, stderr, compileOutput, rubric, executionUnavailable = false }) {
  const weakSpots = [];
  if (rubric.correctnessScore < 75) weakSpots.push('Correctness');
  if (rubric.executionScore < 75) weakSpots.push('Execution stability');
  if (rubric.complexityScore < 70) weakSpots.push('Complexity explanation');
  if (rubric.logicScore < 70) weakSpots.push('Logic and edge cases');
  if (rubric.readabilityScore < 70) weakSpots.push('Readability');

  return {
    problemTitle: problem?.title || 'Coding Lab problem',
    language,
    status,
    summary: executionUnavailable
      ? `${language} execution is not configured, so PlacePrep used static analysis only.`
      : status === 'accepted'
        ? 'The sandbox run completed successfully. Review the rubric before copying the final code.'
        : 'The sandbox run completed with issues. Fix the highest-impact rubric area and rerun.',
    stdoutPreview: stdout ? stripSecrets(stdout).slice(0, 1200) : null,
    stderrPreview: stderr ? stripSecrets(stderr).slice(0, 1200) : null,
    compileOutputPreview: compileOutput ? stripSecrets(compileOutput).slice(0, 1200) : null,
    weakSpots,
    recommendations: rubric.recommendations,
    detectedComplexity: rubric.detectedComplexity,
    executionUnavailable,
  };
}

function normalizeSubmission(submission) {
  if (!submission) {
    return null;
  }

  return {
    ...submission,
    score: Number(submission.score || 0),
    time: submission.time === null || submission.time === undefined ? null : Number(submission.time),
    memory: submission.memory === null || submission.memory === undefined ? null : Number(submission.memory),
    stdout: stripSecrets(submission.stdout || ''),
    stderr: stripSecrets(submission.stderr || ''),
    compileOutput: stripSecrets(submission.compileOutput || ''),
  };
}

async function createAssessmentEntry(user, submission) {
  const activePlan = await prepPlanRepository.findLatestActiveByUser(user.id);
  const rubric = submission.rubric || {};
  const analysis = submission.analysis || {};
  const weakSpots = toArray(analysis.weakSpots).slice(0, 5);
  const problem = submission.problem || {};

  await assessmentRepository.createSession({
    userId: user.id,
    planId: activePlan?.id || null,
    status: 'completed',
    assessmentType: 'coding_lab',
    durationMinutes: 20,
    weakSpots,
    recommendations: toArray(rubric.recommendations).map((recommendation) => ({
      topic: problem.title || 'Coding Lab',
      reason: `${submission.language} submission scored ${Math.round(Number(submission.score || 0))}%.`,
      action: String(recommendation || 'Review the code and resubmit.'),
      problemLabel: problem.title || null,
      problemUrl: problem.url || null,
    })),
    questions: [
      {
        id: `coding-lab-${submission.id}`,
        type: 'coding',
        topic: problem.title || 'Coding Lab',
        prompt: `Solve ${problem.title || 'the selected Coding Lab problem'} in ${submission.language}.`,
        difficulty: problem.difficulty || 'medium',
        averageTimeMinutes: 20,
        referenceLabel: problem.platform || null,
        referenceUrl: problem.url || null,
        taskTitle: problem.title || null,
        approachHint: 'Use the sandbox feedback, then resubmit only after the correctness and complexity notes are addressed.',
      },
    ],
    submission: {
      answers: { [`coding-lab-${submission.id}`]: submission.sourceCode },
      questionResults: [
        {
          questionId: `coding-lab-${submission.id}`,
          topic: problem.title || 'Coding Lab',
          score: Number(submission.score || 0) / 100,
          correct: Number(submission.score || 0) >= 75,
          feedback: analysis.summary || 'Coding Lab submission recorded.',
          rubric,
          analysis,
          codingSubmissionId: submission.id,
        },
      ],
      codingSubmissionId: submission.id,
      submittedAt: new Date().toISOString(),
    },
    score: Number(submission.score || 0),
    metadata: {
      scope: 'daily',
      source: 'coding_lab',
      codingSubmissionId: submission.id,
      taskId: submission.taskId || null,
      language: submission.language,
      rubric,
      analysis,
    },
    startedAt: submission.createdAt || new Date().toISOString(),
    submittedAt: new Date().toISOString(),
  });
}

async function updateTaskProgress(user, submission, final = false) {
  if (!final || !submission.taskId) {
    return null;
  }

  const task = await taskRepository.findById(submission.taskId, user.id);
  if (!task) {
    return null;
  }

  const score = Number(submission.score || 0);
  const nextStatus = score >= 75 ? 'completed' : (task.status === 'pending' ? 'in_progress' : task.status);
  const updatedTask = await taskRepository.updateTask(task.id, user.id, {
    status: nextStatus,
    completedAt: nextStatus === 'completed' ? new Date() : undefined,
    metadata: {
      ...(task.metadata || {}),
      codingLabEnabled: true,
      codingLabLastSubmissionId: submission.id,
      codingLabLastScore: score,
      codingLabLastStatus: submission.status,
      codingLabLastSubmittedAt: new Date().toISOString(),
    },
  });

  await progressService.refreshProgressStats(user.id, user.timezone, { skipAutoVerification: true });
  return updatedTask;
}

async function runCode(user, payload = {}, options = {}) {
  const language = judge0Service.normalizeLanguageKey(payload.language || 'python');
  const sourceCode = String(payload.sourceCode || payload.source || '');
  const stdin = String(payload.stdin || '');
  const expectedOutput = payload.expectedOutput === undefined ? null : String(payload.expectedOutput || '');
  const final = Boolean(options.final || payload.final);

  assertPayloadSize(sourceCode, stdin);

  const task = payload.taskId ? await taskRepository.findById(payload.taskId, user.id) : null;
  if (payload.taskId && !task) {
    throw new AppError('Coding task not found.', 404);
  }

  const problem = await resolveProblem({
    ...(task ? problemFromTask(task) : {}),
    ...(payload.problem || {}),
    title: payload.problem?.title || payload.problemTitle || task?.referenceLabel || task?.title,
    url: payload.problem?.url || payload.problemUrl || task?.referenceUrl,
  });

  let queuedSubmission = null;
  let finalResult = null;
  let executionUnavailable = false;

  try {
    const queued = await judge0Service.submit({
      language,
      sourceCode,
      stdin,
      expectedOutput,
    });
    queuedSubmission = await codingSubmissionRepository.createSubmission({
      userId: user.id,
      taskId: task?.id || null,
      problem,
      language,
      sourceCode,
      stdin,
      expectedOutput,
      status: 'queued',
      judgeToken: queued.token,
      analysis: {
        providerLanguage: queued.language.providerName,
      },
    });
    finalResult = await judge0Service.poll(queued.token);
  } catch (error) {
    if (isSqlLanguage(language) && error instanceof AppError && ['judge0_disabled', 'language_unavailable'].includes(error.details?.code)) {
      executionUnavailable = true;
      queuedSubmission = await codingSubmissionRepository.createSubmission({
        userId: user.id,
        taskId: task?.id || null,
        problem,
        language,
        sourceCode,
        stdin,
        expectedOutput,
        status: 'analysis_only',
        analysis: {
          executionUnavailable: true,
          unavailableReason: error.message,
        },
      });
      finalResult = {
        status: 'analysis_only',
        stdout: null,
        stderr: null,
        compileOutput: null,
        time: null,
        memory: null,
        statusDescription: error.message,
      };
    } else {
      throw error;
    }
  }

  const stdout = stripSecrets(finalResult.stdout || '');
  const stderr = stripSecrets(finalResult.stderr || finalResult.message || '');
  const compileOutput = stripSecrets(finalResult.compileOutput || '');
  const rubric = buildRubric({
    sourceCode,
    status: finalResult.status,
    stdout,
    expectedOutput,
    compileOutput,
    stderr,
    problem,
  });
  const analysis = buildAnalysis({
    problem,
    language,
    status: finalResult.status,
    stdout,
    stderr,
    compileOutput,
    rubric,
    executionUnavailable,
  });
  const testResults = [
    {
      name: expectedOutput ? 'Expected output' : 'Sandbox run',
      passed: finalResult.status === 'accepted' && compareOutput(stdout, expectedOutput) !== false,
      status: finalResult.status,
      expectedOutput,
      actualOutput: stdout || null,
      message: finalResult.statusDescription || null,
    },
  ];

  const updatedSubmission = await codingSubmissionRepository.updateSubmission(queuedSubmission.id, user.id, {
    status: finalResult.status,
    stdout,
    stderr,
    compileOutput,
    time: finalResult.time,
    memory: finalResult.memory,
    testResults,
    analysis: {
      ...(queuedSubmission.analysis || {}),
      ...analysis,
      finalized: final,
    },
    rubric,
    score: rubric.finalScore,
  });

  if (final) {
    await createAssessmentEntry(user, updatedSubmission);
    await updateTaskProgress(user, updatedSubmission, true);
  }

  return normalizeSubmission(updatedSubmission);
}

async function submitCode(user, payload = {}) {
  return runCode(user, payload, { final: true });
}

async function getRun(user, runId) {
  const submission = await codingSubmissionRepository.findById(runId, user.id);
  if (!submission) {
    throw new AppError('Coding run not found.', 404);
  }

  return normalizeSubmission(submission);
}

async function listSubmissions(user, filters = {}) {
  const limit = Math.max(1, Math.min(50, Number(filters.limit || 20)));
  const submissions = await codingSubmissionRepository.listByUser(user.id, limit);
  return submissions.map(normalizeSubmission);
}

module.exports = {
  DEFAULT_STARTER_CODE,
  resolveProblem,
  getLanguages,
  getCodingTask,
  runCode,
  submitCode,
  getRun,
  listSubmissions,
};
