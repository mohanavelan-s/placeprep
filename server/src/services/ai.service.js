const env = require('../config/env');
const {
  getAIStatus,
  getOpenAIClient,
  markAIUnavailable,
  markAIWorking,
  normalizeErrorReason,
} = require('../config/openai');
const taskRepository = require('../repositories/task.repository');
const userProfileRepository = require('../repositories/userProfile.repository');
const progressService = require('./progress.service');
const logService = require('./log.service');
const { getTodayInTimezone } = require('../utils/date');

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || min)));
}

function round(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits));
}

function clampCount(value, min = 1, max = 8) {
  return clamp(value, min, max);
}

function safeJsonParse(content) {
  try {
    return JSON.parse(content);
  } catch (error) {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }

    throw error;
  }
}

async function requestJson(systemPrompt, userPrompt, fallbackFactory) {
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
      model: env.aiModel,
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
    const failureReason = normalizeErrorReason(error);
    if (failureReason) {
      markAIUnavailable(failureReason, error);
    }
    return {
      data: fallbackFactory(error),
      usedFallback: true,
    };
  }
}

function getDaySeed() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return Number(today) || 1;
}

function rotateArray(items, offset) {
  if (!items.length) {
    return [];
  }

  const safeOffset = offset % items.length;
  return items.slice(safeOffset).concat(items.slice(0, safeOffset));
}

function inferRoleHint(user, profileLinks) {
  const explicitRole = String(user.targetRole || '').trim();
  if (explicitRole) {
    return explicitRole;
  }

  const urlSource = [
    profileLinks.linkedinUrl,
    profileLinks.githubUrl,
    profileLinks.portfolioUrl,
  ].join(' ').toLowerCase();

  if (/backend/.test(urlSource)) {
    return 'Backend Engineer';
  }
  if (/frontend/.test(urlSource)) {
    return 'Frontend Engineer';
  }
  if (/fullstack|full-stack/.test(urlSource)) {
    return 'Full Stack Engineer';
  }
  if (/data/.test(urlSource)) {
    return 'Software Engineer';
  }

  return 'Placement preparation';
}

function buildLinkProfile(profileLinks = {}) {
  return {
    linkedinUrl: profileLinks.linkedinUrl || null,
    githubUrl: profileLinks.githubUrl || null,
    leetcodeUrl: profileLinks.leetcodeUrl || null,
    portfolioUrl: profileLinks.portfolioUrl || null,
    resumeUrl: profileLinks.resumeUrl || null,
    hasGithub: Boolean(profileLinks.githubUrl),
    hasPortfolio: Boolean(profileLinks.portfolioUrl),
    hasLinkedIn: Boolean(profileLinks.linkedinUrl),
    hasLeetCode: Boolean(profileLinks.leetcodeUrl),
  };
}

function cleanList(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
}

function toDifficultyNumber(value, fallback = 3) {
  if (typeof value === 'number') {
    return clamp(value, 1, 5);
  }

  const label = String(value || '').toLowerCase();
  if (label.includes('easy')) {
    return 2;
  }
  if (label.includes('hard')) {
    return 4;
  }
  if (label.includes('medium')) {
    return 3;
  }

  return clamp(fallback, 1, 5);
}

function toDifficultyLabel(value) {
  const difficulty = toDifficultyNumber(value);
  if (difficulty <= 2) {
    return 'Easy';
  }
  if (difficulty >= 4) {
    return 'Hard';
  }
  return 'Medium';
}

function normalizeCategory(value, fallback = 'DSA') {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (/project/.test(normalized)) {
    return 'Project';
  }
  if (/core|dbms|os|oop|network|system/.test(normalized)) {
    return 'Core';
  }
  return 'DSA';
}

