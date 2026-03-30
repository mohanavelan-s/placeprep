const {
  getAIStatus,
  getOpenAIClient,
  markAIUnavailable,
  markAIWorking,
  normalizeErrorReason,
} = require('../config/openai');
const { withTransaction } = require('../config/database');
const prepPlanRepository = require('../repositories/prepPlan.repository');
const taskRepository = require('../repositories/task.repository');
const userRepository = require('../repositories/user.repository');
const progressService = require('./progress.service');
const { getTodayInTimezone } = require('../utils/date');
const AppError = require('../utils/appError');

const TOPIC_DATASET = [
  'Arrays',
  'Strings',
  'Linked Lists',
  'Stacks',
  'Queues',
  'Binary Trees',
  'Binary Search Trees',
  'Graphs',
  'Dynamic Programming',
  'Greedy Algorithms',
  'Recursion',
  'Backtracking',
  'Object-Oriented Programming',
  'System Design',
  'DBMS',
  'Operating Systems',
];

const FLASHCARD_BANK = {
  Arrays: {
    question: 'What is the first thing to test before keeping a nested-loop array solution?',
    answer: 'Check whether hashing, sorting, prefix values, or two pointers can remove repeated work.',
  },
  Strings: {
    question: 'When is a sliding window string solution valid?',
    answer: 'When the window state can be updated incrementally while expanding or shrinking.',
  },
  'Linked Lists': {
    question: 'Why is a dummy node useful in linked-list questions?',
    answer: 'It removes head edge cases and keeps pointer rewiring consistent.',
  },
  Stacks: {
    question: 'What signal usually points to a stack pattern?',
    answer: 'You need last-in-first-out behavior for matching, monotonic ordering, or undo-like processing.',
  },
  Queues: {
    question: 'When is a queue better than a stack?',
    answer: 'When work must remain first-in-first-out, especially in BFS or scheduling flows.',
  },
  'Binary Trees': {
    question: 'How do you choose quickly between DFS and BFS on trees?',
    answer: 'Use DFS for recursive structure and path logic, BFS for level-order and shortest-edge traversal.',
  },
  'Binary Search Trees': {
    question: 'What BST property must stay true after every update?',
    answer: 'All left values remain smaller and all right values remain larger than the node.',
  },
  Graphs: {
    question: 'What should you clarify first in a graph problem?',
    answer: 'Whether the graph is directed or undirected, weighted or unweighted, and what output is required.',
  },
  'Dynamic Programming': {
    question: 'What makes a DP state definition strong?',
    answer: 'It states the exact subproblem, the transition source, and the smallest valid base case.',
  },
  'Greedy Algorithms': {
    question: 'What must be true before trusting a greedy choice?',
    answer: 'You need a reason the local best move preserves global optimality.',
  },
  Recursion: {
    question: 'What are the two things every recursive function needs?',
    answer: 'A base case that stops and a smaller recursive call moving toward it.',
  },
  Backtracking: {
    question: 'What separates backtracking from plain recursion?',
    answer: 'You explore a choice, undo it cleanly, and then explore the next branch.',
  },
  'Object-Oriented Programming': {
    question: 'What should you mention first in an OOP answer?',
    answer: 'Define the concept clearly, then tie it to better structure, coupling, or reuse.',
  },
  'System Design': {
    question: 'What should anchor the first two minutes of a system design answer?',
    answer: 'Clarify scale, use cases, read-write patterns, and the core reliability requirement.',
  },
  DBMS: {
    question: 'What is the safe interview explanation of indexing?',
    answer: 'Indexing trades extra storage and write cost for faster reads by reducing scanned data.',
  },
  'Operating Systems': {
    question: 'What makes an OS answer sound strong instead of memorized?',
    answer: 'Tie the concept to behavior under scheduling, memory pressure, contention, or isolation.',
  },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || min)));
}

function cleanTopics(topics, limit = 8) {
  return Array.from(
    new Set(
      (topics || [])
        .map((topic) => String(topic || '').trim())
        .filter(Boolean)
    )
  ).slice(0, limit);
}

