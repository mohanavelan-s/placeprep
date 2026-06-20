const {
  getAIStatus,
} = require('../config/openai');
const aiGateway = require('./aiGateway.service');
const taskRepository = require('../repositories/task.repository');
const userProfileRepository = require('../repositories/userProfile.repository');
const progressService = require('./progress.service');
const logService = require('./log.service');
const { getTodayInTimezone } = require('../utils/date');

const AI_REQUEST_TIMEOUT_MS = 12000;

const RESUME_ACTION_VERBS = [
  'built',
  'designed',
  'delivered',
  'improved',
  'optimized',
  'launched',
  'reduced',
  'increased',
  'automated',
  'implemented',
  'analyzed',
  'deployed',
  'streamlined',
  'scaled',
];

const RESUME_KEYWORD_STOP_WORDS = new Set([
  'about',
  'able',
  'across',
  'after',
  'also',
  'been',
  'both',
  'could',
  'each',
  'from',
  'have',
  'into',
  'more',
  'need',
  'role',
  'team',
  'using',
  'with',
  'work',
  'years',
]);

const RESUME_ROLE_BENCHMARKS = {
  backend_engineer: {
    label: 'Backend Engineer',
    keywords: ['node.js', 'express', 'rest api', 'postgresql', 'sql', 'redis', 'docker', 'testing', 'microservices', 'system design'],
    highlights: [
      'Backend resumes score better when they show API ownership, database work, and measurable reliability or latency wins.',
      'Projects and experience should mention schema design, auth, caching, queues, or deployment where relevant.',
      'Testing and observability signals help ATS and recruiters read the resume as production-ready instead of classroom-only.',
    ],
  },
  frontend_engineer: {
    label: 'Frontend Engineer',
    keywords: ['react', 'typescript', 'javascript', 'html', 'css', 'responsive', 'accessibility', 'performance', 'state management', 'testing'],
    highlights: [
      'Frontend resumes score better when they show shipped interfaces, responsiveness, accessibility, and user-facing outcomes.',
      'Projects should mention component systems, state management, API integration, and measurable performance or UX gains.',
      'Strong frontend ATS signals usually include React plus one or two quality indicators such as testing, Lighthouse, or accessibility work.',
    ],
  },
  full_stack_engineer: {
    label: 'Full Stack Engineer',
    keywords: ['react', 'node.js', 'sql', 'api', 'database', 'authentication', 'deployment', 'testing', 'typescript', 'full stack'],
    highlights: [
      'Full-stack resumes score better when they prove end-to-end ownership across UI, API, data, and deployment.',
      'Recruiters look for complete project delivery, not a disconnected list of frontend and backend tools.',
      'Quantified outcomes and one concise architecture line help ATS and humans understand the scope quickly.',
    ],
  },
  software_engineer: {
    label: 'Software Engineer',
    keywords: ['data structures', 'algorithms', 'system design', 'java', 'python', 'c++', 'sql', 'testing', 'apis', 'projects'],
    highlights: [
      'Software engineering resumes score better when they balance strong projects, core CS signals, and implementation impact.',
      'The best ATS-friendly versions keep technical depth visible while still quantifying outcomes and ownership.',
      'Experience, projects, and skills should reinforce the same role narrative instead of reading like unrelated tools.',
    ],
  },
  data_analyst: {
    label: 'Data Analyst',
    keywords: ['sql', 'excel', 'power bi', 'tableau', 'python', 'pandas', 'dashboard', 'kpi', 'analysis', 'statistics'],
    highlights: [
      'Data analyst resumes score better when they show SQL, dashboards, metrics, and stakeholder-ready insight delivery.',
      'Strong bullets connect the analysis to a business decision, KPI movement, or reporting improvement.',
      'Portfolio work should look like analysis execution, not just tool usage without a decision or outcome.',
    ],
  },
  data_engineer: {
    label: 'Data Engineer',
    keywords: ['sql', 'etl', 'elt', 'data warehouse', 'spark', 'airflow', 'python', 'pipelines', 'data modeling', 'orchestration'],
    highlights: [
      'Data engineer resumes score better when they show pipeline ownership, warehousing, data modeling, and reliability signals.',
      'ATS-friendly versions usually mention throughput, latency, freshness, or failure-recovery improvements.',
      'Project bullets should make the source, transformation, destination, and orchestration story obvious.',
    ],
  },
  data_scientist: {
    label: 'Data Scientist',
    keywords: ['python', 'machine learning', 'statistics', 'pandas', 'numpy', 'model', 'classification', 'regression', 'experiment', 'evaluation'],
    highlights: [
      'Data scientist resumes score better when they show model work, evaluation metrics, experimentation, and practical business framing.',
      'The strongest versions connect features, model choices, and metrics to a decision or product outcome.',
      'ATS-friendly data science bullets usually mention the dataset, the method, and the measured result together.',
    ],
  },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || min)));
}

