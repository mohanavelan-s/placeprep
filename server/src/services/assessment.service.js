const assessmentRepository = require('../repositories/assessment.repository');
const prepPlanRepository = require('../repositories/prepPlan.repository');
const taskRepository = require('../repositories/task.repository');
const prepArchitectService = require('./prepArchitect.service');
const { getTodayInTimezone } = require('../utils/date');
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

const GENERIC_TOPIC_TOKENS = new Set([
  'daily',
  'weekly',
  'dsa',
  'core',
  'project',
  'practice',
  'revision',
  'task',
  'prep',
  'focus',
  'lane',
]);

const ASSESSMENT_PHASES = {
  pre: {
    label: 'Pre assessment',
    benchmarkScore: 68,
    benchmarkHeadline: 'Baseline before the heavier reps start.',
  },
  post: {
    label: 'Post assessment',
    benchmarkScore: 82,
    benchmarkHeadline: 'After practice, the answer should feel tighter and cleaner.',
  },
  surprise: {
    label: 'Surprise assessment',
    benchmarkScore: 76,
    benchmarkHeadline: 'Pressure check with less hand-holding and less pattern signaling.',
  },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function pickText(value, fallback = '', maxLength = 220) {
  const text = compactText(value || fallback);
  if (!text) {
    return '';
  }

  if (!maxLength || text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(maxLength - 3, 0)).trim()}...`;
}

function normalizeAssessmentPhase(value) {
  return ['pre', 'post', 'surprise'].includes(String(value || '').trim().toLowerCase())
    ? String(value).trim().toLowerCase()
    : 'pre';
}

function getAssessmentPhaseConfig(phase) {
  return ASSESSMENT_PHASES[normalizeAssessmentPhase(phase)] || ASSESSMENT_PHASES.pre;
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

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Fall through to lightweight string parsing.
    }

    return trimmed.includes(',')
      ? trimmed.split(',').map((entry) => entry.trim()).filter(Boolean)
      : [trimmed];
  }

  if (value && typeof value === 'object') {
    return Object.values(value);
  }

  return [];
}

function normalizeStringList(value, limit = 8) {
  return uniqueStrings(toArray(value), limit);
}

function normalizeRecord(value) {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePlanShape(plan) {
  if (!plan) {
    return null;
  }

  return {
    ...plan,
    knownTopics: normalizeStringList(plan.knownTopics, 8),
    targetTopics: normalizeStringList(plan.targetTopics, 8),
    roadmap: toArray(plan.roadmap).map((week, index) => ({
      week: Number(week?.week || index + 1),
      title: String(week?.title || `Week ${index + 1}`).trim(),
      focusTopics: normalizeStringList(week?.focusTopics || week?.topics, 3),
      estimatedHours: Number(week?.estimatedHours || 0),
      goals: normalizeStringList(week?.goals, 4),
    })),
    tasks: toArray(plan.tasks).map((day, index) => ({
      day: String(day?.day || `Day ${index + 1}`),
      theme: String(day?.theme || 'Focused prep').trim(),
      totalEstimatedMinutes: Number(day?.totalEstimatedMinutes || 0),
      items: toArray(day?.items).map((item) => ({
        ...item,
        title: String(item?.title || '').trim(),
        type: String(item?.type || '').trim(),
        summary: item?.summary ? String(item.summary).trim() : null,
        description: item?.description ? String(item.description).trim() : null,
        referenceLabel: item?.referenceLabel ? String(item.referenceLabel).trim() : null,
        referenceUrl: item?.referenceUrl ? String(item.referenceUrl).trim() : null,
      })),
    })),
    resources: toArray(plan.resources).map((group) => ({
      topic: String(group?.topic || '').trim(),
      items: toArray(group?.items).map((item) => ({
        ...item,
        title: String(item?.title || '').trim(),
        type: String(item?.type || '').trim(),
        url: String(item?.url || '').trim(),
      })).filter((item) => item.title || item.url),
    })).filter((group) => group.topic),
    flashcards: toArray(plan.flashcards).map((card) => ({
      topic: String(card?.topic || '').trim(),
      question: String(card?.question || '').trim(),
      answer: String(card?.answer || '').trim(),
    })).filter((card) => card.topic && card.question && card.answer),
  };
}

function normalizeSessionShape(session) {
  if (!session) {
    return null;
  }

  const normalizedSubmission = normalizeRecord(session.submission);
  const normalizedAnswers = normalizeRecord(normalizedSubmission.answers);

  return {
    ...session,
    weakSpots: normalizeStringList(session.weakSpots, 8),
    recommendations: toArray(session.recommendations).map((recommendation) => ({
      topic: String(recommendation?.topic || '').trim(),
      reason: String(recommendation?.reason || '').trim(),
      action: String(recommendation?.action || '').trim(),
      resourceLabel: recommendation?.resourceLabel ? String(recommendation.resourceLabel).trim() : null,
      resourceUrl: recommendation?.resourceUrl ? String(recommendation.resourceUrl).trim() : null,
      problemLabel: recommendation?.problemLabel ? String(recommendation.problemLabel).trim() : null,
      problemUrl: recommendation?.problemUrl ? String(recommendation.problemUrl).trim() : null,
    })).filter((recommendation) => recommendation.topic && recommendation.action),
    questions: toArray(session.questions).map((question) => ({
      ...question,
      id: String(question?.id || '').trim(),
      topic: String(question?.topic || '').trim(),
      prompt: String(question?.prompt || '').trim(),
      type: String(question?.type || 'mcq').trim(),
      averageTimeMinutes: Number(question?.averageTimeMinutes || 0),
      referenceLabel: question?.referenceLabel ? String(question.referenceLabel).trim() : null,
      referenceUrl: question?.referenceUrl ? String(question.referenceUrl).trim() : null,
      choices: toArray(question?.choices).map((choice, index) => ({
        id: String(choice?.id || `${question?.id || 'choice'}-${index + 1}`).trim(),
        label: String(choice?.label || String.fromCharCode(65 + index)).trim(),
        text: String(choice?.text || '').trim(),
      })).filter((choice) => choice.text),
      placeholder: question?.placeholder ? String(question.placeholder).trim() : null,
      taskTitle: question?.taskTitle ? String(question.taskTitle).trim() : null,
      contextTitle: question?.contextTitle ? String(question.contextTitle).trim() : null,
      contextSummary: question?.contextSummary ? String(question.contextSummary).trim() : null,
      benchmarkLabel: question?.benchmarkLabel ? String(question.benchmarkLabel).trim() : null,
      benchmarkTargetScore: Number(question?.benchmarkTargetScore || 0),
      benchmarkChecks: normalizeStringList(question?.benchmarkChecks, 6),
      expectedTimeComplexity: question?.expectedTimeComplexity ? String(question.expectedTimeComplexity).trim() : null,
      expectedSpaceComplexity: question?.expectedSpaceComplexity ? String(question.expectedSpaceComplexity).trim() : null,
    })).filter((question) => question.id && question.prompt),
    submission: {
      ...normalizedSubmission,
      answers: Object.fromEntries(
        Object.entries(normalizedAnswers).map(([key, value]) => [key, String(value || '')])
      ),
      questionResults: toArray(normalizedSubmission.questionResults).map((result) => ({
        questionId: String(result?.questionId || '').trim(),
        topic: String(result?.topic || '').trim(),
        score: Number(result?.score || 0),
        correct: Boolean(result?.correct),
        feedback: String(result?.feedback || '').trim(),
        strengths: normalizeStringList(result?.strengths, 4),
        weaknesses: normalizeStringList(result?.weaknesses, 4),
        timeComplexity: result?.timeComplexity ? String(result.timeComplexity).trim() : null,
        spaceComplexity: result?.spaceComplexity ? String(result.spaceComplexity).trim() : null,
        industryComparison: result?.industryComparison ? String(result.industryComparison).trim() : null,
        benchmarkScore: Number(result?.benchmarkScore || 0),
        recommendation: result?.recommendation ? String(result.recommendation).trim() : null,
      })).filter((result) => result.questionId),
      submittedAt: normalizedSubmission.submittedAt || session.submittedAt || null,
    },
    metadata: normalizeRecord(session.metadata),
  };
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

  const normalizedPlan = normalizePlanShape(plan);

  return {
    id: normalizedPlan.id,
    title: typeof normalizedPlan.metadata?.title === 'string'
      ? normalizedPlan.metadata.title
      : (typeof normalizedPlan.title === 'string' ? normalizedPlan.title : null),
    targetRole: normalizedPlan.targetRole || null,
    targetTopics: normalizedPlan.targetTopics || [],
    knownTopics: normalizedPlan.knownTopics || [],
    timePerDay: normalizedPlan.timePerDay || 120,
    durationMonths: normalizedPlan.durationMonths || Number(normalizedPlan.metadata?.durationMonths || 1) || 1,
    version: Number(normalizedPlan.version || 1),
    isActive: Boolean(normalizedPlan.isActive),
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
    contextTitle: question.contextTitle || null,
    contextSummary: question.contextSummary || null,
    benchmarkLabel: question.benchmarkLabel || null,
    benchmarkTargetScore: Number(question.benchmarkTargetScore || 0),
    benchmarkChecks: Array.isArray(question.benchmarkChecks) ? question.benchmarkChecks : [],
    expectedTimeComplexity: question.expectedTimeComplexity || null,
    expectedSpaceComplexity: question.expectedSpaceComplexity || null,
  };
}

function normalizeAssessmentReport(report) {
  const normalized = normalizeRecord(report);

  if (!Object.keys(normalized).length) {
    return null;
  }

  return {
    summary: compactText(normalized.summary),
    benchmarkScore: Number(normalized.benchmarkScore || 0),
    benchmarkStatus: compactText(normalized.benchmarkStatus),
    benchmarkComparison: compactText(normalized.benchmarkComparison),
    phaseAverageScore: Number(normalized.phaseAverageScore || 0),
    phaseDeltaScore: Number(normalized.phaseDeltaScore || 0),
    attemptsInPhase: Number(normalized.attemptsInPhase || 0),
    strongSpots: normalizeStringList(normalized.strongSpots, 6),
    weakSpots: normalizeStringList(normalized.weakSpots, 6),
    strongSignals: normalizeStringList(normalized.strongSignals, 6),
    gapSignals: normalizeStringList(normalized.gapSignals, 6),
    fixPlan: normalizeStringList(normalized.fixPlan, 5),
    motivation: compactText(normalized.motivation),
    consistencyLine: compactText(normalized.consistencyLine),
  };
}

function sanitizeSession(session, includeQuestions = false) {
  if (!session) {
    return null;
  }

  const normalizedSession = normalizeSessionShape(session);
  const assessmentPhase = normalizeAssessmentPhase(
    normalizedSession.assessmentPhase
    || normalizedSession.metadata?.assessmentPhase
    || normalizedSession.metadata?.phase
  );

  return {
    ...normalizedSession,
    assessmentScope: normalizedSession.assessmentScope || normalizedSession.metadata?.scope || 'daily',
    assessmentPhase,
    expiresAt: normalizedSession.metadata?.expiresAt || null,
    report: normalizeAssessmentReport(normalizedSession.report || normalizedSession.metadata?.report || null),
    questions: includeQuestions ? normalizedSession.questions.map(sanitizeQuestion).filter(Boolean) : [],
  };
}

function topicMatchesText(topic, value) {
  const normalizedTopic = normalizeText(topic);
  const normalizedValue = normalizeText(value);

  return Boolean(
    normalizedTopic
    && normalizedValue
    && (
      normalizedValue.includes(normalizedTopic)
      || normalizedTopic.includes(normalizedValue)
    )
  );
}

function looksGenericTopic(value) {
  const normalized = normalizeText(value);
  return !normalized || GENERIC_TOPIC_TOKENS.has(normalized);
}

function normalizeReferenceCore(value) {
  return String(value || '')
    .replace(/^(leetcode|hackerrank|codechef|geeksforgeeks|youtube|freecodecamp|bro code|codewithmosh)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferTaskTopic(task, plan) {
  const focusTopics = uniqueStrings([
    ...(plan.targetTopics || []),
    ...(plan.knownTopics || []),
    ...(plan.roadmap || []).flatMap((week) => week.focusTopics || []),
    ...(plan.resources || []).map((group) => group.topic),
    ...(plan.flashcards || []).map((card) => card.topic),
  ], 20);
  const combinedText = [
    task.theme,
    task.weakArea,
    task.subcategory,
    task.title,
    task.referenceLabel,
    task.description,
    task.summary,
  ].join(' ');
  const matchedFocusTopic = focusTopics.find((topic) => topicMatchesText(topic, combinedText));

  if (matchedFocusTopic) {
    return matchedFocusTopic;
  }

  const themeCandidate = String(task.theme || task.subcategory || task.weakArea || '')
    .split(/\s+into\s+/i)
    .map((part) => String(part || '').trim())
    .find((part) => part && !looksGenericTopic(part));

  if (themeCandidate) {
    return themeCandidate;
  }

  const referenceCandidate = normalizeReferenceCore(task.referenceLabel || task.title || '');
  if (referenceCandidate && !looksGenericTopic(referenceCandidate)) {
    return referenceCandidate;
  }

  return (plan.targetTopics || [])[0]
    || (plan.knownTopics || [])[0]
    || plan.targetRole
    || 'Prep';
}

function findTaskForTopic(taskPool = [], topic) {
  return taskPool.find((task) => {
    const combinedText = [
      task.topic,
      task.theme,
      task.weakArea,
      task.subcategory,
      task.title,
      task.referenceLabel,
      task.description,
      task.summary,
    ].join(' ');
    return topicMatchesText(topic, combinedText);
  }) || null;
}

function buildAssessmentReference(plan, topic, taskPool = []) {
  const relatedTask = findTaskForTopic(taskPool, topic) || findTaskForTopic(flattenPlanItems(plan), topic);
  if (relatedTask?.referenceUrl) {
    return {
      referenceLabel: relatedTask.referenceLabel || relatedTask.title || topic,
      referenceUrl: relatedTask.referenceUrl,
      taskTitle: relatedTask.title || null,
      contextSummary: relatedTask.description || relatedTask.summary || null,
    };
  }

  const resourceGroup = findResourceForTopic(plan, topic);
  const resourceItem = resourceGroup?.items?.find((item) => item?.url) || null;
  return {
    referenceLabel: resourceItem?.title || null,
    referenceUrl: resourceItem?.url || null,
    taskTitle: relatedTask?.title || null,
    contextSummary: relatedTask?.description || relatedTask?.summary || null,
  };
}

function buildTaskSource(task, plan, sourceKind = 'daily-task') {
  const topic = inferTaskTopic(task, plan);
  const reference = buildAssessmentReference(plan, topic, [task]);

  return {
    kind: 'task',
    sourceKind,
    topic,
    taskType: String(task.type || task.category || 'Practice').trim(),
    taskTitle: task.title || reference.taskTitle || null,
    referenceLabel: task.referenceLabel || task.title || reference.referenceLabel || topic,
    referenceUrl: task.referenceUrl || reference.referenceUrl || null,
    theme: task.theme || task.subcategory || task.weakArea || null,
    description: pickText(
      task.description
      || task.summary
      || task.metadata?.coachReason
      || reference.contextSummary
      || '',
      '',
      200,
    ),
  };
}

function buildTopicSource(topic, plan, sourceKind = 'known-topic', taskPool = []) {
  const reference = buildAssessmentReference(plan, topic, taskPool);
  return {
    kind: 'topic',
    sourceKind,
    topic: String(topic || '').trim(),
    taskType: 'Revision',
    taskTitle: reference.taskTitle || null,
    referenceLabel: reference.referenceLabel || String(topic || '').trim(),
    referenceUrl: reference.referenceUrl || null,
    theme: null,
    description: pickText(reference.contextSummary || '', '', 200),
  };
}

function dedupeSources(sources = []) {
  const seen = new Set();
  return sources.filter((source) => {
    const fingerprint = [
      source.kind,
      source.sourceKind,
      normalizeText(source.topic),
      normalizeText(source.referenceLabel),
      String(source.referenceUrl || ''),
    ].join('::');

    if (seen.has(fingerprint)) {
      return false;
    }

    seen.add(fingerprint);
    return true;
  });
}

function interleaveSourceBuckets(buckets = [], limit = 6) {
  const queues = buckets.map((bucket) => [...bucket].filter(Boolean));
  const ordered = [];

  while (ordered.length < limit && queues.some((bucket) => bucket.length)) {
    queues.forEach((bucket) => {
      if (bucket.length && ordered.length < limit) {
        ordered.push(bucket.shift());
      }
    });
  }

  return ordered;
}

function getQuestionCount(assessmentType, durationMinutes, assessmentScope) {
  if (assessmentType === 'coding') {
    return clamp(Math.round(durationMinutes / (assessmentScope === 'weekly' ? 16 : 18)), assessmentScope === 'weekly' ? 3 : 2, 4);
  }

  return clamp(Math.round(durationMinutes / 5), 4, assessmentScope === 'weekly' ? 8 : 6);
}

function buildAssessmentSources(plan, taskPool = [], assessmentType, durationMinutes, assessmentScope = 'daily', assessmentPhase = 'pre') {
  const questionCount = getQuestionCount(assessmentType, durationMinutes, assessmentScope);
  const weeklyPlanTasks = flattenPlanItems(plan).filter((item) => item.type !== 'Revision');
  const dailyTasks = (taskPool || []).length ? taskPool : weeklyPlanTasks.slice(0, 4);

  const dailyTaskSources = dedupeSources(dailyTasks.map((task) => buildTaskSource(task, plan, 'daily-task')));
  const weeklyTaskSources = dedupeSources((weeklyPlanTasks.length ? weeklyPlanTasks : dailyTasks).map((task) => buildTaskSource(task, plan, 'weekly-task')));
  const knownTopicSources = dedupeSources((plan.knownTopics || []).map((topic) =>
    buildTopicSource(topic, plan, 'known-topic', assessmentScope === 'weekly' ? weeklyPlanTasks : dailyTasks)
  ));
  const targetTopicSources = dedupeSources((plan.targetTopics || []).map((topic) =>
    buildTopicSource(topic, plan, 'target-topic', assessmentScope === 'weekly' ? weeklyPlanTasks : dailyTasks)
  ));
  const weeklyFocusSources = dedupeSources((plan.roadmap || [])
    .slice(0, 2)
    .flatMap((week) => week.focusTopics || [])
    .map((topic) => buildTopicSource(topic, plan, 'weekly-focus', weeklyPlanTasks)));

  const orderedSources = assessmentPhase === 'surprise'
    ? shuffle(dedupeSources([
      ...weeklyTaskSources,
      ...dailyTaskSources,
      ...targetTopicSources,
      ...knownTopicSources,
      ...weeklyFocusSources,
    ])).slice(0, questionCount)
    : assessmentScope === 'weekly'
      ? interleaveSourceBuckets([weeklyTaskSources, knownTopicSources, targetTopicSources, weeklyFocusSources], questionCount)
      : interleaveSourceBuckets([dailyTaskSources, knownTopicSources, targetTopicSources], questionCount);

  return orderedSources.length
    ? orderedSources.slice(0, questionCount)
    : [...dailyTaskSources, ...knownTopicSources, ...targetTopicSources, ...weeklyFocusSources].slice(0, questionCount);
}

function findFlashcardForSource(plan, source) {
  const sourceSignal = [
    source.topic,
    source.referenceLabel,
    source.taskTitle,
    source.theme,
  ].join(' ');

  return (plan.flashcards || []).find((card) => (
    topicMatchesText(card.topic, sourceSignal)
    || topicMatchesText(source.topic, `${card.question} ${card.answer}`)
  )) || null;
}

function buildContextualAnswer(source, flashcard) {
  if (flashcard?.answer) {
    return String(flashcard.answer).trim();
  }

  if (source.kind === 'task') {
    const normalizedTaskType = normalizeText(source.taskType);
    if (normalizedTaskType.includes('project')) {
      return `For ${source.referenceLabel || source.taskTitle || source.topic}, tie the work to one implementation step, one measurable outcome, and one clear takeaway.`;
    }

    if (normalizedTaskType.includes('revision') || normalizedTaskType.includes('core')) {
      return `${source.topic} becomes interview-ready when you define it clearly, explain one tradeoff, and connect it to one practical use case.`;
    }

    return `For ${source.referenceLabel || source.taskTitle || source.topic}, identify the core pattern, the main data structure, and the time complexity before coding.`;
  }

  return `${source.topic} becomes solid when you can explain the core idea, the main tradeoff, and one example without looking at notes.`;
}

function buildBlankPromptLabel(source, assessmentScope) {
  if (source.kind === 'task') {
    return assessmentScope === 'weekly'
      ? `this week's task ${source.referenceLabel || source.taskTitle || source.topic}`
      : `today's task ${source.referenceLabel || source.taskTitle || source.topic}`;
  }

  return source.topic || (assessmentScope === 'weekly' ? 'this weekly focus' : 'your current focus');
}

