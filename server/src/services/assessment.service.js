const assessmentRepository = require('../repositories/assessment.repository');
const prepPlanRepository = require('../repositories/prepPlan.repository');
const taskRepository = require('../repositories/task.repository');
const prepArchitectService = require('./prepArchitect.service');
const AppError = require('../utils/appError');

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'what',
  'with',
  'you',
  'your',
]);

const GENERIC_DISTRACTORS = [
  'Blindly memorize the syntax and skip tradeoff analysis.',
  'Always choose the most complex structure first.',
  'Ignore edge cases until after the code is complete.',
  'Start writing code before deciding on the core approach.',
  'Prefer broad theory over one clear practical example.',
  'Assume every problem needs recursion and dynamic programming.',
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function uniqueStrings(values = [], limit = 12) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  ).slice(0, limit);
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return normalizeText(value).replace(/\s+/g, '-').slice(0, 48) || 'item';
}

function shuffle(values = []) {
  const next = [...values];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function extractKeywords(value, fallback = []) {
  const normalized = normalizeText(value);
  const keywords = normalized
    .split(' ')
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

  return uniqueStrings([...keywords, ...fallback], 6);
}

function buildTopicKeywordHints(topic) {
  const normalized = normalizeText(topic);

  if (normalized.includes('array')) {
    return ['array', 'hash', 'pointer', 'index', 'time'];
  }
  if (normalized.includes('string')) {
    return ['string', 'window', 'hash', 'pointer', 'time'];
  }
  if (normalized.includes('tree')) {
    return ['tree', 'queue', 'stack', 'node', 'traversal'];
  }
  if (normalized.includes('graph')) {
    return ['graph', 'bfs', 'dfs', 'visited', 'queue'];
  }
  if (normalized.includes('dynamic')) {
    return ['dp', 'state', 'transition', 'memo', 'tabulation'];
  }
  if (normalized.includes('sql') || normalized.includes('db')) {
    return ['select', 'join', 'group', 'where', 'query'];
  }
  if (normalized.includes('system')) {
    return ['scalability', 'cache', 'latency', 'queue', 'database'];
  }
  if (normalized.includes('data engineer')) {
    return ['etl', 'warehouse', 'pipeline', 'spark', 'airflow'];
  }
  if (normalized.includes('data analyst')) {
    return ['sql', 'dashboard', 'insight', 'metric', 'analysis'];
  }
  if (normalized.includes('data scientist')) {
    return ['model', 'feature', 'metric', 'validation', 'python'];
  }

  return extractKeywords(topic);
}

function extractKeyPhrase(answer) {
  const sentence = String(answer || '')
    .trim()
    .split(/[.;!?]/)[0]
    .trim();
  const words = sentence.split(/\s+/).filter(Boolean);

  if (!words.length) {
    return '';
  }

  const phraseLength = clamp(Math.ceil(words.length / 3), 2, 6);
  return words.slice(0, phraseLength).join(' ');
}

function findResourceForTopic(plan, topic) {
  const normalizedTopic = normalizeText(topic);

  return (plan.resources || []).find((group) => {
    const groupTopic = normalizeText(group?.topic);
    return groupTopic === normalizedTopic || groupTopic.includes(normalizedTopic) || normalizedTopic.includes(groupTopic);
  }) || null;
}

function flattenPlanItems(plan) {
  return (plan.tasks || []).flatMap((day) =>
    (day.items || []).map((item) => ({
      ...item,
      day: day.day,
      theme: day.theme,
    }))
  );
}

function sanitizePlanSummary(plan) {
  if (!plan) {
    return null;
  }

  return {
    id: plan.id,
    title: typeof plan.metadata?.title === 'string' ? plan.metadata.title : null,
    targetRole: plan.targetRole || null,
    targetTopics: plan.targetTopics || [],
    knownTopics: plan.knownTopics || [],
    timePerDay: plan.timePerDay || 120,
    durationMonths: plan.durationMonths || Number(plan.metadata?.durationMonths || 1) || 1,
    version: Number(plan.version || 1),
    isActive: Boolean(plan.isActive),
  };
}

function sanitizeQuestion(question) {
  if (!question) {
    return null;
  }

  return {
    id: question.id,
    topic: question.topic,
    prompt: question.prompt,
    type: question.type,
    averageTimeMinutes: question.averageTimeMinutes,
    referenceLabel: question.referenceLabel || null,
    referenceUrl: question.referenceUrl || null,
    choices: Array.isArray(question.choices) ? question.choices : undefined,
    placeholder: question.placeholder || null,
    taskTitle: question.taskTitle || null,
  };
}

function sanitizeSession(session, includeQuestions = false) {
  if (!session) {
    return null;
  }

  return {
    ...session,
    questions: includeQuestions ? (session.questions || []).map(sanitizeQuestion).filter(Boolean) : [],
  };
}

function buildAssessmentReference(plan, topic) {
  const resourceGroup = findResourceForTopic(plan, topic);
  const resourceItem = resourceGroup?.items?.[0] || null;

  return {
    referenceLabel: resourceItem?.title || null,
    referenceUrl: resourceItem?.url || null,
  };
}

function buildMcqQuestions(plan, durationMinutes) {
  const flashcards = Array.isArray(plan.flashcards) && plan.flashcards.length
    ? plan.flashcards
    : [{
      topic: (plan.targetTopics || [plan.targetRole || 'prep'])[0] || 'prep',
      question: `What should you focus on first for ${plan.targetRole || 'this role'}?`,
      answer: `Start with ${(plan.targetTopics || [plan.knownTopics?.[0] || 'the main target topic'])[0]} and connect it to one direct task before you widen the plan.`,
    }];
  const questionCount = clamp(Math.round(durationMinutes / 5), 4, 6);

  return flashcards.slice(0, questionCount).map((card, index) => {
    const questionId = `mcq-${index + 1}-${slugify(card.topic || `topic-${index + 1}`)}`;
    const correctText = String(card.answer || '').trim();
    const distractors = uniqueStrings([
      ...flashcards
        .map((entry) => String(entry.answer || '').trim())
        .filter((entry) => entry && normalizeText(entry) !== normalizeText(correctText)),
      ...GENERIC_DISTRACTORS,
    ], 8);

    const optionTexts = shuffle([correctText, ...distractors.slice(0, 3)]).slice(0, 4);
    const options = optionTexts.map((text, optionIndex) => ({
      id: `${questionId}-option-${optionIndex + 1}`,
      label: String.fromCharCode(65 + optionIndex),
      text,
    }));
    const correctOption = options.find((option) => normalizeText(option.text) === normalizeText(correctText)) || options[0];
    const reference = buildAssessmentReference(plan, card.topic);

    return {
      id: questionId,
      type: 'mcq',
      topic: String(card.topic || `Topic ${index + 1}`),
      prompt: String(card.question || `Choose the strongest explanation for ${card.topic || 'this topic'}.`),
      averageTimeMinutes: clamp(Math.floor(durationMinutes / questionCount), 3, 8),
      referenceLabel: reference.referenceLabel,
      referenceUrl: reference.referenceUrl,
      choices: options,
      correctOptionId: correctOption.id,
      expectedAnswer: correctText,
      explanation: correctText,
    };
  });
}

function buildFillBlankQuestions(plan, durationMinutes) {
  const flashcards = Array.isArray(plan.flashcards) && plan.flashcards.length
    ? plan.flashcards
    : [{
      topic: (plan.targetTopics || [plan.targetRole || 'prep'])[0] || 'prep',
      question: `What should you focus on first for ${plan.targetRole || 'this role'}?`,
      answer: `Start with ${(plan.targetTopics || [plan.knownTopics?.[0] || 'the main target topic'])[0]} and connect it to one direct task before you widen the plan.`,
    }];
  const questionCount = clamp(Math.round(durationMinutes / 6), 4, 6);

  return flashcards.slice(0, questionCount).map((card, index) => {
    const answer = String(card.answer || '').trim();
    const keyPhrase = extractKeyPhrase(answer) || String(card.topic || 'the core idea');
    const blankedAnswer = answer.includes(keyPhrase)
      ? answer.replace(keyPhrase, '_____')
      : `_____ ${answer}`.trim();
    const reference = buildAssessmentReference(plan, card.topic);

    return {
      id: `fill-${index + 1}-${slugify(card.topic || `topic-${index + 1}`)}`,
      type: 'fill_blank',
      topic: String(card.topic || `Topic ${index + 1}`),
      prompt: `Fill in the blank for ${card.topic || 'this topic'}: ${blankedAnswer}`,
      averageTimeMinutes: clamp(Math.floor(durationMinutes / questionCount), 3, 8),
      referenceLabel: reference.referenceLabel,
      referenceUrl: reference.referenceUrl,
      placeholder: 'Type the missing idea in one short phrase',
      expectedAnswer: keyPhrase,
      expectedKeywords: extractKeywords(answer, extractKeywords(keyPhrase)),
      explanation: answer,
    };
  });
}

function buildFallbackCodingItems(plan, questionCount) {
  const topics = uniqueStrings([
    ...(plan.targetTopics || []),
    ...(plan.knownTopics || []),
    ...(plan.roadmap || []).flatMap((week) => week.focusTopics || []),
  ], questionCount);

  return topics.map((topic, index) => {
    const reference = buildAssessmentReference(plan, topic);

    return {
      title: `Timed implementation: ${topic}`,
      referenceLabel: reference.referenceLabel || `Implement a short ${topic} drill`,
      referenceUrl: reference.referenceUrl,
      estimatedMinutes: 30,
      type: 'Project',
      theme: topic,
    };
  });
}

function buildCodingQuestions(plan, recentTasks = [], durationMinutes) {
  const currentPlanItems = flattenPlanItems(plan).filter((item) => item.type !== 'Revision');
  const liveTaskItems = (recentTasks || []).map((task) => ({
    title: task.title,
    referenceLabel: task.referenceLabel || task.title,
    referenceUrl: task.referenceUrl || null,
    estimatedMinutes: task.estimatedMinutes || 30,
    type: task.category === 'Project' ? 'Project' : 'DSA',
    theme: task.weakArea || task.subcategory || task.category,
  }));
  const combined = uniqueStrings(
    [...liveTaskItems, ...currentPlanItems].map((item) => `${item.referenceLabel || item.title}::${item.referenceUrl || ''}`),
    12,
  ).map((fingerprint) => {
    const [label, url] = fingerprint.split('::');
    return liveTaskItems.find((item) => (item.referenceLabel || item.title) === label && (item.referenceUrl || '') === url)
      || currentPlanItems.find((item) => (item.referenceLabel || item.title) === label && (item.referenceUrl || '') === url);
  }).filter(Boolean);

  const questionCount = clamp(Math.round(durationMinutes / 18), 2, 4);
  const baseItems = combined.length ? combined.slice(0, questionCount) : buildFallbackCodingItems(plan, questionCount);

  return baseItems.map((item, index) => {
    const topic = String(item.theme || item.title || (plan.targetTopics || [plan.targetRole || 'coding'])[0] || 'coding');
    const referenceLabel = item.referenceLabel || item.title || `Timed ${topic} prompt`;
    const expectedKeywords = uniqueStrings([
      ...buildTopicKeywordHints(topic),
      ...extractKeywords(referenceLabel),
      'time',
      'complexity',
    ], 8);

    return {
      id: `code-${index + 1}-${slugify(referenceLabel)}`,
      type: 'coding',
      topic,
      prompt: `Write a short programming solution or pseudocode for ${referenceLabel}. Keep it within interview length, mention the core approach, any main data structure, and the expected time complexity.`,
      averageTimeMinutes: clamp(Number(item.estimatedMinutes || Math.floor(durationMinutes / questionCount)), 15, 45),
      referenceLabel,
      referenceUrl: item.referenceUrl || null,
      taskTitle: item.title || referenceLabel,
      placeholder: 'Use a compact solution sketch. Code or structured pseudocode both work here.',
      expectedKeywords,
      explanation: `A strong answer should clearly state the approach for ${referenceLabel}, mention one relevant data structure, and include time complexity.`,
    };
  });
}

function buildQuestions(plan, recentTasks, assessmentType, durationMinutes) {
  if (assessmentType === 'coding') {
    return buildCodingQuestions(plan, recentTasks, durationMinutes);
  }

  if (assessmentType === 'fill_blank') {
    return buildFillBlankQuestions(plan, durationMinutes);
  }

  return buildMcqQuestions(plan, durationMinutes);
}

function scoreTextAgainstKeywords(response, expectedKeywords = []) {
  const normalizedResponse = normalizeText(response);

  if (!normalizedResponse) {
    return 0;
  }

  const matches = expectedKeywords.filter((keyword) => normalizedResponse.includes(normalizeText(keyword))).length;
  if (!expectedKeywords.length) {
    return normalizedResponse.length > 24 ? 0.5 : 0;
  }

  return matches / expectedKeywords.length;
}

function gradeQuestion(question, response) {
  const normalizedResponse = normalizeText(response);

  if (question.type === 'mcq') {
    const isCorrect = String(response || '').trim() === question.correctOptionId;
    return {
      questionId: question.id,
      topic: question.topic,
      score: isCorrect ? 1 : 0,
      correct: isCorrect,
      feedback: isCorrect
        ? 'Good read. The selected answer matches the planned recall target.'
        : 'This one slipped. Revisit the explanation and then retry the linked study resource.',
    };
  }

  if (question.type === 'fill_blank') {
    const expectedAnswer = normalizeText(question.expectedAnswer);
    const keywordScore = scoreTextAgainstKeywords(response, question.expectedKeywords || []);
    const isCorrect = normalizedResponse.includes(expectedAnswer) || keywordScore >= 0.6;

    return {
      questionId: question.id,
      topic: question.topic,
      score: isCorrect ? 1 : keywordScore >= 0.35 ? 0.5 : 0,
      correct: isCorrect,
      feedback: isCorrect
        ? 'Nice. The missing idea is intact.'
        : `Tighten the recall phrase for ${question.topic} and keep it short enough to say under pressure.`,
    };
  }

  const keywordScore = scoreTextAgainstKeywords(response, question.expectedKeywords || []);
  const hasComplexitySignal = /o\(|time complexity|space complexity/.test(String(response || '').toLowerCase());
  const hasCodeSignal = /(for|while|if|return|function|def|class|select|join|group by)/i.test(String(response || ''));
  let score = 0;

  if (String(response || '').trim().length >= 120) {
    score = Math.max(score, 0.4);
  } else if (String(response || '').trim().length >= 60) {
    score = Math.max(score, 0.25);
  }

  score = Math.max(score, keywordScore);

  if (hasCodeSignal) {
    score = Math.max(score, 0.5);
  }

  if (hasComplexitySignal) {
    score = Math.min(1, score + 0.15);
  }

  const correct = score >= 0.75;

  return {
    questionId: question.id,
    topic: question.topic,
    score: clamp(Number(score.toFixed(2)), 0, 1),
    correct,
    feedback: correct
      ? 'Solid. The solution sketch mentions the approach and the cost clearly.'
      : 'Add the core approach, one key data structure, and the time complexity so the answer feels interview-ready.',
  };
}

function buildRecommendations(plan, weakSpots = [], assessmentType) {
  return uniqueStrings(weakSpots, 5).map((topic) => {
    const resourceGroup = findResourceForTopic(plan, topic);
    const resource = resourceGroup?.items?.[0] || null;
    const practiceItem = flattenPlanItems(plan).find((item) => {
      const combined = normalizeText(`${item.title} ${item.referenceLabel} ${item.theme}`);
      return combined.includes(normalizeText(topic));
    }) || null;

    return {
      topic,
      reason: `${topic} underperformed in your ${assessmentType.replace('_', ' ')} assessment.`,
      action: practiceItem
        ? `Revisit ${practiceItem.referenceLabel || practiceItem.title}, then explain the approach out loud before solving it again.`
        : `Run one more direct practice block on ${topic} before regenerating tasks.`,
      resourceLabel: resource?.title || null,
      resourceUrl: resource?.url || null,
      problemLabel: practiceItem?.referenceLabel || practiceItem?.title || null,
      problemUrl: practiceItem?.referenceUrl || null,
    };
  });
}

async function resolveActivePlan(userId) {
  return prepPlanRepository.findLatestActiveByUser(userId);
}

async function getOverview(user) {
  const [activePlan, sessions] = await Promise.all([
    resolveActivePlan(user.id),
    assessmentRepository.listByUser(user.id, 8),
  ]);

  const currentSession = sessions.find((session) => session.status !== 'completed' && session.status !== 'skipped') || sessions[0] || null;

  return {
    activePlan: sanitizePlanSummary(activePlan),
    currentSession: sanitizeSession(currentSession, true),
    recentSessions: sessions.map((session) => sanitizeSession(session, session.id === currentSession?.id)),
  };
}

async function generateAssessment(user, payload = {}) {
  const activePlan = await resolveActivePlan(user.id);
  if (!activePlan) {
    throw new AppError('Create a Prep Architect plan first, then start an assessment.', 409);
  }

  const assessmentType = ['mcq', 'fill_blank', 'coding'].includes(payload.assessmentType)
    ? payload.assessmentType
    : 'mcq';
  const durationMinutes = clamp(Number(payload.durationMinutes || 20), 10, 90);
  const recentTasks = await taskRepository.listRecentPrepArchitectTasksByPlan(user.id, activePlan.id, 12);
  const questions = buildQuestions(activePlan, recentTasks, assessmentType, durationMinutes);

  if (!questions.length) {
    throw new AppError('Unable to build an assessment from the current plan.', 400);
  }

  const session = await assessmentRepository.createSession({
    userId: user.id,
    planId: activePlan.id,
    status: 'started',
    assessmentType,
    durationMinutes,
    questions,
    metadata: {
      planTitle: activePlan.metadata?.title || null,
      planVersion: activePlan.version || 1,
      targetRole: activePlan.targetRole || null,
      targetTopics: activePlan.targetTopics || [],
      questionCount: questions.length,
    },
    startedAt: new Date().toISOString(),
  });

  return {
    activePlan: sanitizePlanSummary(activePlan),
    session: sanitizeSession(session, true),
  };
}

async function submitAssessment(user, assessmentId, payload = {}) {
  const session = await assessmentRepository.findById(assessmentId, user.id);
  if (!session) {
    throw new AppError('Assessment session not found.', 404);
  }

  if (session.status === 'completed') {
    return sanitizeSession(session, true);
  }

  const answers = payload.answers && typeof payload.answers === 'object' && !Array.isArray(payload.answers)
    ? payload.answers
    : {};
  const plan = session.planId
    ? await prepPlanRepository.findById(session.planId, user.id)
    : await resolveActivePlan(user.id);

  if (!plan) {
    throw new AppError('The linked Prep Architect plan could not be found.', 404);
  }

  const questionResults = (session.questions || []).map((question) =>
    gradeQuestion(question, answers[question.id])
  );
  const aggregateScore = questionResults.length
    ? (questionResults.reduce((sum, item) => sum + Number(item.score || 0), 0) / questionResults.length) * 100
    : 0;
  const roundedScore = Number(aggregateScore.toFixed(2));
  const weakSpots = uniqueStrings(
    questionResults
      .filter((item) => Number(item.score || 0) < 0.75)
      .map((item) => item.topic),
    5,
  );
  const recommendations = buildRecommendations(plan, weakSpots, session.assessmentType);

  const updatedSession = await assessmentRepository.updateSession(session.id, user.id, {
    status: 'completed',
    weakSpots,
    recommendations,
    score: roundedScore,
    submission: {
      answers,
      questionResults,
      submittedAt: new Date().toISOString(),
    },
    submittedAt: new Date().toISOString(),
    metadata: {
      ...(session.metadata || {}),
      latestScore: roundedScore,
      weakSpotCount: weakSpots.length,
    },
  });

  return sanitizeSession(updatedSession, true);
}

async function applyPlanUpdate(user, assessmentId) {
  const session = await assessmentRepository.findById(assessmentId, user.id);
  if (!session) {
    throw new AppError('Assessment session not found.', 404);
  }

  if (session.status !== 'completed') {
    throw new AppError('Finish the assessment before updating the plan.', 400);
  }

  const plan = session.planId
    ? await prepPlanRepository.findById(session.planId, user.id)
    : await resolveActivePlan(user.id);
  if (!plan) {
    throw new AppError('The linked Prep Architect plan could not be found.', 404);
  }

  const weakSpots = uniqueStrings([
    ...(session.weakSpots || []),
    ...(session.recommendations || []).map((item) => item?.topic),
  ], 8);

  if (!weakSpots.length) {
    throw new AppError('No weak spots were found to update the plan.', 400);
  }

  const updatedPlan = await prepArchitectService.updatePlan(user, {
    planId: plan.id,
    knownTopics: plan.knownTopics || [],
    targetTopics: uniqueStrings([...weakSpots, ...(plan.targetTopics || [])], 8),
    timePerDay: plan.timePerDay || 120,
    durationMonths: plan.durationMonths || Number(plan.metadata?.durationMonths || 1) || 1,
    targetRole: plan.targetRole || user.targetRole || null,
  });

  const updatedSession = await assessmentRepository.updateSession(session.id, user.id, {
    metadata: {
      ...(session.metadata || {}),
      appliedPlanUpdateAt: new Date().toISOString(),
      appliedPlanId: updatedPlan.id,
      appliedPlanVersion: updatedPlan.version,
    },
  });

  return {
    session: sanitizeSession(updatedSession, true),
    updatedPlan,
  };
}

module.exports = {
  getOverview,
  generateAssessment,
  submitAssessment,
  applyPlanUpdate,
};