function toSafeInteger(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.round(parsed);
}

function round(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits));
}

function clampCount(value, min = 1, max = 8) {
  return clamp(value, min, max);
}

function requestJson(systemPrompt, userPrompt, fallbackFactory) {
  return aiGateway.requestJson(systemPrompt, userPrompt, fallbackFactory, {
    label: 'ai-service-json',
    timeoutMs: AI_REQUEST_TIMEOUT_MS,
  });
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
    {
      pattern: /sql|dbms|database/,
      label: 'LeetCode: Combine Two Tables',
      url: 'https://leetcode.com/problems/combine-two-tables/',
    },
    {
      pattern: /operating system|system design|cache/,
      label: 'LeetCode: LRU Cache',
      url: 'https://leetcode.com/problems/lru-cache/',
    },
  ];

  const matched = links.find((item) => item.pattern.test(normalized));
  if (matched) {
    return matched;
  }

  return {
    label: 'LeetCode: Binary Search',
    url: 'https://leetcode.com/problems/binary-search/',
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
        estimatedMinutes: toSafeInteger(
          clamp(task.estimatedMinutes || fallbackPlan.tasks[index]?.estimatedMinutes || 30, 20, 90),
          fallbackPlan.tasks[index]?.estimatedMinutes || 30,
        ),
        actualMinutes: 0,
        difficulty: toSafeInteger(
          toDifficultyNumber(task.difficulty, fallbackPlan.tasks[index]?.difficulty),
          3,
        ),
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
        estimatedMinutes: toSafeInteger(clamp(task.estimatedMinutes, 20, 90), 30),
        actualMinutes: 0,
        difficulty: toSafeInteger(toDifficultyNumber(task.difficulty), 3),
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

function normalizeResumeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function normalizeRoleBenchmarkKey(targetRole = '') {
  const normalized = String(targetRole || '').toLowerCase();

  if (/data analyst/.test(normalized)) {
    return 'data_analyst';
  }
  if (/data engineer/.test(normalized)) {
    return 'data_engineer';
  }
  if (/data scientist/.test(normalized)) {
    return 'data_scientist';
  }
  if (/front/.test(normalized)) {
    return 'frontend_engineer';
  }
  if (/full.?stack/.test(normalized)) {
    return 'full_stack_engineer';
  }
  if (/back/.test(normalized)) {
    return 'backend_engineer';
  }

  return 'software_engineer';
}

function getResumeBenchmark(targetRole = '') {
  return RESUME_ROLE_BENCHMARKS[normalizeRoleBenchmarkKey(targetRole)] || RESUME_ROLE_BENCHMARKS.software_engineer;
}

function includesNormalizedKeyword(text, keyword) {
  const normalizedText = normalizeResumeText(text);
  const normalizedKeyword = normalizeResumeText(keyword);
  return Boolean(normalizedText && normalizedKeyword && normalizedText.includes(normalizedKeyword));
}

function extractResumeKeywords(text, limit = 16) {
  return uniqueStrings(
    extractKeywords(text).filter((keyword) => (
      keyword.length >= 3
      && !RESUME_KEYWORD_STOP_WORDS.has(keyword)
      && !/^\d+$/.test(keyword)
    )),
    limit,
  );
}

function countMetricSignals(text) {
  const matches = String(text || '').match(/(\d+%|\d+\+|₹\s?\d+|\$\s?\d+|\d+\s?(ms|sec|hrs|hours|days|users|records|rows|pipelines|dashboards|apis|services|models))/gi);
  return matches ? matches.length : 0;
}

function countActionVerbSignals(text) {
  const normalized = normalizeResumeText(text);
  return RESUME_ACTION_VERBS.filter((verb) => normalized.includes(verb)).length;
}

function buildResumeHeuristicAnalysis(payload = {}) {
  const resumeText = String(payload.resumeText || '').trim();
  const normalizedResumeText = normalizeResumeText(resumeText);
  const sections = {
    summary: /summary|profile|objective/i.test(resumeText),
    education: /education/i.test(resumeText),
    experience: /experience|internship|work/i.test(resumeText),
    projects: /project/i.test(resumeText),
    skills: /skills|technologies|tools/i.test(resumeText),
    achievements: /achievement|award|certification/i.test(resumeText),
  };
  const benchmark = getResumeBenchmark(payload.targetRole);
  const benchmarkMatches = benchmark.keywords.filter((keyword) => includesNormalizedKeyword(normalizedResumeText, keyword));
  const jdKeywords = extractResumeKeywords(payload.jobDescription, 18);
  const jdMatches = jdKeywords.filter((keyword) => includesNormalizedKeyword(normalizedResumeText, keyword));
  const missingKeywords = jdKeywords.filter((keyword) => !includesNormalizedKeyword(normalizedResumeText, keyword));
  const coveredSections = Object.values(sections).filter(Boolean).length;
  const metricSignals = countMetricSignals(resumeText);
  const actionVerbSignals = countActionVerbSignals(resumeText);
  const sectionScore = (coveredSections / 6) * 28;
  const benchmarkScore = (benchmarkMatches.length / Math.max(benchmark.keywords.length, 1)) * 27;
  const jdScore = jdKeywords.length
    ? (jdMatches.length / Math.max(jdKeywords.length, 1)) * 25
    : benchmarkScore * 0.55;
  const impactScore = Math.min(12, metricSignals * 2.5);
  const writingScore = Math.min(8, actionVerbSignals * 1.2);
  const atsScore = clamp(Math.round(sectionScore + benchmarkScore + jdScore + impactScore + writingScore), 0, 100);
  const jobMatchScore = clamp(Math.round(
    jdKeywords.length
      ? ((jdMatches.length / Math.max(jdKeywords.length, 1)) * 100)
      : ((benchmarkMatches.length / Math.max(benchmark.keywords.length, 1)) * 100)
  ), 0, 100);

  const roleLabel = benchmark.label;
  const missingRoleKeywords = benchmark.keywords
    .filter((keyword) => !benchmarkMatches.includes(keyword))
    .slice(0, 4);

  const strengths = uniqueStrings([
    sections.projects ? `Projects section gives ${roleLabel} reviewers evidence of hands-on execution.` : '',
    sections.experience ? `Experience section creates a clear ${roleLabel} chronology for ATS and recruiters.` : '',
    sections.skills ? `Skills section is visible, so ${roleLabel} keyword scanning has a clean anchor.` : '',
    benchmarkMatches.length >= 4 ? `${roleLabel} fit is visible through matched signals: ${benchmarkMatches.slice(0, 5).join(', ')}.` : '',
    metricSignals >= 2 ? `Quantified impact is already present, which makes ${roleLabel} bullets more credible.` : '',
  ], 6);

  const improvements = uniqueStrings([
    !sections.summary ? `Add a 2-3 line summary that names the ${roleLabel} lane, strongest stack, and target outcome.` : '',
    !sections.projects ? `Add ${roleLabel}-relevant projects with problem, stack, ownership, and measurable outcome.` : '',
    !sections.skills ? `Add a clean ${roleLabel} skills section grouped by languages, tools, platforms, and databases where relevant.` : '',
    metricSignals < 2 ? `Quantify ${roleLabel} bullets with percentages, counts, latency, throughput, users, rows, dashboards, or business outcomes.` : '',
    missingKeywords.slice(0, 2).length ? `Mirror missing job keywords naturally in relevant bullets: ${missingKeywords.slice(0, 2).join(', ')}.` : '',
    missingRoleKeywords.length ? `Strengthen ${roleLabel} role fit by adding honest evidence for: ${missingRoleKeywords.join(', ')}.` : '',
  ], 6);

  const summary = resumeText
    ? `${roleLabel} ATS review complete. The resume was scored against ${roleLabel} signals, with emphasis on ${benchmark.highlights[0].replace(/\.$/, '').toLowerCase()}. The current version ${metricSignals >= 2 ? 'already has some quantified impact' : 'still needs stronger quantified impact'}.`
    : 'Resume uploaded, but automatic text extraction found limited readable content. Upload a text-based PDF/DOCX/TXT or paste text for deeper ATS analysis.';

  return {
    summary,
    score: atsScore,
    jobMatchScore,
    strengths,
    improvements,
    keywords: uniqueStrings([...jdMatches, ...benchmarkMatches], 20),
    sections,
    matchedKeywords: uniqueStrings([...jdMatches, ...benchmarkMatches], 12),
    missingKeywords: uniqueStrings(missingKeywords, 12),
    benchmarkHighlights: benchmark.highlights,
  };
}

async function analyzeResumeText(payload) {
  const resumeText = (payload.resumeText || '').trim();
  const heuristic = buildResumeHeuristicAnalysis(payload);

  const { data, usedFallback } = await requestJson(
    'You analyze resumes for placement preparation. Return JSON with keys: summary, score, strengths, improvements, keywords, sections. Keep feedback crisp, human, and role-specific.',
    JSON.stringify({
      ...payload,
      benchmark: getResumeBenchmark(payload.targetRole),
      heuristic,
    }),
    () => heuristic
  );

  const normalizedScore = clamp(toSafeInteger(data.score, heuristic.score), 0, 100);

  return {
    summary: data.summary || heuristic.summary,
    score: normalizedScore,
    strengths: uniqueStrings([
      ...(Array.isArray(data.strengths) ? data.strengths : []),
      ...heuristic.strengths,
    ], 6),
    improvements: uniqueStrings([
      ...(Array.isArray(data.improvements) ? data.improvements : []),
      ...heuristic.improvements,
    ], 6),
    keywords: uniqueStrings([
      ...(Array.isArray(data.keywords) ? data.keywords : []),
      ...heuristic.keywords,
    ], 20),
    sections: data.sections && typeof data.sections === 'object' ? data.sections : heuristic.sections,
    jobMatchScore: heuristic.jobMatchScore,
    missingKeywords: heuristic.missingKeywords,
    benchmarkHighlights: heuristic.benchmarkHighlights,
    usedFallback,
  };
}

async function scoreResumeAgainstJobDescription(payload) {
  const jobDescription = String(payload.jobDescription || '').trim();
  if (!jobDescription) {
    return {
      targetRole: payload.targetRole || null,
      atsScore: 0,
      jobMatchScore: 0,
      matchedKeywords: [],
      missingKeywords: [],
      benchmarkHighlights: [],
      tailoredSuggestions: ['Paste a job description first so the resume can be scored against that exact role.'],
      summary: 'No job description was provided.',
    };
  }

  const heuristic = buildResumeHeuristicAnalysis(payload);

  return {
    targetRole: payload.targetRole || getResumeBenchmark(payload.targetRole).label,
    atsScore: heuristic.score,
    jobMatchScore: heuristic.jobMatchScore,
    matchedKeywords: heuristic.matchedKeywords,
    missingKeywords: heuristic.missingKeywords,
    benchmarkHighlights: heuristic.benchmarkHighlights,
    tailoredSuggestions: uniqueStrings([
      ...heuristic.improvements,
      heuristic.missingKeywords.length
        ? `Mirror the missing job language naturally in projects or experience: ${heuristic.missingKeywords.slice(0, 3).join(', ')}.`
        : '',
      'Keep every strong bullet outcome-focused: action, scope, stack, result.',
    ], 6),
    summary: heuristic.summary,
  };
}

module.exports = {
  generateTasks,
  getStuckHelp,
  evaluateDailyPerformance,
  generateQuickTask,
  getStatus,
  analyzeResumeText,
  scoreResumeAgainstJobDescription,
};