function chooseBlankPhrase(answer, source) {
  if (source.topic && !looksGenericTopic(source.topic) && topicMatchesText(source.topic, answer)) {
    return source.topic;
  }

  const referenceCore = normalizeReferenceCore(source.referenceLabel || source.taskTitle || '');
  if (referenceCore && referenceCore.split(/\s+/).length <= 4 && topicMatchesText(referenceCore, answer)) {
    return referenceCore;
  }

  return extractKeyPhrase(answer) || source.topic || 'core idea';
}

function inferComplexityBenchmarks(topic) {
  const normalized = normalizeText(topic);

  if (normalized.includes('array') || normalized.includes('string')) {
    return {
      time: 'O(n) to O(n log n), depending on the chosen approach',
      space: 'O(1) to O(n), depending on auxiliary storage',
    };
  }

  if (normalized.includes('tree') || normalized.includes('graph')) {
    return {
      time: 'O(V + E) or O(n), depending on the traversal model',
      space: 'O(V) or O(n) for recursion, queue, or visited state',
    };
  }

  if (normalized.includes('dynamic')) {
    return {
      time: 'State the transition cost clearly, usually O(n) or O(n*m)',
      space: 'State the table or memo footprint clearly',
    };
  }

  if (normalized.includes('sql') || normalized.includes('db')) {
    return {
      time: 'Explain the dominant scan or join cost clearly',
      space: 'Explain any temporary grouping or sorting footprint',
    };
  }

  return {
    time: 'State the dominant runtime clearly',
    space: 'State the extra memory cost clearly',
  };
}