function topicToLeetCodeLink(topic) {
  const normalized = String(topic || '').toLowerCase();
  const links = [
    {
      pattern: /array|two pointer|prefix|hash/,
      label: 'LeetCode: Two Sum',
      url: 'https://leetcode.com/problems/two-sum/',
    },
    {
      pattern: /binary search/,
      label: 'LeetCode: Binary Search',
      url: 'https://leetcode.com/problems/binary-search/',
    },
    {
      pattern: /tree|binary tree|bfs|dfs/,
      label: 'LeetCode: Binary Tree Level Order Traversal',
      url: 'https://leetcode.com/problems/binary-tree-level-order-traversal/',
    },
    {
      pattern: /graph/,
      label: 'LeetCode: Number of Islands',
      url: 'https://leetcode.com/problems/number-of-islands/',
    },
    {
      pattern: /dynamic programming|dp/,
      label: 'LeetCode: House Robber',
      url: 'https://leetcode.com/problems/house-robber/',
    },
    {
      pattern: /linked list/,
      label: 'LeetCode: Reverse Linked List',
      url: 'https://leetcode.com/problems/reverse-linked-list/',
    },
    {
      pattern: /stack/,
      label: 'LeetCode: Valid Parentheses',
      url: 'https://leetcode.com/problems/valid-parentheses/',
    },
    {
      pattern: /queue/,
      label: 'LeetCode: Implement Queue using Stacks',
      url: 'https://leetcode.com/problems/implement-queue-using-stacks/',
    },
    {
      pattern: /greedy/,
      label: 'LeetCode: Best Time to Buy and Sell Stock',
      url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/',
    },
  ];

  const matched = links.find((item) => item.pattern.test(normalized));
  if (matched) {
    return matched;
  }

  const searchTopic = encodeURIComponent(topic || 'leetcode');
  return {
    label: `LeetCode search: ${topic || 'practice'}`,
    url: `https://leetcode.com/problemset/?search=${searchTopic}`,
  };
}

function buildFallbackDailyPlan(profile, availableMinutes, linkProfile, roleHint) {
  const weakTopics = cleanList(profile.weakTopics);
  const strongTopics = cleanList(profile.strongTopics);
  const fallbackDsaPool = rotateArray(
    ['Arrays', 'Trees', 'Dynamic Programming', 'Binary Search', 'Graphs', 'Linked Lists'],
    getDaySeed()
  );
  const prioritizedWeakDsa = weakTopics.filter((topic) => !/dbms|os|oop|network|system|project|backend|frontend/i.test(topic));
  const dsaTopics = cleanList([
    ...prioritizedWeakDsa,
    ...fallbackDsaPool,
    ...strongTopics,
  ]);
  const dsaTopicOne = dsaTopics[0] || 'Arrays';
  const dsaTopicTwo = dsaTopics.find((topic) => topic !== dsaTopicOne) || 'Trees';
  const revisionTopic = weakTopics.find((topic) => /dbms|os|oop|network|system/i.test(topic)) || 'Operating Systems';
  const projectTopic = strongTopics.find((topic) => /project|api|backend|frontend|system/i.test(topic))
    || profile.focusArea
    || roleHint
    || 'Backend APIs';

  const workload = clamp(availableMinutes || 150, 120, 180);
  const estimatedChunks = [45, 40, 30, 35];
  const scale = workload / estimatedChunks.reduce((sum, minutes) => sum + minutes, 0);
  const scaled = estimatedChunks.map((minutes) => Math.round(minutes * scale));

  const dsaOneLink = topicToLeetCodeLink(dsaTopicOne);
  const dsaTwoLink = topicToLeetCodeLink(dsaTopicTwo);

  return {
    motivationLine: `Cut excuses. Close ${profile.focusArea} before the day gets away from you.`,
    tasks: [
      {
        title: `${dsaTopicOne} pattern drill`,
        type: 'DSA',
        estimatedMinutes: scaled[0],
        difficulty: 'Easy',
        weakTopic: dsaTopicOne,
        referenceLabel: dsaOneLink.label,
        referenceUrl: dsaOneLink.url,
        description: `Solve one confidence-building ${dsaTopicOne} problem fast, then write down the pattern.`,
      },
      {
        title: `${dsaTopicTwo} medium checkpoint`,
        type: 'DSA',
        estimatedMinutes: scaled[1],
        difficulty: 'Medium',
        weakTopic: dsaTopicTwo,
        referenceLabel: dsaTwoLink.label,
        referenceUrl: dsaTwoLink.url,
        description: `Push one medium ${dsaTopicTwo} problem without rushing the dry run.`,
      },
      {
        title: `Revision: ${revisionTopic}`,
        type: 'Core',
        estimatedMinutes: scaled[2],
        difficulty: 'Medium',
        weakTopic: revisionTopic,
        referenceLabel: revisionTopic,
        referenceUrl: null,
        description: `Revise interview-ready notes for ${revisionTopic} and extract five sharp recall points.`,
      },
      {
        title: linkProfile.hasGithub || linkProfile.hasPortfolio
          ? `Project push: ${projectTopic}`
          : `Project proof: ${projectTopic}`,
        type: 'Project',
        estimatedMinutes: scaled[3],
        difficulty: 'Medium',
        weakTopic: projectTopic,
        referenceLabel: projectTopic,
        referenceUrl: null,
        description: linkProfile.hasGithub || linkProfile.hasPortfolio
          ? `Ship one visible improvement in ${projectTopic} and capture the outcome.`
          : `Build one visible ${projectTopic} improvement and publish it where your profile can show it.`,
      },
    ],
  };
}

