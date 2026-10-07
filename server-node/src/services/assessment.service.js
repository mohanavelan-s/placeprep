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
  'A hash table always keeps keys in sorted order.',
  'Recursion automatically makes every solution run in optimal time.',
  'A database index removes the need for query filters.',
  'Caching permanently removes the need for a source database.',
  'Transactions only apply to read-only SELECT queries.',
  'BFS gives correct weighted shortest paths without checking edge weights.',
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

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Assessment hint generation timed out.')), timeoutMs);
    }),
  ]);
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
  const normalizedAnswerStats = normalizeRecord(normalizedSubmission.answerStats);

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
      difficulty: String(question?.difficulty || 'medium').trim(),
      averageTimeMinutes: Number(question?.averageTimeMinutes || 0),
      referenceLabel: question?.referenceLabel ? String(question.referenceLabel).trim() : null,
      referenceUrl: question?.referenceUrl ? String(question.referenceUrl).trim() : null,
      choices: toArray(question?.choices).map((choice, index) => ({
        id: String(choice?.id || `${question?.id || 'choice'}-${index + 1}`).trim(),
        label: String(choice?.label || String.fromCharCode(65 + index)).trim(),
        text: String(choice?.text || '').trim(),
      })).filter((choice) => choice.text),
      items: toArray(question?.items).map((item, index) => ({
        id: String(item?.id || `${question?.id || 'item'}-${index + 1}`).trim(),
        text: String(item?.text || '').trim(),
      })).filter((item) => item.text),
      placeholder: question?.placeholder ? String(question.placeholder).trim() : null,
      taskTitle: question?.taskTitle ? String(question.taskTitle).trim() : null,
      approachHint: question?.approachHint ? String(question.approachHint).trim() : null,
    })).filter((question) => question.id && question.prompt),
    submission: {
      ...normalizedSubmission,
      answers: Object.fromEntries(
        Object.entries(normalizedAnswers).map(([key, value]) => [key, String(value || '')])
      ),
      answerStats: normalizedAnswerStats,
      questionResults: toArray(normalizedSubmission.questionResults).map((result) => ({
        questionId: String(result?.questionId || '').trim(),
        topic: String(result?.topic || '').trim(),
        score: Number(result?.score || 0),
        correct: Boolean(result?.correct),
        feedback: String(result?.feedback || '').trim(),
        rubric: normalizeRecord(result?.rubric),
        analysis: normalizeRecord(result?.analysis),
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

function normalizeChoiceFingerprint(value) {
  return normalizeText(value).replace(/\s+/g, ' ').trim();
}

function buildKnowledgeAnswer(source, flashcard) {
  const topic = String(source.topic || source.referenceLabel || source.taskTitle || flashcard?.topic || 'this topic').trim();
  const label = source.referenceLabel || source.taskTitle || topic;
  const normalizedTopic = normalizeText(`${topic} ${label} ${source.taskType || ''}`);

  if (normalizedTopic.includes('two sum')) {
    return 'Two Sum is solved efficiently by storing seen values in a hash map and checking each number for its needed complement in O(n) time.';
  }
  if (normalizedTopic.includes('binary search')) {
    return 'Binary search works on a sorted search space by comparing the middle value and discarding half of the remaining range each step.';
  }
  if (normalizedTopic.includes('sliding window')) {
    return 'Sliding window maintains a moving range over an array or string so repeated work is avoided while constraints are checked incrementally.';
  }
  if (normalizedTopic.includes('array') || normalizedTopic.includes('string')) {
    return 'Array and string problems often depend on indexing, hash maps, two pointers, or sliding windows to reduce brute-force comparisons.';
  }
  if (normalizedTopic.includes('tree')) {
    return 'Tree traversal visits nodes systematically with DFS using recursion or a stack, or BFS using a queue for level-order processing.';
  }
  if (normalizedTopic.includes('graph')) {
    return 'Graph traversal uses BFS or DFS with a visited set; the standard traversal cost is O(V + E) for vertices and edges.';
  }
  if (normalizedTopic.includes('dynamic') || normalizedTopic === 'dp') {
    return 'Dynamic programming defines state, transition, and base cases, then uses memoization or tabulation to avoid recomputing overlapping subproblems.';
  }
  if (normalizedTopic.includes('sql') || normalizedTopic.includes('dbms') || normalizedTopic.includes('database')) {
    return 'Database queries should use correct filtering, joins, grouping, and indexes while balancing read speed against write and storage overhead.';
  }
  if (normalizedTopic.includes('normalization')) {
    return 'Normalization reduces redundancy and update anomalies by decomposing data into related tables with clear keys and relationships.';
  }
  if (normalizedTopic.includes('transaction') || normalizedTopic.includes('acid')) {
    return 'ACID transactions preserve correctness by guaranteeing atomicity, consistency, isolation, and durability around database changes.';
  }
  if (normalizedTopic.includes('operating') || normalizedTopic === 'os' || normalizedTopic.includes('paging')) {
    return 'Operating systems manage processes, memory, files, and devices; paging maps virtual pages to physical frames for isolation and flexible memory use.';
  }
  if (normalizedTopic.includes('scheduling') || normalizedTopic.includes('process')) {
    return 'CPU scheduling chooses which ready process or thread runs next according to a policy such as priority, round-robin, or shortest job first.';
  }
  if (normalizedTopic.includes('system') || normalizedTopic.includes('cache') || normalizedTopic.includes('scalability')) {
    return 'System design answers should connect requirements to capacity, data model, caching, queues, consistency, bottlenecks, and failure handling.';
  }
  if (normalizedTopic.includes('api') || normalizedTopic.includes('backend') || normalizedTopic.includes('auth')) {
    return 'A backend API should validate input, authenticate the caller, enforce business rules, persist data safely, and return a clear status response.';
  }
  if (flashcard?.answer && !/your|you|react|respond|approach/i.test(String(flashcard.answer))) {
    return String(flashcard.answer).trim();
  }

  return `A correct answer should define ${topic}, name its main use case, and explain one practical tradeoff or edge case.`;
}

function getTopicDistractors(source, correctText) {
  const topic = String(source.topic || source.referenceLabel || source.taskTitle || 'this topic').trim();
  const normalizedTopic = normalizeText(topic);
  const distractors = [
    'A hash table stores all elements in sorted order by default.',
    'Recursion is always faster than iteration for interview problems.',
    'Time complexity only matters after the code is fully written.',
    'Edge cases are handled automatically by the programming language.',
  ];

  if (normalizedTopic.includes('dbms') || normalizedTopic.includes('sql') || normalizedTopic.includes('database')) {
    distractors.push('A primary key encrypts every row in the table automatically.');
    distractors.push('Indexes always improve both read speed and write speed with no storage cost.');
  }
  if (normalizedTopic.includes('operating') || normalizedTopic === 'os') {
    distractors.push('A process scheduler is responsible for choosing disk block locations.');
    distractors.push('Virtual memory requires every process to share the same physical addresses.');
  }
  if (normalizedTopic.includes('system')) {
    distractors.push('Caching removes every consistency and invalidation problem.');
    distractors.push('A load balancer stores the permanent source of truth for user data.');
  }
  if (normalizedTopic.includes('dynamic') || normalizedTopic === 'dp') {
    distractors.push('Dynamic programming means sorting the input before every recursive call.');
    distractors.push('A DP transition is optional when memoization is used.');
  }
  if (normalizedTopic.includes('graph')) {
    distractors.push('DFS always returns the shortest weighted path in any graph.');
    distractors.push('Visited sets are unnecessary because graphs cannot contain cycles.');
  }
  if (normalizedTopic.includes('array') || normalizedTopic.includes('string')) {
    distractors.push('Two pointers require the input to be randomly shuffled first.');
    distractors.push('Sliding window recomputes every subarray from scratch.');
  }

  const correctFingerprint = normalizeChoiceFingerprint(correctText);
  return distractors.filter((text) => normalizeChoiceFingerprint(text) !== correctFingerprint);
}

function buildMcqOptions(questionId, correctText, distractors = []) {
  const seen = new Set();
  const optionTexts = [correctText, ...distractors]
    .map((text) => String(text || '').trim())
    .filter((text) => {
      const fingerprint = normalizeChoiceFingerprint(text);
      if (!fingerprint || seen.has(fingerprint)) {
        return false;
      }
      seen.add(fingerprint);
      return true;
    });

  const fallbackDistractors = GENERIC_DISTRACTORS.filter((text) => !seen.has(normalizeChoiceFingerprint(text)));
  optionTexts.push(...fallbackDistractors);

  const selectedTexts = optionTexts.slice(0, 4);
  while (selectedTexts.length < 4) {
    selectedTexts.push(`Incorrect statement ${selectedTexts.length + 1}: ${GENERIC_DISTRACTORS[selectedTexts.length % GENERIC_DISTRACTORS.length]}`);
  }

  const options = shuffle(selectedTexts).map((text, optionIndex) => ({
    id: `${questionId}-option-${optionIndex + 1}`,
    label: String.fromCharCode(65 + optionIndex),
    text,
  }));
  const correctOption = options.find((option) => normalizeChoiceFingerprint(option.text) === normalizeChoiceFingerprint(correctText)) || options[0];

  return { options, correctOption };
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
    difficulty: question.difficulty || 'medium',
    averageTimeMinutes: question.averageTimeMinutes,
    referenceLabel: question.referenceLabel || null,
    referenceUrl: question.referenceUrl || null,
    choices: Array.isArray(question.choices) ? question.choices : undefined,
    items: Array.isArray(question.items) ? question.items : undefined,
    placeholder: question.placeholder || null,
    taskTitle: question.taskTitle || null,
  };
}

function sanitizeSession(session, includeQuestions = false) {
  if (!session) {
    return null;
  }

  const normalizedSession = normalizeSessionShape(session);

  return {
    ...normalizedSession,
    assessmentScope: normalizedSession.assessmentScope || normalizedSession.metadata?.scope || 'daily',
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
    };
  }

  const resourceGroup = findResourceForTopic(plan, topic);
  const resourceItem = resourceGroup?.items?.find((item) => item?.url) || null;
  return {
    referenceLabel: resourceItem?.title || null,
    referenceUrl: resourceItem?.url || null,
    taskTitle: relatedTask?.title || null,
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

function buildAssessmentSources(plan, taskPool = [], assessmentType, durationMinutes, assessmentScope = 'daily') {
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

  const orderedSources = assessmentScope === 'weekly'
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
  return buildKnowledgeAnswer(source, flashcard);
}

function buildAssessmentMcqPrompt(source, difficulty = 'medium') {
  const topic = source.referenceLabel || source.taskTitle || source.topic || 'this topic';
  if (difficulty === 'hard_plus') {
    return `In ${topic}, which choice best predicts the failure mode or tradeoff an interviewer would probe?`;
  }

  if (difficulty === 'hard') {
    return `For ${topic}, which statement best explains the tradeoff behind the correct approach?`;
  }

  if (difficulty === 'easy') {
    return `Which core recall statement is correct for ${topic}?`;
  }

  if (source.kind === 'task') {
    return `Which statement correctly explains the core concept behind ${topic}?`;
  }

  return `Which statement is correct about ${topic}?`;
}

function resolveAdaptiveDifficulty(sessions = []) {
  const latestCompleted = sessions.find((session) => session.status === 'completed');
  if (!latestCompleted) {
    return 'medium';
  }

  const submission = normalizeRecord(latestCompleted.submission);
  const results = toArray(submission.questionResults);
  const score = Number(latestCompleted.score || 0);
  const lastThreeCorrect = results.slice(-3).length >= 3
    && results.slice(-3).every((result) => Boolean(result?.correct));

  if (lastThreeCorrect && score >= 80) {
    return 'hard_plus';
  }

  if (score >= 70) {
    return 'hard';
  }

  if (score < 45) {
    return 'easy';
  }

  return 'medium';
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

function buildMcqQuestions(plan, sources, durationMinutes, difficulty = 'medium') {
  const fallbackSources = sources.length ? sources : buildAssessmentSources(plan, [], 'mcq', durationMinutes, 'daily');
  const answersBySource = fallbackSources.map((source) => ({
    source,
    flashcard: findFlashcardForSource(plan, source),
  }));

  return answersBySource.map(({ source, flashcard }, index) => {
    const questionId = `mcq-${index + 1}-${slugify(source.referenceLabel || source.topic || `topic-${index + 1}`)}`;
    const correctText = buildContextualAnswer(source, flashcard);
    const distractors = uniqueStrings([
      ...getTopicDistractors(source, correctText),
      ...answersBySource
        .map((entry) => buildContextualAnswer(entry.source, entry.flashcard))
        .filter((entry) => entry && normalizeChoiceFingerprint(entry) !== normalizeChoiceFingerprint(correctText)),
    ], 10);
    const { options, correctOption } = buildMcqOptions(questionId, correctText, distractors);

    return {
      id: questionId,
      type: 'mcq',
      difficulty,
      topic: source.topic,
      prompt: buildAssessmentMcqPrompt(source, difficulty),
      averageTimeMinutes: clamp(Math.floor(durationMinutes / Math.max(fallbackSources.length, 1)), 3, 8),
      referenceLabel: source.referenceLabel || null,
      referenceUrl: source.referenceUrl || null,
      taskTitle: source.taskTitle || null,
      choices: options,
      correctOptionId: correctOption.id,
      expectedAnswer: correctText,
      explanation: correctText,
    };
  });
}

function buildFillBlankQuestions(plan, sources, durationMinutes, assessmentScope = 'daily') {
  const fallbackSources = sources.length ? sources : buildAssessmentSources(plan, [], 'fill_blank', durationMinutes, assessmentScope);

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
      difficulty: 'medium',
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
    };
  });
}

function buildCodingQuestions(plan, sources, durationMinutes, assessmentScope = 'daily') {
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

    return {
      id: `code-${index + 1}-${slugify(referenceLabel)}`,
      type: 'coding',
      difficulty: 'hard',
      topic: source.topic || referenceLabel,
      prompt: `Write a short programming solution or pseudocode for ${referenceLabel}. Keep it interview-length, mention the main approach, the key data structure, and the expected time complexity.`,
      averageTimeMinutes: clamp(Math.floor(durationMinutes / Math.max(baseSources.length, 1)), 15, 45),
      referenceLabel,
      referenceUrl: source.referenceUrl || null,
      taskTitle: source.taskTitle || referenceLabel,
      placeholder: 'Use a compact solution sketch. Code or structured pseudocode both work here.',
      expectedKeywords,
      explanation: `A strong answer should clearly state the approach for ${referenceLabel}, name one relevant data structure, and include time complexity.`,
    };
  });
}

