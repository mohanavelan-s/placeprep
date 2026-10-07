const aiGateway = require('./aiGateway.service');
const taskRepository = require('../repositories/task.repository');
const userProfileRepository = require('../repositories/userProfile.repository');

const GENERIC_TOKENS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'into',
  'task',
  'apply',
  'block',
  'focus',
  'drill',
  'checkpoint',
  'revision',
  'structured',
  'execution',
  'platform',
  'warm',
  'warmup',
  'medium',
  'easy',
  'hard',
  'problem',
  'practice',
  'interview',
  'today',
  'day',
  'project',
  'push',
  'proof',
  'build',
  'visible',
  'task',
  'one',
  'two',
  'three',
  'four',
  'five',
]);

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractSignificantTokens(values = []) {
  return Array.from(new Set(
    values
      .flatMap((value) => normalizeText(value).split(' '))
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token))
  ));
}

function readTaskMetadata(task) {
  return task && typeof task.metadata === 'object' && task.metadata !== null
    ? { ...task.metadata }
    : {};
}

function buildAutoVerificationMetadata(task, patch) {
  const metadata = readTaskMetadata(task);
  return {
    ...metadata,
    autoVerification: {
      ...(metadata.autoVerification && typeof metadata.autoVerification === 'object'
        ? metadata.autoVerification
        : {}),
      ...patch,
    },
  };
}

function extractLeetCodeUsername(leetcodeUrl = '') {
  const text = String(leetcodeUrl || '').trim();
  if (!text) {
    return '';
  }

  try {
    const parsed = new URL(text);
    const segments = parsed.pathname.split('/').map((segment) => segment.trim()).filter(Boolean);

    if (!segments.length) {
      return '';
    }

    if ((segments[0] === 'u' || segments[0] === 'users') && segments[1]) {
      return segments[1];
    }

    return segments[0];
  } catch {
    return '';
  }
}