function normalizePlanTasks(rawTasks, fallbackPlan, profile, availableMinutes) {
  const normalized = Array.isArray(rawTasks)
    ? rawTasks.slice(0, 4).map((task, index) => {
      const category = normalizeCategory(task.type || task.category, fallbackPlan.tasks[index]?.type);
      const weakTopic = String(task.weakTopic || task.topic || fallbackPlan.tasks[index]?.weakTopic || profile.focusArea).trim();
      const link = task.referenceUrl
        ? {
          label: task.referenceLabel || task.referenceUrl,
          url: task.referenceUrl,
        }
        : (category === 'DSA' ? topicToLeetCodeLink(weakTopic) : {
          label: task.referenceLabel || weakTopic,
          url: null,
        });

      return {
        title: String(task.title || fallbackPlan.tasks[index]?.title || `${weakTopic} focus block`).trim(),
        description: String(task.description || fallbackPlan.tasks[index]?.description || `Focused work on ${weakTopic}.`).trim(),
        category,
        subcategory: weakTopic,
        priority: index <= 1 ? 'high' : 'medium',
        intensity: category === 'Project' || Number(task.estimatedMinutes) >= 45 ? 'high' : 'medium',
        estimatedMinutes: clamp(task.estimatedMinutes || fallbackPlan.tasks[index]?.estimatedMinutes || 30, 20, 90),
        actualMinutes: 0,
        difficulty: toDifficultyNumber(task.difficulty, fallbackPlan.tasks[index]?.difficulty),
        weakArea: weakTopic,
        aiGenerated: true,
        referenceLabel: link.label || null,
        referenceUrl: link.url || null,
        metadata: {
          coachReason: task.reason || task.description || fallbackPlan.tasks[index]?.description || null,
          generatedFor: weakTopic,
          generatedAt: new Date().toISOString(),
        },
      };
    })
    : [];

  const totalEstimatedMinutes = normalized.reduce(
    (total, task) => total + Number(task.estimatedMinutes || 0),
    0
  );

  if (normalized.length !== 4 || totalEstimatedMinutes < 110 || totalEstimatedMinutes > 195) {
    return {
      tasks: fallbackPlan.tasks.map((task, index) => ({
        title: task.title,
        description: task.description,
        category: normalizeCategory(task.type),
        subcategory: task.weakTopic,
        priority: index <= 1 ? 'high' : 'medium',
        intensity: index === 3 ? 'high' : 'medium',
        estimatedMinutes: clamp(task.estimatedMinutes, 20, 90),
        actualMinutes: 0,
        difficulty: toDifficultyNumber(task.difficulty),
        weakArea: task.weakTopic,
        aiGenerated: true,
        referenceLabel: task.referenceLabel || null,
        referenceUrl: task.referenceUrl || null,
        metadata: {
          coachReason: task.description,
          generatedFor: task.weakTopic,
          generatedAt: new Date().toISOString(),
        },
      })),
      motivationLine: fallbackPlan.motivationLine,
      totalEstimatedMinutes: availableMinutes,
      usedFallback: true,
    };
  }

  return {
    tasks: normalized,
    motivationLine: null,
    totalEstimatedMinutes,
    usedFallback: false,
  };
}

function buildHelpFallback(problemName, focusArea) {
  return {
    hint: `Do not code yet. Write the invariant for ${problemName} and test it on the smallest valid input first.`,
    approachSteps: [
      'Restate the input, output, and constraints in one sentence.',
      'Write the brute-force path so you know what must improve.',
      'Choose the data structure that makes the repeated operation cheap.',
      'Dry run two edge cases before you touch syntax.',
    ],
    similarProblems: [
      `${focusArea} warm-up`,
      `${problemName} variant`,
      `${problemName} follow-up`,
    ],
    youtubeSearchKeywords: [
      `${problemName} intuition`,
      `${problemName} dry run`,
      `${focusArea} interview pattern`,
    ],
  };
}