function buildOrderingSteps(source) {
  const topic = String(source.topic || source.referenceLabel || source.taskTitle || 'the problem').trim();
  const normalizedTopic = normalizeText(topic);

  if (normalizedTopic.includes('graph') || normalizedTopic.includes('bfs')) {
    return [
      `Model ${topic} as nodes, edges, and a start state.`,
      'Initialize a queue and mark the start state as visited.',
      'Process the current frontier while adding unseen neighbors.',
      'Return the discovered distance, traversal order, or failure state.',
    ];
  }

  if (normalizedTopic.includes('dynamic') || normalizedTopic === 'dp') {
    return [
      `Define the state needed for ${topic}.`,
      'Write the transition using smaller already-solved states.',
      'Set the base cases before filling or memoizing the table.',
      'Return the target state and verify it on a tiny example.',
    ];
  }

  if (normalizedTopic.includes('sql') || normalizedTopic.includes('database')) {
    return [
      'Identify the required rows and relationships first.',
      'Apply joins and filters before grouping or aggregating.',
      'Select only the fields needed by the result.',
      'Check indexes or constraints that affect performance and correctness.',
    ];
  }

  if (normalizedTopic.includes('system') || normalizedTopic.includes('design')) {
    return [
      'Clarify requirements, scale, and the highest-risk operation.',
      'Choose the data model and main request path.',
      'Add cache, queue, or partitioning only where the bottleneck demands it.',
      'Name the failure mode and how the design recovers.',
    ];
  }

  return [
    `Restate what ${topic} asks for and the input constraints.`,
    'Choose the pattern or data structure that removes repeated work.',
    'Dry-run one small edge case before coding.',
    'State the time and space complexity after the solution is stable.',
  ];
}