function buildBenchmarkChecks(questionType, assessmentPhase) {
  const phaseConfig = getAssessmentPhaseConfig(assessmentPhase);

  if (questionType === 'coding') {
    return uniqueStrings([
      'Name the core approach before or while you code',
      'Mention one supporting structure or state choice',
      'State time complexity explicitly',
      'State space complexity explicitly',
      assessmentPhase === 'surprise'
        ? 'Stay clear under pressure without depending on the original link'
        : `Hit at least the ${phaseConfig.benchmarkScore}% delivery bar for this phase`,
    ], 5);
  }

  return uniqueStrings([
    'Stay precise instead of vague',
    'Answer in the same lane as the plan focus',
    assessmentPhase === 'post'
      ? 'Show that the practice actually stuck'
      : 'Prove that the idea is available from memory',
    `Aim for the ${phaseConfig.benchmarkScore}% benchmark for this phase`,
  ], 4);
}

function buildAssessmentBrief(source, flashcard, assessmentPhase) {
  const phaseConfig = getAssessmentPhaseConfig(assessmentPhase);
  const flashcardAnswer = pickText(flashcard?.answer, '', 180);
  const description = pickText(source.description, '', 180);

  if (assessmentPhase === 'surprise') {
    return pickText(
      description
      || flashcardAnswer
      || `${phaseConfig.label}: solve ${source.topic || source.referenceLabel || 'this prompt'} from first principles and keep the explanation self-contained.`,
      '',
      180,
    );
  }

  if (flashcardAnswer) {
    return flashcardAnswer;
  }

  if (description) {
    return description;
  }

  return pickText(
    source.kind === 'task'
      ? `${phaseConfig.label}: use ${source.referenceLabel || source.taskTitle || source.topic} as the working context and explain the idea with one clear tradeoff.`
      : `${phaseConfig.label}: explain ${source.topic || 'the current focus'} cleanly enough that you could say it out loud in an interview.`,
    '',
    180,
  );
}