function buildEvaluationFallback({ totalTasks, tasksCompleted, timeSpentMinutes, struggles, weakAreas }) {
  const executionScore = totalTasks ? (tasksCompleted / totalTasks) * 100 : 0;
  const timeScore = Math.min(100, (timeSpentMinutes / 180) * 100);
  const strugglePenalty = struggles ? 8 : 0;
  const productivityScore = Math.max(
    0,
    Math.round((executionScore * 0.65) + (timeScore * 0.35) - strugglePenalty)
  );

  return {
    productivityScore,
    weakAreas: weakAreas.length ? weakAreas : ['Execution discipline'],
    tomorrowImprovements: [
      executionScore < 70 ? 'Finish the planned work before adding new tasks.' : 'Keep the first task hard and the second task clean.',
      timeSpentMinutes < 120 ? 'Protect one uninterrupted 90-minute block tomorrow.' : 'Use the first 10 minutes to define the exact finish line.',
      struggles ? 'Turn today\'s struggle into one focused revision note before bed.' : 'Capture the pattern that worked so you can repeat it quickly.',
    ],
    verdict: productivityScore >= 80
      ? 'Serious day. Keep the pressure on.'
      : productivityScore >= 60
        ? 'Useful day, but not sharp enough yet.'
        : 'Below standard. Tomorrow needs cleaner execution.',
  };
}

async function getUserLinkProfile(user) {
  const savedProfile = await userProfileRepository.findByUserId(user.id);
  const linkProfile = buildLinkProfile(savedProfile || {});

  return {
    savedProfile,
    linkProfile,
    roleHint: inferRoleHint(user, linkProfile),
  };
}

async function generateTasks(user, payload = {}) {
  const summary = await progressService.getSummary(user);
  const profile = summary.coachProfile;
  const { linkProfile, roleHint } = await getUserLinkProfile(user);
  const scheduledFor = getTodayInTimezone(user.timezone);
  const availableMinutes = clamp(payload.availableMinutes || 150, 120, 180);
  const fallbackPlan = buildFallbackDailyPlan(profile, availableMinutes, linkProfile, roleHint);
  const weakTopics = cleanList(payload.weakTopics || payload.weakAreas || profile.weakTopics);
  const strongTopics = cleanList(payload.strongTopics || profile.strongTopics);
  const persist = payload.persist !== false;
  const replaceExisting = payload.replaceExisting !== false;

  const { data, usedFallback } = await requestJson(
    'Act as a placement preparation coach. Return only JSON. Build serious, practical work, never fluff.',
    [
      'Act as a placement preparation coach.',
      '',
      'User profile:',
      `* Strong in: ${strongTopics.join(', ') || 'Not enough data'}`,
      `* Weak in: ${weakTopics.join(', ') || 'Execution discipline'}`,
      `* Avg solve time: ${profile.averageTimePerProblem || 0} mins`,
      `* Consistency: ${profile.consistencyScore}`,
      `* Streak: ${profile.streak}`,
      `* Target role: ${roleHint}`,
      `* GitHub linked: ${linkProfile.hasGithub ? 'yes' : 'no'}`,
      `* Portfolio linked: ${linkProfile.hasPortfolio ? 'yes' : 'no'}`,
      `* LeetCode linked: ${linkProfile.hasLeetCode ? 'yes' : 'no'}`,
      '',
      'Generate TODAY\'S TASKS:',
      '* 2 DSA problems (with LeetCode links)',
      '* 1 revision topic',
      '* 1 project-related task',
      '',
      'Rules:',
      '* Focus on weak areas',
      '* Mix difficulty (easy + medium)',
      `* Total workload: 2-3 hours (target ${availableMinutes} mins)`,
      '* Include estimated time per task',
      '',
      'Also include:',
      '* A short, serious motivation line',
      '',
      'Return JSON with keys:',
      '* motivationLine: string',
      '* tasks: array of 4 items',
      '',
      'Each task item must contain:',
      '* title',
      '* type',
      '* estimatedMinutes',
      '* difficulty',
      '* weakTopic',
      '* referenceLabel',
      '* referenceUrl',
      '* description',
    ].join('\n'),
    () => fallbackPlan
  );

  const normalizedPlan = normalizePlanTasks(data.tasks, fallbackPlan, profile, availableMinutes);
  const motivationLine = String(
    data.motivationLine
    || normalizedPlan.motivationLine
    || fallbackPlan.motivationLine
  ).trim();

  let tasks = normalizedPlan.tasks;
  let replacedCount = 0;

  if (persist) {
    if (replaceExisting) {
      replacedCount = await taskRepository.deleteAiGeneratedByDate(user.id, scheduledFor);
    }

    tasks = await Promise.all(
      normalizedPlan.tasks.map((task) =>
        taskRepository.createTask({
          userId: user.id,
          ...task,
          scheduledFor,
          metadata: {
            ...task.metadata,
            motivationLine,
            source: 'ai-coach',
          },
        })
      )
    );

    await progressService.refreshProgressStats(user.id, user.timezone);
  }

  return {
    motivationLine,
    tasks,
    profile,
    profileLinks: linkProfile,
    totalEstimatedMinutes: tasks.reduce((total, task) => total + Number(task.estimatedMinutes || 0), 0),
    persisted: persist,
    replacedCount,
    usedFallback: usedFallback || normalizedPlan.usedFallback,
  };
}