function safeJsonParse(content) {
  try {
    return JSON.parse(content);
  } catch (error) {
    const match = String(content || '').match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }

    throw error;
  }
}

function buildSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function buildArticleUrl(topic) {
  const normalized = String(topic || '').toLowerCase();
  const articles = [
    { pattern: /array|string/, url: 'https://www.geeksforgeeks.org/top-50-array-coding-problems-for-interviews/' },
    { pattern: /linked list/, url: 'https://www.geeksforgeeks.org/data-structures/linked-list/' },
    { pattern: /stack/, url: 'https://www.geeksforgeeks.org/stack-data-structure/' },
    { pattern: /queue/, url: 'https://www.geeksforgeeks.org/queue-data-structure/' },
    { pattern: /tree/, url: 'https://www.geeksforgeeks.org/binary-tree-data-structure/' },
    { pattern: /graph/, url: 'https://www.geeksforgeeks.org/graph-data-structure-and-algorithms/' },
    { pattern: /dynamic programming|dp/, url: 'https://www.geeksforgeeks.org/dynamic-programming/' },
    { pattern: /greedy/, url: 'https://www.geeksforgeeks.org/greedy-algorithms/' },
    { pattern: /recursion|backtracking/, url: 'https://www.geeksforgeeks.org/recursion/' },
    { pattern: /object-oriented|oop/, url: 'https://www.geeksforgeeks.org/object-oriented-programming-oops-concept-in-java/' },
    { pattern: /system design/, url: 'https://www.geeksforgeeks.org/system-design-tutorial/' },
    { pattern: /dbms/, url: 'https://www.geeksforgeeks.org/dbms/' },
    { pattern: /operating systems/, url: 'https://www.geeksforgeeks.org/operating-systems/' },
  ];

  return articles.find((item) => item.pattern.test(normalized))?.url
    || `https://www.geeksforgeeks.org/search/${encodeURIComponent(topic || 'interview preparation')}/`;
}