function buildQuestionMeta(source, flashcard, questionType, assessmentPhase) {
  const phaseConfig = getAssessmentPhaseConfig(assessmentPhase);
  const complexity = questionType === 'coding'
    ? inferComplexityBenchmarks(source.topic || source.referenceLabel || source.taskTitle)
    : { time: null, space: null };

  return {
    contextTitle: source.kind === 'task'
      ? `${phaseConfig.label} brief`
      : `${phaseConfig.label} focus`,
    contextSummary: buildAssessmentBrief(source, flashcard, assessmentPhase),
    benchmarkLabel: `${phaseConfig.label} / industry-style delivery`,
    benchmarkTargetScore: phaseConfig.benchmarkScore,
    benchmarkChecks: buildBenchmarkChecks(questionType, assessmentPhase),
    expectedTimeComplexity: complexity.time,
    expectedSpaceComplexity: complexity.space,
  };
}

function buildMcqQuestions(plan, sources, durationMinutes, assessmentPhase = 'pre') {
  const fallbackSources = sources.length ? sources : buildAssessmentSources(plan, [], 'mcq', durationMinutes, 'daily', assessmentPhase);
  const answersBySource = fallbackSources.map((source) => ({
    source,
    flashcard: findFlashcardForSource(plan, source),
  }));

  return answersBySource.map(({ source, flashcard }, index) => {
    const questionId = `mcq-${index + 1}-${slugify(source.referenceLabel || source.topic || `topic-${index + 1}`)}`;
    const correctText = buildContextualAnswer(source, flashcard);
    const distractors = uniqueStrings([
      ...answersBySource
        .map((entry) => buildContextualAnswer(entry.source, entry.flashcard))
        .filter((entry) => entry && normalizeText(entry) !== normalizeText(correctText)),
      ...GENERIC_DISTRACTORS,
    ], 10);
    const optionTexts = shuffle([correctText, ...distractors.slice(0, 3)]).slice(0, 4);
    const options = optionTexts.map((text, optionIndex) => ({
      id: `${questionId}-option-${optionIndex + 1}`,
      label: String.fromCharCode(65 + optionIndex),
      text,
    }));
    const correctOption = options.find((option) => normalizeText(option.text) === normalizeText(correctText)) || options[0];

    return {
      id: questionId,
      type: 'mcq',
      topic: source.topic,
      prompt: flashcard?.question
        ? String(flashcard.question).trim()
        : source.kind === 'task'
          ? `Which explanation best matches ${source.referenceLabel || source.taskTitle || source.topic}?`
          : `Which explanation best matches ${source.topic} in your current prep plan?`,
      averageTimeMinutes: clamp(Math.floor(durationMinutes / Math.max(fallbackSources.length, 1)), 3, 8),
      referenceLabel: source.referenceLabel || null,
      referenceUrl: source.referenceUrl || null,
      taskTitle: source.taskTitle || null,
      choices: options,
      correctOptionId: correctOption.id,
      expectedAnswer: correctText,
      explanation: correctText,
      ...buildQuestionMeta(source, flashcard, 'mcq', assessmentPhase),
    };
  });
}