async function getStuckHelp(user, payload = {}) {
  const summary = await progressService.getSummary(user);
  const profile = summary.coachProfile;
  const { linkProfile, roleHint } = await getUserLinkProfile(user);
  const problemName = String(payload.problemName || payload.problem || payload.topic || 'current problem').trim();
  const fallback = buildHelpFallback(problemName, profile.focusArea);

  const { data, usedFallback } = await requestJson(
    'You are a strict placement-prep coach. Never provide the full solution. Return only JSON.',
    [
      `User is stuck on: ${problemName}`,
      '',
      'Provide:',
      '* Hint (not full solution)',
      '* Step-by-step approach idea',
      '* Similar problems to practice',
      '* YouTube search keywords (not links)',
      '',
      'Keep response concise and helpful.',
      '',
      `User weak areas: ${profile.weakTopics.join(', ') || 'Execution discipline'}`,
      `Target role: ${roleHint}`,
      `LeetCode linked: ${linkProfile.hasLeetCode ? 'yes' : 'no'}`,
      `Attempt notes: ${payload.attempt || payload.notes || 'No notes provided.'}`,
    ].join('\n'),
    () => fallback
  );

  return {
    hint: String(data.hint || fallback.hint).trim(),
    approachSteps: Array.isArray(data.approachSteps || data.approach)
      ? (data.approachSteps || data.approach).slice(0, 4).map((item) => String(item).trim()).filter(Boolean)
      : fallback.approachSteps,
    similarProblems: Array.isArray(data.similarProblems)
      ? data.similarProblems.slice(0, 4).map((item) => String(item).trim()).filter(Boolean)
      : fallback.similarProblems,
    youtubeSearchKeywords: Array.isArray(data.youtubeSearchKeywords)
      ? data.youtubeSearchKeywords.slice(0, 4).map((item) => String(item).trim()).filter(Boolean)
      : fallback.youtubeSearchKeywords,
    profile,
    profileLinks: linkProfile,
    usedFallback,
  };
}