function buildOrderingQuestions(plan, sources, durationMinutes, assessmentScope = 'daily') {
  const fallbackSources = sources.length ? sources : buildAssessmentSources(plan, [], 'ordering', durationMinutes, assessmentScope);

  return fallbackSources.map((source, index) => {
    const questionId = `order-${index + 1}-${slugify(source.referenceLabel || source.topic || `topic-${index + 1}`)}`;
    const steps = buildOrderingSteps(source).map((text, itemIndex) => ({
      id: `${questionId}-step-${itemIndex + 1}`,
      text,
    }));

    return {
      id: questionId,
      type: 'ordering',
      difficulty: 'hard',
      topic: source.topic,
      prompt: `Arrange the steps for ${source.referenceLabel || source.taskTitle || source.topic || 'this topic'} in the order you would explain them during an interview.`,
      averageTimeMinutes: clamp(Math.floor(durationMinutes / Math.max(fallbackSources.length, 1)), 4, 10),
      referenceLabel: source.referenceLabel || null,
      referenceUrl: source.referenceUrl || null,
      taskTitle: source.taskTitle || null,
      items: shuffle(steps),
      expectedOrderIds: steps.map((item) => item.id),
      explanation: steps.map((item, itemIndex) => `${itemIndex + 1}. ${item.text}`).join('\n'),
    };
  });
}