function buildFillBlankQuestions(plan, sources, durationMinutes, assessmentScope = 'daily', assessmentPhase = 'pre') {
  const fallbackSources = sources.length ? sources : buildAssessmentSources(plan, [], 'fill_blank', durationMinutes, assessmentScope, assessmentPhase);

  return fallbackSources.map((source, index) => {
    const flashcard = findFlashcardForSource(plan, source);
    const answer = buildContextualAnswer(source, flashcard);
    const keyPhrase = chooseBlankPhrase(answer, source);
    const blankedAnswer = answer.includes(keyPhrase)
      ? answer.replace(keyPhrase, '_____')
      : `_____ ${answer}`.trim();

    return {
      id: `fill-${index + 1}-${slugify(source.referenceLabel || source.topic || `topic-${index + 1}`)}`,
      type: 'fill_blank',
      topic: source.topic,
      prompt: `Fill in the blank for ${buildBlankPromptLabel(source, assessmentScope)}: ${blankedAnswer}`,
      averageTimeMinutes: clamp(Math.floor(durationMinutes / Math.max(fallbackSources.length, 1)), 3, 8),
      referenceLabel: source.referenceLabel || null,
      referenceUrl: source.referenceUrl || null,
      taskTitle: source.taskTitle || null,
      placeholder: 'Type the missing idea in one short phrase',
      expectedAnswer: keyPhrase,
      expectedKeywords: extractKeywords(answer, extractKeywords(keyPhrase)),
      explanation: answer,
      ...buildQuestionMeta(source, flashcard, 'fill_blank', assessmentPhase),
    };
  });
}