async function evaluateDailyPerformance(user, payload = {}) {
  const summary = await progressService.getSummary(user);
  const profile = summary.coachProfile;
  const { linkProfile, roleHint } = await getUserLinkProfile(user);
  const today = getTodayInTimezone(user.timezone);
  const tasks = Array.isArray(payload.tasks) && payload.tasks.length
    ? payload.tasks
    : await taskRepository.listByUser(user.id, { date: today });

  const normalizedTasks = tasks.map((task) => {
    if (typeof task === 'string') {
      return { title: task, status: 'completed' };
    }

    return {
      title: task.title,
      status: task.status || 'completed',
      weakArea: task.weakArea || task.subcategory || task.category,
    };
  });

  const totalTasks = Number(payload.totalTasks || normalizedTasks.length || 0);
  const tasksCompleted = Number(
    payload.tasksCompleted
      || normalizedTasks.filter((task) => task.status === 'completed').length
      || 0
  );
  const timeSpentMinutes = clamp(
    payload.timeSpentMinutes || payload.timeSpent || (Number(payload.studyHours || 0) * 60) || 0,
    0,
    720
  );
  const struggles = String(payload.struggles || payload.notes || '').trim();
  const weakAreas = cleanList([
    ...normalizedTasks
      .filter((task) => task.status !== 'completed')
      .map((task) => task.weakArea),
    ...profile.weakTopics.slice(0, 3),
  ]).slice(0, 4);
  const fallback = buildEvaluationFallback({
    totalTasks,
    tasksCompleted,
    timeSpentMinutes,
    struggles,
    weakAreas,
  });

  const { data, usedFallback } = await requestJson(
    'You evaluate placement-prep days in a direct, serious tone. Return only JSON.',
    [
      'User completed:',
      `* Tasks: ${normalizedTasks.map((task) => `${task.title} (${task.status})`).join('; ') || 'No tasks logged.'}`,
      `* Time spent: ${timeSpentMinutes} minutes`,
      `* Struggles: ${struggles || 'None recorded'}`,
      '',
      'Evaluate:',
      '* Productivity score (0-100)',
      '* Weak areas',
      '* What to improve tomorrow',
      '',
      'Tone: direct, serious, no fluff',
      '',
      `Known weak areas: ${profile.weakTopics.join(', ') || 'Execution discipline'}`,
      `Target role: ${roleHint}`,
      `GitHub linked: ${linkProfile.hasGithub ? 'yes' : 'no'}`,
    ].join('\n'),
    () => fallback
  );

  const result = {
    productivityScore: clamp(
      data.productivityScore || data.score || fallback.productivityScore,
      0,
      100
    ),
    weakAreas: Array.isArray(data.weakAreas)
      ? data.weakAreas.slice(0, 4).map((item) => String(item).trim()).filter(Boolean)
      : fallback.weakAreas,
    tomorrowImprovements: Array.isArray(data.tomorrowImprovements || data.improvements)
      ? (data.tomorrowImprovements || data.improvements)
        .slice(0, 4)
        .map((item) => String(item).trim())
        .filter(Boolean)
      : fallback.tomorrowImprovements,
    verdict: String(data.verdict || data.summary || fallback.verdict).trim(),
    profile,
    profileLinks: linkProfile,
    usedFallback,
  };

  if (payload.persistLog !== false) {
    await logService.upsertLog(user, {
      logDate: today,
      summary: result.verdict,
      blockers: struggles || null,
      notes: struggles || null,
      hoursStudied: round(timeSpentMinutes / 60, 2),
      tasksCompletedCount: tasksCompleted,
      productivityScore: result.productivityScore,
      improvementPlan: result.tomorrowImprovements.join(' '),
    });
  }

  return result;
}

function buildFallbackQuickTask(profile, availableMinutes) {
  const weakTopic = profile.weakTopics[0] || profile.focusArea || 'Dynamic Programming';
  const isCore = /dbms|os|oop|network|system/i.test(weakTopic);
  const link = topicToLeetCodeLink(weakTopic);

  return {
    task: {
      title: isCore ? `Revision sprint: ${weakTopic}` : `${weakTopic} quick strike`,
      category: isCore ? 'Core' : 'DSA',
      estimatedMinutes: clamp(availableMinutes, 15, 45),
      difficulty: isCore ? 'Medium' : 'Easy',
      referenceLabel: isCore ? weakTopic : link.label,
      referenceUrl: isCore ? null : link.url,
      reason: `High-impact pocket focused on ${weakTopic}.`,
    },
    suggestionLine: `No drift. Use this pocket to reduce friction in ${weakTopic}.`,
  };
}