function topicToLeetCodeLink(topic) {
  const normalized = String(topic || '').toLowerCase();
  const links = [
    { pattern: /array|string/, label: 'LeetCode: Two Sum', url: 'https://leetcode.com/problems/two-sum/' },
    { pattern: /linked list/, label: 'LeetCode: Reverse Linked List', url: 'https://leetcode.com/problems/reverse-linked-list/' },
    { pattern: /stack/, label: 'LeetCode: Valid Parentheses', url: 'https://leetcode.com/problems/valid-parentheses/' },
    { pattern: /queue/, label: 'LeetCode: Implement Queue using Stacks', url: 'https://leetcode.com/problems/implement-queue-using-stacks/' },
    { pattern: /binary tree|tree|bst/, label: 'LeetCode: Binary Tree Level Order Traversal', url: 'https://leetcode.com/problems/binary-tree-level-order-traversal/' },
    { pattern: /graph/, label: 'LeetCode: Number of Islands', url: 'https://leetcode.com/problems/number-of-islands/' },
    { pattern: /dynamic programming|dp/, label: 'LeetCode: House Robber', url: 'https://leetcode.com/problems/house-robber/' },
    { pattern: /greedy/, label: 'LeetCode: Best Time to Buy and Sell Stock', url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/' },
    { pattern: /recursion|backtracking/, label: 'LeetCode: Subsets', url: 'https://leetcode.com/problems/subsets/' },
  ];

  const match = links.find((item) => item.pattern.test(normalized));
  if (match) {
    return match;
  }

  return {
    label: `LeetCode search: ${topic || 'practice'}`,
    url: `https://leetcode.com/problemset/?search=${encodeURIComponent(topic || 'interview')}`,
  };
}

function getRoleBiasTopics(targetRole) {
  const role = String(targetRole || '').toLowerCase();
  if (/backend/.test(role)) {
    return ['DBMS', 'Operating Systems', 'System Design', 'Object-Oriented Programming'];
  }
  if (/frontend/.test(role)) {
    return ['Strings', 'Arrays', 'Object-Oriented Programming'];
  }
  if (/full.?stack/.test(role)) {
    return ['DBMS', 'System Design', 'Object-Oriented Programming'];
  }

  return [];
}

function prioritizeTopics(knownTopics, targetTopics, targetRole) {
  const knownSet = new Set(cleanTopics(knownTopics).map((topic) => topic.toLowerCase()));
  const roleBias = getRoleBiasTopics(targetRole);
  const prioritized = cleanTopics([...targetTopics, ...roleBias], 8)
    .filter((topic) => !knownSet.has(topic.toLowerCase()));

  if (!prioritized.length) {
    return cleanTopics(roleBias.length ? roleBias : ['Arrays', 'Strings', 'Binary Trees', 'Graphs', 'Dynamic Programming'], 5);
  }

  return prioritized;
}

function buildRoadmap(prioritizedTopics, timePerDay, targetRole) {
  const topics = prioritizedTopics.length ? prioritizedTopics : ['Arrays', 'Strings', 'Binary Trees', 'Graphs', 'Dynamic Programming'];
  const groupedTopics = [];
  for (let index = 0; index < topics.length; index += 2) {
    groupedTopics.push(topics.slice(index, index + 2));
  }

  return groupedTopics.slice(0, 4).map((topicGroup, index) => ({
    week: index + 1,
    title: index === 0
      ? 'Foundation and pattern setup'
      : index === groupedTopics.length - 1
        ? 'Interview-pressure finishing pass'
        : 'Focused build week',
    focusTopics: topicGroup,
    estimatedHours: Math.round((timePerDay * 6) / 60),
    goals: [
      `Lock the core patterns for ${topicGroup.join(' and ')}.`,
      `Finish one revision loop and one timed practice block for ${topicGroup[0]}.`,
      targetRole ? `Tie the learning back to ${targetRole} interview expectations.` : 'Tie the learning back to interview delivery.',
    ],
  }));
}

function buildDailyTasks(prioritizedTopics, knownTopics, timePerDay, targetRole) {
  const dsaTopics = prioritizedTopics.filter((topic) => !/dbms|operating systems|system design|object-oriented/i.test(topic));
  const revisionTopics = prioritizedTopics.filter((topic) => /dbms|operating systems|system design|object-oriented/i.test(topic));
  const projectFocus = getRoleBiasTopics(targetRole)[0] || targetRole || 'Placement project';
  const days = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'];
  const totalMinutes = clamp(timePerDay || 120, 90, 240);
  const chunks = [
    Math.round(totalMinutes * 0.25),
    Math.round(totalMinutes * 0.28),
    Math.round(totalMinutes * 0.2),
    Math.round(totalMinutes * 0.27),
  ];

  return days.map((day, index) => {
    const primaryTopic = dsaTopics[index % Math.max(dsaTopics.length, 1)] || 'Arrays';
    const secondaryTopic = dsaTopics[(index + 1) % Math.max(dsaTopics.length, 1)] || 'Binary Trees';
    const revisionTopic = revisionTopics[index % Math.max(revisionTopics.length, 1)]
      || prioritizedTopics[index % Math.max(prioritizedTopics.length, 1)]
      || 'Operating Systems';
    const primaryLink = topicToLeetCodeLink(primaryTopic);
    const secondaryLink = topicToLeetCodeLink(secondaryTopic);

    return {
      day,
      theme: `${primaryTopic} into ${revisionTopic}`,
      totalEstimatedMinutes: chunks.reduce((sum, minutes) => sum + minutes, 0),
      items: [
        {
          title: `${primaryTopic} pattern warm-up`,
          type: 'DSA',
          estimatedMinutes: chunks[0],
          difficulty: 'Easy',
          referenceLabel: primaryLink.label,
          referenceUrl: primaryLink.url,
        },
        {
          title: `${secondaryTopic} medium checkpoint`,
          type: 'DSA',
          estimatedMinutes: chunks[1],
          difficulty: 'Medium',
          referenceLabel: secondaryLink.label,
          referenceUrl: secondaryLink.url,
        },
        {
          title: `Revision: ${revisionTopic}`,
          type: 'Revision',
          estimatedMinutes: chunks[2],
          difficulty: 'Medium',
          referenceLabel: revisionTopic,
          referenceUrl: buildArticleUrl(revisionTopic),
        },
        {
          title: `Project task: apply ${projectFocus}`,
          type: 'Project',
          estimatedMinutes: chunks[3],
          difficulty: knownTopics.length >= 3 ? 'Medium' : 'Easy',
          referenceLabel: `${projectFocus} checklist`,
          referenceUrl: buildSearchUrl(`${projectFocus} project task`),
        },
      ],
    };
  });
}

function buildResources(prioritizedTopics, targetRole) {
  const topics = cleanTopics([...prioritizedTopics, ...getRoleBiasTopics(targetRole)], 5);

  return topics.map((topic) => ({
    topic,
    items: [
      {
        title: `YouTube: ${topic} interview prep`,
        type: 'youtube',
        url: buildSearchUrl(`${topic} interview preparation`),
      },
      {
        title: `GeeksforGeeks: ${topic}`,
        type: 'article',
        url: buildArticleUrl(topic),
      },
      {
        title: `YouTube: ${topic} intuition`,
        type: 'youtube',
        url: buildSearchUrl(`${topic} intuition`),
      },
    ],
  }));
}

function buildFlashcards(prioritizedTopics, knownTopics) {
  const topics = cleanTopics([...prioritizedTopics, ...knownTopics], 8);
  return topics.slice(0, 8).map((topic) => ({
    topic,
    question: FLASHCARD_BANK[topic]?.question || `What is the interview-safe mental model for ${topic}?`,
    answer: FLASHCARD_BANK[topic]?.answer || `Define ${topic} clearly, name the core pattern, and connect it to one practical interview use-case.`,
  }));
}

function buildFallbackPlan({ knownTopics, targetTopics, timePerDay, targetRole, planId = null, version = 1 }) {
  const prioritizedTopics = prioritizeTopics(knownTopics, targetTopics, targetRole);
  const roadmap = buildRoadmap(prioritizedTopics, timePerDay, targetRole);
  const tasks = buildDailyTasks(prioritizedTopics, knownTopics, timePerDay, targetRole);
  const resources = buildResources(prioritizedTopics, targetRole);
  const flashcards = buildFlashcards(prioritizedTopics, knownTopics);

  return {
    id: planId,
    knownTopics,
    targetTopics,
    timePerDay,
    targetRole,
    coachLine: `You already know ${knownTopics[0] || 'the basics'}. Now build disciplined pressure on ${prioritizedTopics[0] || 'core placement topics'}.`,
    roadmap,
    tasks,
    resources,
    flashcards,
    version,
    usedFallback: true,
  };
}

function normalizePlanResult(rawPlan, fallbackPlan) {
  const roadmap = Array.isArray(rawPlan.roadmap) && rawPlan.roadmap.length
    ? rawPlan.roadmap.slice(0, 4).map((week, index) => ({
      week: Number(week.week || index + 1),
      title: String(week.title || fallbackPlan.roadmap[index]?.title || `Week ${index + 1}`).trim(),
      focusTopics: cleanTopics(week.focusTopics || week.topics || fallbackPlan.roadmap[index]?.focusTopics || [], 3),
      estimatedHours: clamp(week.estimatedHours || fallbackPlan.roadmap[index]?.estimatedHours || 12, 4, 30),
      goals: cleanTopics(week.goals || fallbackPlan.roadmap[index]?.goals || [], 4),
    }))
    : fallbackPlan.roadmap;

  const tasks = Array.isArray(rawPlan.tasks) && rawPlan.tasks.length
    ? rawPlan.tasks.slice(0, 5).map((dayPlan, index) => ({
      day: String(dayPlan.day || `Day ${index + 1}`),
      theme: String(dayPlan.theme || fallbackPlan.tasks[index]?.theme || 'Focused prep'),
      totalEstimatedMinutes: clamp(
        dayPlan.totalEstimatedMinutes
          || dayPlan.items?.reduce((sum, item) => sum + Number(item.estimatedMinutes || 0), 0)
          || fallbackPlan.tasks[index]?.totalEstimatedMinutes
          || 120,
        60,
        300
      ),
      items: Array.isArray(dayPlan.items) && dayPlan.items.length
        ? dayPlan.items.slice(0, 4).map((item, itemIndex) => ({
          title: String(item.title || fallbackPlan.tasks[index]?.items[itemIndex]?.title || 'Focused task').trim(),
          type: String(item.type || fallbackPlan.tasks[index]?.items[itemIndex]?.type || 'DSA').trim(),
          estimatedMinutes: clamp(item.estimatedMinutes || fallbackPlan.tasks[index]?.items[itemIndex]?.estimatedMinutes || 30, 10, 120),
          difficulty: String(item.difficulty || fallbackPlan.tasks[index]?.items[itemIndex]?.difficulty || 'Medium').trim(),
          referenceLabel: String(item.referenceLabel || fallbackPlan.tasks[index]?.items[itemIndex]?.referenceLabel || 'Reference').trim(),
          referenceUrl: item.referenceUrl || fallbackPlan.tasks[index]?.items[itemIndex]?.referenceUrl || null,
        }))
        : fallbackPlan.tasks[index]?.items || [],
    }))
    : fallbackPlan.tasks;

  const resources = Array.isArray(rawPlan.resources) && rawPlan.resources.length
    ? rawPlan.resources.slice(0, 6).map((resource, index) => ({
      topic: String(resource.topic || fallbackPlan.resources[index]?.topic || 'Interview prep').trim(),
      items: Array.isArray(resource.items) && resource.items.length
        ? resource.items.slice(0, 4).map((item) => ({
          title: String(item.title || 'Reference').trim(),
          type: String(item.type || 'article').trim(),
          url: String(item.url || item.link || '').trim(),
        })).filter((item) => item.url)
        : fallbackPlan.resources[index]?.items || [],
    }))
    : fallbackPlan.resources;

  const flashcards = Array.isArray(rawPlan.flashcards) && rawPlan.flashcards.length
    ? rawPlan.flashcards.slice(0, 10).map((card, index) => ({
      topic: String(card.topic || fallbackPlan.flashcards[index]?.topic || 'Prep').trim(),
      question: String(card.question || fallbackPlan.flashcards[index]?.question || 'Question').trim(),
      answer: String(card.answer || fallbackPlan.flashcards[index]?.answer || 'Answer').trim(),
    }))
    : fallbackPlan.flashcards;

  return {
    coachLine: String(rawPlan.coachLine || rawPlan.motivationLine || fallbackPlan.coachLine).trim(),
    roadmap,
    tasks,
    resources,
    flashcards,
  };
}

async function requestPlanJson(systemPrompt, userPrompt, fallbackFactory) {
  const currentStatus = getAIStatus();
  if (currentStatus.fallbackMode && ['quota_exceeded', 'no_key'].includes(currentStatus.reason)) {
    return {
      data: fallbackFactory(),
      usedFallback: true,
    };
  }

  const client = getOpenAIClient();
  if (!client) {
    return {
      data: fallbackFactory(),
      usedFallback: true,
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: currentStatus.model,
      temperature: 0.45,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    markAIWorking();

    return {
      data: safeJsonParse(response.choices[0]?.message?.content || '{}'),
      usedFallback: false,
    };
  } catch (error) {
    const reason = normalizeErrorReason(error);
    if (reason) {
      markAIUnavailable(reason, error);
    }

    return {
      data: fallbackFactory(error),
      usedFallback: true,
    };
  }
}

function hydrateStoredPlan(plan) {
  if (!plan) {
    return null;
  }

  return {
    ...plan,
    coachLine: typeof plan.metadata?.coachLine === 'string' ? plan.metadata.coachLine : null,
    usedFallback: Boolean(plan.metadata?.usedFallback),
  };
}

function planTasksForSync(plan, planId) {
  const firstDay = plan.tasks[0];
  if (!firstDay?.items?.length) {
    return [];
  }

  return firstDay.items.slice(0, 4).map((item, index) => ({
    title: item.title,
    description: `${firstDay.day}: ${firstDay.theme}`,
    category: item.type === 'Project' ? 'Project' : item.type === 'Revision' ? 'Core' : 'DSA',
    subcategory: firstDay.theme,
    status: 'pending',
    priority: index <= 1 ? 'high' : 'medium',
    intensity: item.type === 'Project' ? 'high' : 'medium',
    referenceLabel: item.referenceLabel || null,
    referenceUrl: item.referenceUrl || null,
    estimatedMinutes: clamp(item.estimatedMinutes, 10, 180),
    actualMinutes: 0,
    difficulty: /easy/i.test(item.difficulty) ? 2 : /hard/i.test(item.difficulty) ? 4 : 3,
    weakArea: firstDay.theme,
    aiGenerated: true,
    metadata: {
      source: 'prep-architect',
      planId,
      day: firstDay.day,
      theme: firstDay.theme,
    },
  }));
}

async function syncTodayTasks(user, plan) {
  const scheduledFor = getTodayInTimezone(user.timezone);
  await taskRepository.deleteAiGeneratedByDate(user.id, scheduledFor);
  const tasksToCreate = planTasksForSync(plan, plan.id);

  await Promise.all(
    tasksToCreate.map((task) =>
      taskRepository.createTask({
        userId: user.id,
        ...task,
        scheduledFor,
      })
    )
  );
}

async function persistPlan(user, plan, sourcePlanId = null) {
  const persistedPlan = await withTransaction(async (client) => {
    const version = await prepPlanRepository.getNextVersion(user.id, client);
    await prepPlanRepository.deactivateActivePlans(user.id, client);
    return prepPlanRepository.createPlan({
      userId: user.id,
      knownTopics: plan.knownTopics,
      targetTopics: plan.targetTopics,
      roadmap: plan.roadmap,
      tasks: plan.tasks,
      resources: plan.resources,
      flashcards: plan.flashcards,
      timePerDay: plan.timePerDay,
      targetRole: plan.targetRole,
      version,
      sourcePlanId,
      metadata: {
        coachLine: plan.coachLine,
        usedFallback: plan.usedFallback,
      },
    }, client);
  });

  await userRepository.updateUser(user.id, {
    strongTopics: cleanTopics(plan.knownTopics, 8),
    weakAreas: cleanTopics(plan.targetTopics, 8),
    targetRole: plan.targetRole || user.targetRole || null,
    coachMetadata: {
      ...(user.coachMetadata || {}),
      prepArchitectUpdatedAt: new Date().toISOString(),
      prepArchitectPlanId: persistedPlan.id,
      prepArchitectCoachLine: plan.coachLine,
    },
  });

  const finalPlan = {
    ...persistedPlan,
    coachLine: plan.coachLine,
    roadmap: plan.roadmap,
    tasks: plan.tasks,
    resources: plan.resources,
    flashcards: plan.flashcards,
    knownTopics: plan.knownTopics,
    targetTopics: plan.targetTopics,
    timePerDay: plan.timePerDay,
    targetRole: plan.targetRole,
    usedFallback: plan.usedFallback,
  };

  await syncTodayTasks(user, finalPlan);
  await progressService.refreshProgressStats(user.id, user.timezone);

  return finalPlan;
}

function buildPlanRequestPayload(user, payload = {}, currentPlan = null) {
  const knownTopics = cleanTopics(payload.knownTopics || currentPlan?.knownTopics || user.strongTopics, 8);
  const targetTopics = cleanTopics(payload.targetTopics || currentPlan?.targetTopics || user.weakAreas, 8);
  const timePerDay = clamp(payload.timePerDay || currentPlan?.timePerDay || 120, 60, 300);
  const targetRole = String(payload.targetRole || currentPlan?.targetRole || user.targetRole || 'Placement Engineer').trim();

  if (!knownTopics.length && !targetTopics.length) {
    throw new AppError('Add at least one known topic or one target topic to build a plan.', 400);
  }

  return {
    knownTopics,
    targetTopics,
    timePerDay,
    targetRole,
  };
}

async function generatePlan(user, payload = {}) {
  const input = buildPlanRequestPayload(user, payload);
  const fallbackPlan = buildFallbackPlan(input);

  const { data, usedFallback } = await requestPlanJson(
    'Act as a placement preparation coach. Return only JSON with roadmap, tasks, resources, flashcards, and coachLine.',
    [
      'Act as a placement preparation coach.',
      '',
      `User knows: ${input.knownTopics.join(', ') || 'Starting fresh'}`,
      `User wants to learn: ${input.targetTopics.join(', ') || 'Need role-guided focus'}`,
      `Time per day: ${input.timePerDay} minutes`,
      `Target role: ${input.targetRole}`,
      '',
      'Generate:',
      '1. Weekly roadmap',
      '2. Daily tasks:',
      '   * 2 DSA problems (with links)',
      '   * 1 revision topic',
      '   * 1 project task',
      '3. Resources:',
      '   * YouTube search links',
      '   * Articles',
      '4. Flashcards:',
      '   * 5-10 Q&A cards',
      '',
      'Rules:',
      '* Focus on weak areas',
      '* Keep it realistic',
      '* No fluff',
      '',
      'Return JSON in this exact shape:',
      '{',
      '  "coachLine": "string",',
      '  "roadmap": [{ "week": 1, "title": "string", "focusTopics": ["string"], "estimatedHours": 12, "goals": ["string"] }],',
      '  "tasks": [{ "day": "Day 1", "theme": "string", "totalEstimatedMinutes": 120, "items": [{ "title": "string", "type": "DSA", "estimatedMinutes": 30, "difficulty": "Easy", "referenceLabel": "string", "referenceUrl": "https://..." }] }],',
      '  "resources": [{ "topic": "string", "items": [{ "title": "string", "type": "youtube", "url": "https://..." }] }],',
      '  "flashcards": [{ "topic": "string", "question": "string", "answer": "string" }]',
      '}',
    ].join('\n'),
    () => fallbackPlan
  );

  const normalizedPlan = normalizePlanResult(data, fallbackPlan);

  return persistPlan(user, {
    ...input,
    ...normalizedPlan,
    usedFallback,
  });
}

async function updatePlan(user, payload = {}) {
  const currentPlan = await prepPlanRepository.findById(payload.planId, user.id);

  if (!currentPlan) {
    throw new AppError('Prep plan not found.', 404);
  }

  const input = buildPlanRequestPayload(user, payload, currentPlan);
  const fallbackPlan = buildFallbackPlan({
    ...input,
    planId: currentPlan.id,
    version: Number(currentPlan.version || 1) + 1,
  });

  const { data, usedFallback } = await requestPlanJson(
    'Act as a placement preparation coach. Return only JSON with roadmap, tasks, resources, flashcards, and coachLine.',
    [
      'Act as a placement preparation coach.',
      '',
      `Current plan id: ${currentPlan.id}`,
      `User knows: ${input.knownTopics.join(', ') || 'Starting fresh'}`,
      `User wants to learn: ${input.targetTopics.join(', ') || 'Need role-guided focus'}`,
      `Time per day: ${input.timePerDay} minutes`,
      `Target role: ${input.targetRole}`,
      '',
      'Regenerate the roadmap, tasks, resources, and flashcards while keeping the plan realistic and editable.',
      'Return the same JSON structure as the original plan generation request.',
    ].join('\n'),
    () => fallbackPlan
  );

  const normalizedPlan = normalizePlanResult(data, fallbackPlan);

  return persistPlan(user, {
    ...input,
    ...normalizedPlan,
    usedFallback,
  }, currentPlan.id);
}

async function getLatestPlan(user) {
  const plan = await prepPlanRepository.findLatestActiveByUser(user.id);
  return hydrateStoredPlan(plan);
}

async function getPlanHistory(user, limit = 10) {
  const plans = await prepPlanRepository.listByUser(user.id, limit);
  return plans.map(hydrateStoredPlan);
}

module.exports = {
  TOPIC_DATASET,
  generatePlan,
  updatePlan,
  getLatestPlan,
  getPlanHistory,
};