function buildCodingQuestions(plan, sources, durationMinutes, assessmentScope = 'daily', assessmentPhase = 'pre') {
  const taskSources = sources.filter((source) => source.kind === 'task');
  const baseSources = (taskSources.length ? taskSources : sources).slice(0, getQuestionCount('coding', durationMinutes, assessmentScope));

  return baseSources.map((source, index) => {
    const referenceLabel = source.referenceLabel || source.taskTitle || source.topic || `Timed prompt ${index + 1}`;
    const expectedKeywords = uniqueStrings([
      ...buildTopicKeywordHints(source.topic || referenceLabel),
      ...extractKeywords(referenceLabel),
      'time',
      'complexity',
    ], 8);

    const questionMeta = buildQuestionMeta(source, null, 'coding', assessmentPhase);

    return {
      id: `code-${index + 1}-${slugify(referenceLabel)}`,
      type: 'coding',
      topic: source.topic || referenceLabel,
      prompt: `Write a short programming solution or pseudocode for ${referenceLabel}. Keep it interview-length, mention the main approach, the key data structure, and the expected time complexity.`,
      averageTimeMinutes: clamp(Math.floor(durationMinutes / Math.max(baseSources.length, 1)), 15, 45),
      referenceLabel,
      referenceUrl: source.referenceUrl || null,
      taskTitle: source.taskTitle || referenceLabel,
      placeholder: 'Use a compact solution sketch. Code or structured pseudocode both work here.',
      expectedKeywords,
      explanation: `A strong answer should clearly state the approach for ${referenceLabel}, name one relevant data structure, and include both time and space complexity.`,
      ...questionMeta,
    };
  });
}

function buildQuestions(plan, taskPool, assessmentType, durationMinutes, assessmentScope = 'daily', assessmentPhase = 'pre') {
  const sources = buildAssessmentSources(plan, taskPool, assessmentType, durationMinutes, assessmentScope, assessmentPhase);

  if (assessmentType === 'coding') {
    return buildCodingQuestions(plan, sources, durationMinutes, assessmentScope, assessmentPhase);
  }

  if (assessmentType === 'fill_blank') {
    return buildFillBlankQuestions(plan, sources, durationMinutes, assessmentScope, assessmentPhase);
  }

  return buildMcqQuestions(plan, sources, durationMinutes, assessmentPhase);
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

function extractComplexityMentions(response) {
  return uniqueStrings(
    Array.from(String(response || '').matchAll(/o\([^)]*\)/gi)).map((match) => match[0]),
    4,
  );
}

function extractComplexityMention(response, kind = 'time') {
  const text = String(response || '');
  const labeledMatch = text.match(
    kind === 'space'
      ? /space(?:\s+complexity|\s+cost)?\s*[:=-]?\s*(O\([^)]*\))/i
      : /time(?:\s+complexity|\s+cost)?\s*[:=-]?\s*(O\([^)]*\))/i
  );

  if (labeledMatch?.[1]) {
    return labeledMatch[1];
  }

  const mentions = extractComplexityMentions(text);
  if (!mentions.length) {
    return null;
  }

  return kind === 'space'
    ? (mentions[1] || null)
    : (mentions[0] || null);
}

function normalizeComplexitySignature(value) {
  const normalized = normalizeText(value).replace(/\s+/g, '');

  if (!normalized) {
    return '';
  }
  if (normalized.includes('1')) {
    return 'constant';
  }
  if (normalized.includes('v+e')) {
    return 'graph-traversal';
  }
  if (normalized.includes('nlogn')) {
    return 'n-log-n';
  }
  if (normalized.includes('n2') || normalized.includes('n^2')) {
    return 'quadratic';
  }
  if (normalized.includes('logn')) {
    return 'logarithmic';
  }
  if (normalized.includes('n')) {
    return 'linear-family';
  }

  return normalized;
}

function scoreComplexityMention(expected, actual) {
  if (!actual) {
    return 0;
  }

  if (!expected) {
    return 1;
  }

  const expectedSignature = normalizeComplexitySignature(expected);
  const actualSignature = normalizeComplexitySignature(actual);

  if (!expectedSignature || !actualSignature) {
    return 0.6;
  }

  if (expectedSignature === actualSignature) {
    return 1;
  }

  if (
    expectedSignature === 'linear-family'
    && ['linear-family', 'n-log-n', 'graph-traversal'].includes(actualSignature)
  ) {
    return 0.8;
  }

  if (expectedSignature === 'graph-traversal' && actualSignature === 'linear-family') {
    return 0.7;
  }

  return 0.45;
}

function buildIndustryComparison(score, benchmarkTargetScore) {
  const target = Number(benchmarkTargetScore || 75);
  const scorePercent = Math.round(Number(score || 0) * 100);

  if (scorePercent >= target + 8) {
    return `Above the current industry bar. ${scorePercent}% against a ${target}% benchmark.`;
  }

  if (scorePercent >= target) {
    return `At the current industry bar. ${scorePercent}% against a ${target}% benchmark.`;
  }

  if (scorePercent >= target - 10) {
    return `Close to the current industry bar. ${scorePercent}% against a ${target}% benchmark.`;
  }

  return `Below the current industry bar. ${scorePercent}% against a ${target}% benchmark.`;
}