function validateQuestions(questions = [], assessmentType = 'mcq') {
  return questions
    .map((question, index) => ({
      ...question,
      id: question.id || `${assessmentType}-${index + 1}`,
      difficulty: question.difficulty || 'medium',
      topic: question.topic || question.referenceLabel || question.taskTitle || 'Placement prep',
      prompt: question.prompt || `Answer this ${assessmentType.replace('_', ' ')} question.`,
    }))
    .filter((question) => {
      if (question.type === 'mcq') {
        const choices = toArray(question.choices);
        const uniqueChoices = new Set(choices.map((choice) => normalizeChoiceFingerprint(choice.text)));
        return choices.length >= 4 && uniqueChoices.size >= 4 && choices.some((choice) => choice.id === question.correctOptionId);
      }

      if (question.type === 'ordering') {
        const itemIds = toArray(question.items).map((item) => item.id);
        const expectedOrderIds = toArray(question.expectedOrderIds).map(String);
        return itemIds.length >= 3 && expectedOrderIds.length === itemIds.length;
      }

      return Boolean(question.expectedAnswer || toArray(question.expectedKeywords).length || question.explanation);
    });
}

function buildQuestions(plan, taskPool, assessmentType, durationMinutes, assessmentScope = 'daily', difficulty = 'medium') {
  const sources = buildAssessmentSources(plan, taskPool, assessmentType, durationMinutes, assessmentScope);
  let questions;

  if (assessmentType === 'coding') {
    questions = buildCodingQuestions(plan, sources, durationMinutes, assessmentScope);
  } else if (assessmentType === 'fill_blank') {
    questions = buildFillBlankQuestions(plan, sources, durationMinutes, assessmentScope);
  } else if (assessmentType === 'ordering') {
    questions = buildOrderingQuestions(plan, sources, durationMinutes, assessmentScope);
  } else {
    questions = buildMcqQuestions(plan, sources, durationMinutes, difficulty);
  }

  return validateQuestions(questions, assessmentType);
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

  if (question.type === 'ordering') {
    let submittedOrder = [];
    try {
      const parsed = JSON.parse(String(response || '[]'));
      submittedOrder = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      submittedOrder = String(response || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    const expectedOrder = toArray(question.expectedOrderIds).map(String);
    const correctPositions = expectedOrder.filter((itemId, index) => submittedOrder[index] === itemId).length;
    const score = expectedOrder.length ? correctPositions / expectedOrder.length : 0;
    const correct = score >= 0.75;

    return {
      questionId: question.id,
      topic: question.topic,
      score: clamp(Number(score.toFixed(2)), 0, 1),
      correct,
      feedback: correct
        ? 'Good ordering. The explanation would sound structured under pressure.'
        : `Rebuild the sequence for ${question.topic}: constraints first, pattern second, execution third, tradeoff last.`,
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

  const assessmentType = ['mcq', 'fill_blank', 'coding', 'ordering'].includes(payload.assessmentType)
    ? payload.assessmentType
    : 'mcq';
  const assessmentScope = payload.assessmentScope === 'weekly' ? 'weekly' : 'daily';
  const durationMinutes = clamp(Number(payload.durationMinutes || 20), 10, 90);
  const today = getTodayInTimezone(user.timezone);
  const [todaysTasks, recentSessions] = await Promise.all([
    taskRepository.listByUser(user.id, { date: today }),
    assessmentRepository.listByUser(user.id, 5),
  ]);
  const adaptiveDifficulty = resolveAdaptiveDifficulty(recentSessions);
  const questions = buildQuestions(activePlan, todaysTasks, assessmentType, durationMinutes, assessmentScope, adaptiveDifficulty);

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
      adaptiveDifficulty,
      sourceTaskCount: todaysTasks.length,
      sourceKnownTopicCount: (activePlan.knownTopics || []).length,
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
  const answerStats = payload.answerStats && typeof payload.answerStats === 'object' && !Array.isArray(payload.answerStats)
    ? payload.answerStats
    : {};
  const plan = session.planId
    ? normalizePlanShape(await prepPlanRepository.findById(session.planId, user.id))
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
      answerStats,
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