function extractTaskReference(task) {
  const referenceUrl = String(task?.referenceUrl || '').trim();
  const referenceLabel = String(task?.referenceLabel || '').trim();
  const normalizedUrl = referenceUrl.toLowerCase();

  let platform = 'proof';
  let problemSlug = '';

  const leetCodeMatch = normalizedUrl.match(/leetcode\.com\/problems\/([^/?#]+)/i);
  if (leetCodeMatch?.[1]) {
    platform = 'leetcode';
    problemSlug = leetCodeMatch[1];
  }

  const hackerRankMatch = normalizedUrl.match(/hackerrank\.com\/challenges\/([^/?#]+)/i);
  if (hackerRankMatch?.[1]) {
    platform = 'hackerrank';
    problemSlug = hackerRankMatch[1];
  }

  const codeChefMatch = normalizedUrl.match(/codechef\.com\/problems\/([^/?#]+)/i);
  if (codeChefMatch?.[1]) {
    platform = 'codechef';
    problemSlug = codeChefMatch[1];
  }

  const topicKeywords = extractSignificantTokens([
    task?.title,
    referenceLabel,
    task?.weakArea,
    task?.subcategory,
    problemSlug.replace(/-/g, ' '),
  ]);

  return {
    platform,
    problemSlug,
    referenceUrl,
    referenceLabel,
    topicKeywords,
  };
}

function taskSupportsProfileVerification(task) {
  const reference = extractTaskReference(task);
  return reference.platform === 'leetcode' && Boolean(reference.problemSlug);
}

function isAssignedTask(task) {
  const metadata = readTaskMetadata(task);
  const source = String(metadata.source || '').toLowerCase();

  return Boolean(task?.aiGenerated)
    || ['prep-architect', 'ai-coach', 'admin-practice-link', 'admin-assignment'].includes(source);
}

function taskSupportsProofVerification(task) {
  const reference = extractTaskReference(task);

  if (reference.platform === 'leetcode' || reference.platform === 'hackerrank' || reference.platform === 'codechef') {
    return true;
  }

  return isAssignedTask(task) && ['Core', 'Project', 'Resume', 'MockInterview', 'Aptitude'].includes(String(task?.category || ''));
}

function canAutoVerifyTask(task) {
  return taskSupportsProfileVerification(task) || taskSupportsProofVerification(task);
}

function createVerificationSummary(task) {
  const reference = extractTaskReference(task);

  if (reference.platform === 'leetcode') {
    return {
      mode: 'profile_or_proof',
      provider: 'leetcode',
      label: 'LeetCode profile or proof upload',
    };
  }

  if (reference.platform === 'hackerrank' || reference.platform === 'codechef') {
    return {
      mode: 'proof_upload',
      provider: reference.platform,
      label: 'Proof upload',
    };
  }

  if (taskSupportsProofVerification(task)) {
    return {
      mode: 'proof_upload',
      provider: 'proof',
      label: 'Proof upload',
    };
  }

  return {
    mode: 'manual',
    provider: 'manual',
    label: 'Manual completion',
  };
}

async function fetchRecentAcceptedLeetCodeSubmissions(username, limit = 20) {
  if (!username || typeof fetch !== 'function') {
    return [];
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutHandle = controller
    ? setTimeout(() => controller.abort(), 6500)
    : null;

  try {
    const response = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'https://leetcode.com/',
        'User-Agent': 'PlacePrep/1.0',
      },
      body: JSON.stringify({
        query: `
          query recentAcSubmissions($username: String!, $limit: Int!) {
            recentAcSubmissionList(username: $username, limit: $limit) {
              id
              title
              titleSlug
              timestamp
            }
          }
        `,
        variables: {
          username,
          limit,
        },
      }),
      signal: controller?.signal,
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return Array.isArray(payload?.data?.recentAcSubmissionList)
      ? payload.data.recentAcSubmissionList
      : [];
  } catch {
    return [];
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function findMatchingAcceptedSubmission(task, submissions = []) {
  const reference = extractTaskReference(task);
  if (!reference.problemSlug) {
    return null;
  }

  const normalizedSlug = reference.problemSlug.toLowerCase();
  const normalizedLabel = normalizeText(reference.referenceLabel);

  return submissions.find((submission) => {
    const submissionSlug = String(submission?.titleSlug || '').trim().toLowerCase();
    const submissionTitle = normalizeText(submission?.title);

    return submissionSlug === normalizedSlug
      || (normalizedLabel && submissionTitle && submissionTitle === normalizedLabel);
  }) || null;
}

async function autoVerifyTasksFromLeetCode(user, tasks = []) {
  const eligibleTasks = tasks.filter((task) => (
    task
    && task.status !== 'completed'
    && task.status !== 'skipped'
    && taskSupportsProfileVerification(task)
  ));

  if (!eligibleTasks.length) {
    return [];
  }

  const userProfile = await userProfileRepository.findByUserId(user.id);
  const username = extractLeetCodeUsername(userProfile?.leetcodeUrl);

  if (!username) {
    return [];
  }

  const recentAcceptedSubmissions = await fetchRecentAcceptedLeetCodeSubmissions(username, 20);
  if (!recentAcceptedSubmissions.length) {
    return [];
  }

  const now = new Date();
  const verifiedTaskIds = [];

  await Promise.all(eligibleTasks.map(async (task) => {
    const matchedSubmission = findMatchingAcceptedSubmission(task, recentAcceptedSubmissions);
    if (!matchedSubmission) {
      return;
    }

    const reference = extractTaskReference(task);
    const completedAt = matchedSubmission.timestamp
      ? new Date(Number(matchedSubmission.timestamp) * 1000)
      : now;

    await taskRepository.updateTask(task.id, user.id, {
      status: 'completed',
      completedAt,
      metadata: buildAutoVerificationMetadata(task, {
        ...createVerificationSummary(task),
        verified: true,
        method: 'leetcode_recent_ac',
        verifiedAt: now.toISOString(),
        reason: `Matched ${matchedSubmission.title || reference.referenceLabel || 'the assigned problem'} in the linked LeetCode account.`,
        profileUsername: username,
        problemSlug: reference.problemSlug,
        evidence: {
          submissionId: matchedSubmission.id || null,
          submissionTitle: matchedSubmission.title || null,
          submissionTimestamp: matchedSubmission.timestamp || null,
        },
      }),
    });

    verifiedTaskIds.push(task.id);
  }));

  return verifiedTaskIds;
}

async function autoVerifyOpenTasksFromLeetCode(user, options = {}) {
  const tasks = Array.isArray(options.tasks)
    ? options.tasks
    : await taskRepository.listByUser(user.id, {});

  return autoVerifyTasksFromLeetCode(
    user,
    tasks.filter((task) => task && task.status !== 'completed' && task.status !== 'skipped')
  );
}

function buildProofHeuristic(task, proof) {
  const reference = extractTaskReference(task);
  const caption = String(proof?.caption || '').trim();
  const captionTokens = extractSignificantTokens([caption]);
  const taskTokens = reference.topicKeywords;
  const matchedTokens = taskTokens.filter((token) => captionTokens.includes(token));
  const completionSignal = /(accepted|solved|completed|finished|submitted|submission|done|verified|dashboard|pipeline|analysis|notes|revision|project)/i.test(caption);
  const platformSignal = new RegExp(reference.platform === 'proof' ? 'notes|revision|project|proof' : reference.platform, 'i').test(caption);

  const verified = completionSignal && (
    matchedTokens.length >= 2
    || (matchedTokens.length >= 1 && platformSignal)
  );

  return {
    verified,
    confidence: verified ? 0.72 : 0.28,
    matchedTokens,
    caption,
    reason: verified
      ? `Matched proof text against ${matchedTokens.join(', ') || reference.referenceLabel || task.title}.`
      : 'Proof text did not clearly match the assigned task yet.',
  };
}

async function requestVisionVerification(task, proof) {
  const secureUrl = String(proof?.secureUrl || '').trim();
  if (!/^https?:\/\//i.test(secureUrl)) {
    return null;
  }

  const reference = extractTaskReference(task);

  const result = await aiGateway.requestWithModelChain({
    label: 'task-proof-vision',
    fallbackFactory: () => null,
    parse: aiGateway.safeJsonParse,
    validate: (data) => data && typeof data === 'object' && typeof data.verified === 'boolean',
    messages: [
        {
          role: 'system',
          content: [
            'You verify whether an uploaded screenshot or photo is credible proof that a student completed a task.',
            'Return only JSON with keys: verified (boolean), confidence (0-1), reason (string).',
            'Reject unrelated images such as beaches, scenery, pets, selfies, random rooms, food, vehicles, blank walls, memes, or any photo that does not visibly contain task evidence.',
            'For coding tasks, require visible evidence like the exact or closely matching problem title, an accepted/submitted result, code editor content, test results, or platform UI that matches the assigned task.',
            'For notes, project, dashboard, resume, or revision tasks, require clearly relevant notes, deliverables, project screens, dashboards, resume edits, or outputs tied to the assigned topic.',
            'If the image is ambiguous, unrelated, or lacks visible task evidence, verified must be false.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                `Task title: ${task?.title || 'Unknown task'}`,
                `Task category: ${task?.category || 'Unknown'}`,
                `Reference label: ${reference.referenceLabel || 'None'}`,
                `Reference url: ${reference.referenceUrl || 'None'}`,
                `Expected platform: ${reference.platform}`,
                `Topic hint: ${task?.weakArea || task?.subcategory || 'None'}`,
                `Student caption: ${proof?.caption || 'None'}`,
                `Expected keywords: ${reference.topicKeywords.join(', ') || 'None'}`,
                '',
                'Mark verified true only when the image clearly looks like completion evidence for this exact task, such as an accepted coding submission, a completed dashboard or pipeline result, or visible finished notes for the requested topic.',
                'A caption alone is not enough. The image itself must show evidence.',
              ].join('\n'),
            },
            {
              type: 'image_url',
              image_url: {
                url: secureUrl,
              },
            },
          ],
        },
    ],
  });

  if (result.usedFallback || !result.data) {
    return null;
  }

  try {
    const parsed = result.data;

    return {
      verified: Boolean(parsed?.verified),
      confidence: Number(parsed?.confidence || 0),
      reason: String(parsed?.reason || '').trim() || 'Vision verification completed.',
    };
  } catch {
    return null;
  }
}

function buildProofFailureReason(heuristic, visionResult) {
  if (visionResult?.reason) {
    return visionResult.reason;
  }

  if (heuristic.verified) {
    return 'Caption matched the task, but the uploaded image itself was not verified as real completion proof yet.';
  }

  return heuristic.reason;
}

async function verifyTaskAgainstProof(user, task, proof) {
  const heuristic = buildProofHeuristic(task, proof);
  const visionResult = await requestVisionVerification(task, proof);
  const visionVerified = Boolean(visionResult?.verified) && Number(visionResult?.confidence || 0) >= 0.55;

  if (visionVerified) {
    const updatedTask = await taskRepository.updateTask(task.id, user.id, {
      status: 'completed',
      completedAt: new Date(),
      metadata: buildAutoVerificationMetadata(task, {
        ...createVerificationSummary(task),
        verified: true,
        method: 'proof_vision_check',
        verifiedAt: new Date().toISOString(),
        reason: visionResult.reason,
        confidence: visionResult.confidence,
        proofImageId: proof.id,
        proofCaption: proof?.caption || null,
      }),
    });

    return {
      task: updatedTask,
      verification: {
        attempted: true,
        verified: true,
        method: 'proof_vision_check',
        reason: visionResult.reason,
        confidence: visionResult.confidence,
        taskId: task.id,
        taskStatus: updatedTask?.status || 'completed',
      },
    };
  }

  const updatedTask = await taskRepository.updateTask(task.id, user.id, {
    metadata: buildAutoVerificationMetadata(task, {
      ...createVerificationSummary(task),
      verified: false,
      method: visionResult ? 'proof_vision_check' : 'proof_caption_match',
      checkedAt: new Date().toISOString(),
      reason: buildProofFailureReason(heuristic, visionResult),
      confidence: visionResult?.confidence || heuristic.confidence,
      proofImageId: proof.id,
      proofCaption: proof?.caption || null,
      matchedTokens: heuristic.matchedTokens,
      captionMatched: heuristic.verified,
    }),
  });

  return {
    task: updatedTask || task,
    verification: {
      attempted: true,
      verified: false,
      method: visionResult ? 'proof_vision_check' : 'proof_caption_match',
      reason: buildProofFailureReason(heuristic, visionResult),
      confidence: visionResult?.confidence || heuristic.confidence,
      taskId: task.id,
      taskStatus: updatedTask?.status || task.status,
    },
  };
}

module.exports = {
  canAutoVerifyTask,
  createVerificationSummary,
  taskSupportsProfileVerification,
  taskSupportsProofVerification,
  autoVerifyTasksFromLeetCode,
  autoVerifyOpenTasksFromLeetCode,
  verifyTaskAgainstProof,
};