function gradeQuestion(question, response) {
  const normalizedResponse = normalizeText(response);
  const benchmarkTargetScore = Number(question?.benchmarkTargetScore || 75);
  const minimumStrongScore = Math.max(0.6, (benchmarkTargetScore / 100) - 0.06);

  if (question.type === 'mcq') {
    const isCorrect = String(response || '').trim() === question.correctOptionId;
    const score = isCorrect ? 1 : 0;

    return {
      questionId: question.id,
      topic: question.topic,
      score,
      correct: isCorrect,
      feedback: isCorrect
        ? 'Good read. The selected answer matches the planned recall target quickly and cleanly.'
        : 'This one slipped. Revisit the explanation, then repeat the concept without looking at the source.',
      strengths: isCorrect ? ['Concept recognition stayed sharp under pressure'] : [],
      weaknesses: isCorrect ? [] : ['Concept recall broke on a direct recognition prompt'],
      timeComplexity: null,
      spaceComplexity: null,
      industryComparison: buildIndustryComparison(score, benchmarkTargetScore),
      benchmarkScore: score,
      recommendation: isCorrect
        ? 'Keep the same pace, then move to a harder prompt in the same lane.'
        : `Repeat ${question.topic} once more and explain why the correct option wins.`,
    };
  }

  if (question.type === 'fill_blank') {
    const expectedAnswer = normalizeText(question.expectedAnswer);
    const keywordScore = scoreTextAgainstKeywords(response, question.expectedKeywords || []);
    const isCorrect = normalizedResponse.includes(expectedAnswer) || keywordScore >= 0.6;
    const score = isCorrect ? 1 : keywordScore >= 0.55 ? 0.7 : keywordScore >= 0.35 ? 0.4 : 0;

    return {
      questionId: question.id,
      topic: question.topic,
      score,
      correct: score >= minimumStrongScore,
      feedback: isCorrect
        ? 'Nice. The missing idea is intact.'
        : `Tighten the recall phrase for ${question.topic} and keep it short enough to say under pressure.`,
      strengths: isCorrect ? ['The core phrase was recoverable from memory'] : [],
      weaknesses: isCorrect ? [] : ['Recall phrase is still too fuzzy or too slow'],
      timeComplexity: null,
      spaceComplexity: null,
      industryComparison: buildIndustryComparison(score, benchmarkTargetScore),
      benchmarkScore: score,
      recommendation: isCorrect
        ? `Turn ${question.topic} into one spoken line and keep it available.`
        : `Shrink ${question.topic} into one exact recall phrase and repeat it until it is effortless.`,
    };
  }

  const keywordScore = scoreTextAgainstKeywords(response, question.expectedKeywords || []);
  const responseText = String(response || '').trim();
  const hasComplexitySignal = /o\(|time complexity|space complexity/.test(String(response || '').toLowerCase());
  const hasCodeSignal = /(for|while|if|return|function|def|class|select|join|group by)/i.test(String(response || ''));
  const mentionsEdgeCases = /edge case|empty|duplicate|null|overflow|boundary|single/i.test(responseText);
  const timeComplexity = extractComplexityMention(responseText, 'time');
  const spaceComplexity = extractComplexityMention(responseText, 'space');
  const timeScore = scoreComplexityMention(question.expectedTimeComplexity, timeComplexity);
  const spaceScore = scoreComplexityMention(question.expectedSpaceComplexity, spaceComplexity);
  const structureScore = responseText.length >= 180
    ? 1
    : responseText.length >= 100
      ? 0.78
      : responseText.length >= 60
        ? 0.55
        : 0.2;
  const implementationScore = hasCodeSignal ? 0.9 : 0.45;
  const edgeCaseScore = mentionsEdgeCases ? 1 : 0.35;
  const score = clamp(Number((
    (keywordScore * 0.26)
    + (structureScore * 0.18)
    + (implementationScore * 0.18)
    + (timeScore * 0.2)
    + (spaceScore * 0.12)
    + (edgeCaseScore * 0.06)
  ).toFixed(2)), 0, 1);
  const correct = score >= minimumStrongScore;
  const strengths = uniqueStrings([
    keywordScore >= 0.7 ? 'Core approach is visible' : '',
    hasCodeSignal ? 'Implementation structure is present' : '',
    timeComplexity ? `Time complexity stated as ${timeComplexity}` : '',
    spaceComplexity ? `Space complexity stated as ${spaceComplexity}` : '',
    mentionsEdgeCases ? 'Edge case awareness is visible' : '',
  ], 4);
  const weaknesses = uniqueStrings([
    keywordScore < 0.55 ? 'Approach explanation is still thin' : '',
    !hasCodeSignal ? 'Implementation structure is not concrete enough' : '',
    !timeComplexity ? 'Time complexity is missing' : '',
    !spaceComplexity ? 'Space complexity is missing' : '',
    !mentionsEdgeCases ? 'No edge case or boundary handling was called out' : '',
  ], 4);

  return {
    questionId: question.id,
    topic: question.topic,
    score,
    correct,
    feedback: correct
      ? 'Solid. The solution sketch reads close to an interview-ready answer.'
      : 'Add the approach, one supporting structure, and explicit time and space complexity so the answer reads like a production interview response.',
    strengths,
    weaknesses,
    timeComplexity: timeComplexity || null,
    spaceComplexity: spaceComplexity || null,
    industryComparison: buildIndustryComparison(score, benchmarkTargetScore),
    benchmarkScore: score,
    recommendation: weaknesses.length
      ? `Next pass: ${weaknesses.slice(0, 2).join('; ')}.`
      : 'Keep the same structure and push one level harder.',
  };
}

function buildBenchmarkStatus(score, benchmarkScore) {
  const delta = Number(score || 0) - Number(benchmarkScore || 0);

  if (delta >= 8) {
    return 'above';
  }
  if (delta >= 0) {
    return 'at';
  }
  if (delta >= -10) {
    return 'close';
  }
  return 'below';
}

function buildAssessmentReport({
  phase,
  questionResults,
  score,
  recommendations,
  previousSessions,
  targetRole,
  timedOut,
}) {
  const phaseConfig = getAssessmentPhaseConfig(phase);
  const strongSpots = uniqueStrings(
    questionResults.filter((item) => Number(item.score || 0) >= 0.75).map((item) => item.topic),
    6,
  );
  const weakSpots = uniqueStrings(
    questionResults.filter((item) => Number(item.score || 0) < 0.75).map((item) => item.topic),
    6,
  );
  const strongSignals = uniqueStrings(questionResults.flatMap((item) => item.strengths || []), 6);
  const gapSignals = uniqueStrings(questionResults.flatMap((item) => item.weaknesses || []), 6);
  const priorPhaseScores = previousSessions
    .map(normalizeSessionShape)
    .filter((entry) =>
      entry
      && entry.status === 'completed'
      && normalizeAssessmentPhase(entry.metadata?.assessmentPhase || entry.assessmentPhase) === phase
    )
    .map((entry) => Number(entry.score || 0));
  const phaseAverageScore = priorPhaseScores.length
    ? Number((priorPhaseScores.reduce((sum, value) => sum + value, 0) / priorPhaseScores.length).toFixed(2))
    : Number(score || 0);
  const phaseDeltaScore = Number((Number(score || 0) - phaseAverageScore).toFixed(2));
  const benchmarkStatus = buildBenchmarkStatus(score, phaseConfig.benchmarkScore);
  const benchmarkComparison = benchmarkStatus === 'above'
    ? `You cleared the ${phaseConfig.label.toLowerCase()} bar and landed above the current ${phaseConfig.benchmarkScore}% benchmark.`
    : benchmarkStatus === 'at'
      ? `You met the ${phaseConfig.label.toLowerCase()} bar and reached the current ${phaseConfig.benchmarkScore}% benchmark.`
      : benchmarkStatus === 'close'
        ? `You are close to the ${phaseConfig.label.toLowerCase()} bar. The benchmark is ${phaseConfig.benchmarkScore}% and the next honest block can close that gap.`
        : `You are below the ${phaseConfig.label.toLowerCase()} bar. The benchmark is ${phaseConfig.benchmarkScore}%, so the next plan update should focus hard on the exposed topics.`;

  return {
    summary: benchmarkStatus === 'below'
      ? `${phaseConfig.label} exposed real gaps for ${targetRole || 'your target role'} in ${weakSpots.slice(0, 2).join(' and ') || 'the current focus lane'}.`
      : `${phaseConfig.label} showed measurable control in ${strongSpots.slice(0, 2).join(' and ') || 'the current focus lane'}.`,
    benchmarkScore: phaseConfig.benchmarkScore,
    benchmarkStatus,
    benchmarkComparison,
    phaseAverageScore,
    phaseDeltaScore,
    attemptsInPhase: priorPhaseScores.length + 1,
    strongSpots,
    weakSpots,
    strongSignals,
    gapSignals,
    fixPlan: uniqueStrings([
      ...recommendations.map((item) => item.action),
      weakSpots.length
        ? `Push ${weakSpots.slice(0, 2).join(' and ')} back into the plan until the answer quality feels natural.`
        : '',
      timedOut
        ? 'Run one more timed block so the delivery stays clean when the clock is visible.'
        : '',
    ], 5),
    motivation: benchmarkStatus === 'below'
      ? 'Consistency is the edge here. Do not chase a perfect jump. Stack the next honest reps and let the weak spots tighten.'
      : 'Consistency is still the edge. Keep the standard, keep the reps clean, and let the plan compound.',
    consistencyLine: 'Consistency is key. Follow the plan, keep the reps honest, and the score will move.',
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
  const plan = await prepPlanRepository.findLatestActiveByUser(userId);
  return normalizePlanShape(plan);
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
  const assessmentScope = payload.assessmentScope === 'weekly' ? 'weekly' : 'daily';
  const assessmentPhase = normalizeAssessmentPhase(payload.assessmentPhase);
  const durationMinutes = clamp(Number(payload.durationMinutes || 20), 10, 90);
  const today = getTodayInTimezone(user.timezone);
  const todaysTasks = await taskRepository.listByUser(user.id, { date: today });
  const questions = buildQuestions(
    activePlan,
    todaysTasks,
    assessmentType,
    durationMinutes,
    assessmentScope,
    assessmentPhase,
  );
  const startedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (durationMinutes * 60000)).toISOString();

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
      scope: assessmentScope,
      assessmentPhase,
      phaseLabel: getAssessmentPhaseConfig(assessmentPhase).label,
      phaseHeadline: getAssessmentPhaseConfig(assessmentPhase).benchmarkHeadline,
      sourceTaskCount: todaysTasks.length,
      sourceKnownTopicCount: (activePlan.knownTopics || []).length,
      questionCount: questions.length,
      expiresAt,
    },
    startedAt,
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

  const normalizedSession = normalizeSessionShape(session);
  const answers = payload.answers && typeof payload.answers === 'object' && !Array.isArray(payload.answers)
    ? payload.answers
    : {};
  const timedOut = payload.timedOut === true;
  const assessmentPhase = normalizeAssessmentPhase(
    normalizedSession.metadata?.assessmentPhase
    || normalizedSession.assessmentPhase
  );
  const plan = normalizedSession.planId
    ? normalizePlanShape(await prepPlanRepository.findById(normalizedSession.planId, user.id))
    : await resolveActivePlan(user.id);

  if (!plan) {
    throw new AppError('The linked Prep Architect plan could not be found.', 404);
  }

  const previousSessions = await assessmentRepository.listByUser(user.id, 12);
  const questionResults = (normalizedSession.questions || []).map((question) =>
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
  const strongSpots = uniqueStrings(
    questionResults
      .filter((item) => Number(item.score || 0) >= 0.75)
      .map((item) => item.topic),
    5,
  );
  const recommendations = buildRecommendations(plan, weakSpots, normalizedSession.assessmentType);
  const report = buildAssessmentReport({
    phase: assessmentPhase,
    questionResults,
    score: roundedScore,
    recommendations,
    previousSessions: previousSessions.filter((entry) => entry.id !== normalizedSession.id),
    targetRole: plan.targetRole || user.targetRole || null,
    timedOut,
  });
  const submittedAt = new Date().toISOString();

  const updatedSession = await assessmentRepository.updateSession(normalizedSession.id, user.id, {
    status: 'completed',
    weakSpots,
    recommendations,
    score: roundedScore,
    submission: {
      answers,
      questionResults,
      submittedAt,
      timedOut,
    },
    submittedAt,
    metadata: {
      ...(normalizedSession.metadata || {}),
      latestScore: roundedScore,
      weakSpotCount: weakSpots.length,
      strongSpotCount: strongSpots.length,
      assessmentPhase,
      report,
      timedOut,
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
    ? normalizePlanShape(await prepPlanRepository.findById(session.planId, user.id))
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