async function generateQuickTask(user, payload = {}) {
  const summary = await progressService.getSummary(user);
  const profile = summary.coachProfile;
  const { linkProfile, roleHint } = await getUserLinkProfile(user);
  const availableMinutes = clamp(payload.availableMinutes || 30, 15, 45);
  const fallback = buildFallbackQuickTask(profile, availableMinutes);

  const { data, usedFallback } = await requestJson(
    'You create short, high-impact placement-prep work. Return only JSON.',
    [
      `User has limited free time (${availableMinutes} mins).`,
      '',
      'Suggest:',
      '* 1 quick DSA problem OR',
      '* 1 revision topic',
      '',
      'Keep it efficient and impactful.',
      '',
      `Priority weak area: ${profile.focusArea}`,
      `Target role: ${roleHint}`,
      `GitHub linked: ${linkProfile.hasGithub ? 'yes' : 'no'}`,
      '',
      'Return JSON with keys:',
      '* task: { title, category, estimatedMinutes, difficulty, referenceLabel, referenceUrl, reason }',
      '* suggestionLine',
    ].join('\n'),
    () => fallback
  );

  const quickTask = data.task && typeof data.task === 'object'
    ? {
      title: String(data.task.title || fallback.task.title).trim(),
      category: normalizeCategory(data.task.category, fallback.task.category),
      estimatedMinutes: clamp(data.task.estimatedMinutes || fallback.task.estimatedMinutes, 15, 45),
      difficulty: toDifficultyLabel(data.task.difficulty || fallback.task.difficulty),
      referenceLabel: data.task.referenceLabel || fallback.task.referenceLabel,
      referenceUrl: data.task.referenceUrl || fallback.task.referenceUrl,
      reason: String(data.task.reason || fallback.task.reason).trim(),
    }
    : {
      ...fallback.task,
      difficulty: toDifficultyLabel(fallback.task.difficulty),
    };

  return {
    task: quickTask,
    suggestionLine: String(data.suggestionLine || fallback.suggestionLine).trim(),
    profile,
    profileLinks: linkProfile,
    usedFallback,
  };
}

function getStatus() {
  return getAIStatus();
}

function extractKeywords(text) {
  return Array.from(
    new Set(
      (text || '')
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/i)
        .filter((token) => token.length >= 3)
    )
  );
}

async function analyzeResumeText(payload) {
  const resumeText = (payload.resumeText || '').trim();
  const sections = {
    summary: /summary|profile|objective/i.test(resumeText),
    education: /education/i.test(resumeText),
    experience: /experience|internship|work/i.test(resumeText),
    projects: /project/i.test(resumeText),
    skills: /skills|technologies|tools/i.test(resumeText),
    achievements: /achievement|award|certification/i.test(resumeText),
  };

  const roleKeywords = extractKeywords(`${payload.targetRole || ''} ${payload.jobDescription || ''}`);
  const matchedKeywords = roleKeywords.filter((keyword) => resumeText.toLowerCase().includes(keyword)).slice(0, 15);
  const coveredSections = Object.values(sections).filter(Boolean).length;
  const lengthScore = Math.min(20, Math.round(resumeText.length / 250));
  const score = Math.min(100, Math.round((coveredSections / 6) * 60 + matchedKeywords.length * 2 + lengthScore));

  const fallback = {
    summary: resumeText
      ? 'Resume analyzed successfully with structural and keyword checks.'
      : 'Resume uploaded, but text extraction is limited. Provide resume text for deeper analysis.',
    score,
    strengths: [
      sections.projects ? 'Projects section is present.' : null,
      sections.skills ? 'Skills section is present.' : null,
      matchedKeywords.length >= 5 ? 'Resume already aligns with several target-role keywords.' : null,
    ].filter(Boolean),
    improvements: [
      !sections.summary ? 'Add a short summary or objective tailored to the role.' : null,
      !sections.projects ? 'Add a projects section with outcome-focused bullet points.' : null,
      matchedKeywords.length < 5 ? 'Mirror more target-role keywords naturally in skills and experience bullets.' : null,
    ].filter(Boolean),
    keywords: matchedKeywords,
    sections,
  };

  const { data, usedFallback } = await requestJson(
    'You analyze resumes for placement preparation. Return JSON with keys: summary, score, strengths, improvements, keywords, sections.',
    JSON.stringify(payload),
    () => fallback
  );

  return {
    summary: data.summary || fallback.summary,
    score: Number(data.score ?? fallback.score),
    strengths: Array.isArray(data.strengths) && data.strengths.length ? data.strengths.slice(0, 6) : fallback.strengths,
    improvements: Array.isArray(data.improvements) && data.improvements.length ? data.improvements.slice(0, 6) : fallback.improvements,
    keywords: Array.isArray(data.keywords) && data.keywords.length ? data.keywords.slice(0, 20) : fallback.keywords,
    sections: data.sections && typeof data.sections === 'object' ? data.sections : fallback.sections,
    usedFallback,
  };
}

module.exports = {
  generateTasks,
  getStuckHelp,
  evaluateDailyPerformance,
  generateQuickTask,
  getStatus,
  analyzeResumeText,
};
