import type { AuthResult } from "@/lib/api";

const DEMO_MODE_STORAGE_KEY = "placeprep.demo-mode";
const DEMO_ROLE_STORAGE_KEY = "placeprep.demo-role";
const DEMO_STATE_STORAGE_KEY = "placeprep.demo-state";
export const DEMO_SESSION_TOKEN = "demo-session-token";
const DEMO_DELAY_MS = 180;
type DemoRole = "admin" | "user";

const topicBank = [
  {
    pattern: /array/i,
    article: ["GeeksforGeeks: Top 50 Array Interview Problems", "https://www.geeksforgeeks.org/top-50-array-coding-problems-for-interviews/"],
    newsletter: ["TLDR: practical engineering updates", "https://tldr.tech/"],
    videos: [
      ["freeCodeCamp: Arrays and interview patterns", buildYouTubeSearchUrl("freeCodeCamp arrays interview patterns")],
      ["Bro Code: Arrays walkthrough", buildYouTubeSearchUrl("Bro Code arrays tutorial")],
    ],
    problems: [
      ["LeetCode: Two Sum", "Easy", "https://leetcode.com/problems/two-sum/"],
      ["HackerRank: Arrays - DS", "Easy", "https://www.hackerrank.com/challenges/arrays-ds/problem"],
      ["CodeChef: TSORT", "Medium", "https://www.codechef.com/problems/TSORT"],
    ],
  },
  {
    pattern: /string/i,
    article: ["GeeksforGeeks: Top 50 String Interview Questions", "https://www.geeksforgeeks.org/top-50-string-coding-problems-for-interviews/"],
    newsletter: ["Bytes.dev: concise frontend and language patterns", "https://bytes.dev/"],
    videos: [
      ["CodeWithMosh: String interview practice", buildYouTubeSearchUrl("CodeWithMosh string interview questions")],
      ["freeCodeCamp: String algorithms and pattern drills", buildYouTubeSearchUrl("freeCodeCamp string algorithms interview")],
    ],
    problems: [
      ["LeetCode: Longest Substring Without Repeating Characters", "Medium", "https://leetcode.com/problems/longest-substring-without-repeating-characters/"],
      ["HackerRank: Strings - Making Anagrams", "Easy", "https://www.hackerrank.com/challenges/ctci-making-anagrams/problem"],
      ["CodeChef: FLOW006", "Easy", "https://www.codechef.com/problems/FLOW006"],
    ],
  },
  {
    pattern: /tree|bst/i,
    article: ["GeeksforGeeks: Binary Tree Data Structure", "https://www.geeksforgeeks.org/binary-tree-data-structure/"],
    newsletter: ["ByteByteGo: structured systems intuition", "https://bytebytego.com/"],
    videos: [
      ["freeCodeCamp: Binary tree interview patterns", buildYouTubeSearchUrl("freeCodeCamp binary tree interview")],
      ["Bro Code: Binary tree basics", buildYouTubeSearchUrl("Bro Code binary tree tutorial")],
    ],
    problems: [
      ["LeetCode: Binary Tree Level Order Traversal", "Medium", "https://leetcode.com/problems/binary-tree-level-order-traversal/"],
      ["HackerRank: Tree - Height of a Binary Tree", "Easy", "https://www.hackerrank.com/challenges/tree-height-of-a-binary-tree/problem"],
      ["CodeChef: COINS", "Medium", "https://www.codechef.com/problems/COINS"],
    ],
  },
  {
    pattern: /dynamic programming|dp/i,
    article: ["GeeksforGeeks: Dynamic Programming", "https://www.geeksforgeeks.org/dynamic-programming/"],
    newsletter: ["ByteByteGo: methodical systems and pattern thinking", "https://bytebytego.com/"],
    videos: [
      ["freeCodeCamp: Dynamic programming interview prep", buildYouTubeSearchUrl("freeCodeCamp dynamic programming interview")],
      ["CodeWithMosh: Dynamic programming intuition", buildYouTubeSearchUrl("CodeWithMosh dynamic programming")],
    ],
    problems: [
      ["LeetCode: House Robber", "Medium", "https://leetcode.com/problems/house-robber/"],
      ["HackerRank: Max Array Sum", "Medium", "https://www.hackerrank.com/challenges/max-array-sum/problem"],
      ["CodeChef: COINS", "Medium", "https://www.codechef.com/problems/COINS"],
    ],
  },
  {
    pattern: /graph/i,
    article: ["GeeksforGeeks: Graph Data Structure and Algorithms", "https://www.geeksforgeeks.org/graph-data-structure-and-algorithms/"],
    newsletter: ["ByteByteGo: systems patterns and graph intuition", "https://bytebytego.com/"],
    videos: [
      ["freeCodeCamp: Graph algorithms for interviews", buildYouTubeSearchUrl("freeCodeCamp graph algorithms interview")],
      ["CodeWithMosh: Graphs and traversal intuition", buildYouTubeSearchUrl("CodeWithMosh graph algorithms")],
    ],
    problems: [
      ["LeetCode: Number of Islands", "Medium", "https://leetcode.com/problems/number-of-islands/"],
      ["HackerRank: BFS - Shortest Reach in a Graph", "Medium", "https://www.hackerrank.com/challenges/bfsshortreach/problem"],
      ["CodeChef: COINS", "Medium", "https://www.codechef.com/problems/COINS"],
    ],
  },
  {
    pattern: /system design/i,
    article: ["GeeksforGeeks: System Design Tutorial", "https://www.geeksforgeeks.org/system-design-tutorial/"],
    newsletter: ["ByteByteGo: system design breakdowns", "https://bytebytego.com/"],
    videos: [
      ["freeCodeCamp: System design interview prep", buildYouTubeSearchUrl("freeCodeCamp system design interview")],
      ["CodeWithMosh: System design basics", buildYouTubeSearchUrl("CodeWithMosh system design tutorial")],
    ],
    problems: [
      ["LeetCode: Design Twitter", "Medium", "https://leetcode.com/problems/design-twitter/"],
      ["HackerRank: Simple Text Editor", "Medium", "https://www.hackerrank.com/challenges/simple-text-editor/problem"],
      ["CodeChef: ZCO14003", "Medium", "https://www.codechef.com/problems/ZCO14003"],
    ],
  },
  {
    pattern: /dbms|database/i,
    article: ["GeeksforGeeks: DBMS", "https://www.geeksforgeeks.org/dbms/"],
    newsletter: ["DB Weekly: database internals and tooling", "https://dbweekly.com/"],
    videos: [
      ["freeCodeCamp: DBMS and SQL revision", buildYouTubeSearchUrl("freeCodeCamp DBMS SQL interview")],
      ["CodeWithMosh: SQL and relational database intuition", buildYouTubeSearchUrl("CodeWithMosh SQL database tutorial")],
    ],
    problems: [
      ["LeetCode: Combine Two Tables", "Easy", "https://leetcode.com/problems/combine-two-tables/"],
      ["HackerRank: Revising the Select Query I", "Easy", "https://www.hackerrank.com/challenges/revising-the-select-query/problem"],
      ["CodeChef: INTEST", "Easy", "https://www.codechef.com/problems/INTEST"],
    ],
  },
  {
    pattern: /operating systems|os/i,
    article: ["GeeksforGeeks: Operating Systems", "https://www.geeksforgeeks.org/operating-systems/"],
    newsletter: ["Linux Weekly News: operating systems and kernel thinking", "https://lwn.net/"],
    videos: [
      ["freeCodeCamp: Operating Systems full revision", buildYouTubeSearchUrl("freeCodeCamp operating systems interview")],
      ["Bro Code: Operating systems walkthrough", buildYouTubeSearchUrl("Bro Code operating systems tutorial")],
    ],
    problems: [
      ["LeetCode: LRU Cache", "Medium", "https://leetcode.com/problems/lru-cache/"],
      ["HackerRank: Queue using Two Stacks", "Medium", "https://www.hackerrank.com/challenges/queue-using-two-stacks/problem"],
      ["CodeChef: INTEST", "Easy", "https://www.codechef.com/problems/INTEST"],
    ],
  },
];

function buildYouTubeSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function wait(duration: number) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function createId(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

function addDaysIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function buildInviteRecord(role: "admin" | "user", label = "Demo invite", used = false) {
  const code = `${role.toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const now = new Date().toISOString();

  return {
    id: createId("invite"),
    code,
    role,
    createdBy: "demo-admin",
    expiresAt: addDaysIso(7),
    used,
    usedBy: used ? "demo-student-1" : null,
    usedAt: used ? now : null,
    metadata: { label, source: "demo-mode" },
    createdAt: now,
    updatedAt: now,
    status: used ? "used" : "valid",
    inviteLink: `${window.location.origin}/invite?code=${encodeURIComponent(code)}`,
  };
}

function cleanTopics(topics: string[] = [], limit = 8) {
  return Array.from(new Set(topics.map((topic) => String(topic || "").trim()).filter(Boolean))).slice(0, limit);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createDemoSvgDataUrl(label: string, accent = "#8b0000") {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"><rect width="640" height="480" fill="#111116"/><rect x="24" y="24" width="592" height="432" rx="24" fill="#171721" stroke="${accent}" stroke-opacity="0.45"/><text x="50%" y="46%" fill="#e6e6e6" text-anchor="middle" font-size="24" font-family="Georgia, serif">${label}</text><text x="50%" y="56%" fill="#9a9a9a" text-anchor="middle" font-size="14" font-family="Arial, sans-serif">Demo asset</text></svg>`,
  )}`;
}

function createDemoTextDataUrl(content: string) {
  return `data:text/plain;charset=UTF-8,${encodeURIComponent(content)}`;
}

function getRoleBiasTopics(targetRole: string) {
  const normalized = String(targetRole || "").toLowerCase();

  if (/data analyst/.test(normalized)) {
    return ["SQL", "Statistics", "Pandas", "Data Visualization", "Power BI"];
  }
  if (/data engineer/.test(normalized)) {
    return ["SQL", "ETL", "Data Warehousing", "Spark", "Airflow"];
  }
  if (/data scientist/.test(normalized)) {
    return ["Python", "Statistics", "Machine Learning", "Pandas"];
  }
  if (/backend/.test(normalized)) {
    return ["Operating Systems", "DBMS", "System Design"];
  }

  return ["Dynamic Programming", "Graphs"];
}

const languageProfiles = {
  english: {
    label: "English",
    translationCode: "en",
    creators: ["freeCodeCamp", "Bro Code", "CodeWithMosh"],
  },
  tamil: {
    label: "Tamil",
    translationCode: "ta",
    creators: ["Error Makes Clever", "GUVI Tamil", "Tamil Tech Programming"],
  },
  hindi: {
    label: "Hindi",
    translationCode: "hi",
    creators: ["Apna College", "CodeHelp", "CodeWithHarry"],
  },
} as const;

function normalizePrepLanguage(value: unknown) {
  const normalized = String(value || "english").trim().toLowerCase();
  return normalized in languageProfiles ? normalized as keyof typeof languageProfiles : "english";
}

function buildTranslatedExternalUrl(url: string, preferredLanguage: keyof typeof languageProfiles) {
  if (!url || preferredLanguage === "english") {
    return url;
  }

  return `https://translate.google.com/translate?sl=auto&tl=${languageProfiles[preferredLanguage].translationCode}&u=${encodeURIComponent(url)}`;
}

function getTopicRecipe(topic: string) {
  return topicBank.find((entry) => entry.pattern.test(topic)) || {
    article: ["GeeksforGeeks: Binary Search", "https://www.geeksforgeeks.org/binary-search/"],
    newsletter: ["TLDR: practical engineering updates", "https://tldr.tech/"],
    videos: [
      [`freeCodeCamp: ${topic}`, buildYouTubeSearchUrl(`freeCodeCamp ${topic}`)],
      [`Bro Code: ${topic}`, buildYouTubeSearchUrl(`Bro Code ${topic}`)],
    ],
    problems: [["LeetCode: Binary Search", "Easy", "https://leetcode.com/problems/binary-search/"]],
  };
}

function buildStudyStack(topic: string, preferredLanguage: keyof typeof languageProfiles) {
  const recipe = getTopicRecipe(topic);
  const creators = languageProfiles[preferredLanguage].creators;
  return {
    topic,
    items: [
      { title: `${creators[0]}: ${topic}`, type: "youtube", url: buildYouTubeSearchUrl(`${creators[0]} ${topic}`) },
      { title: `${creators[1]}: ${topic}`, type: "youtube", url: buildYouTubeSearchUrl(`${creators[1]} ${topic}`) },
      {
        title: preferredLanguage === "english" ? recipe.article[0] : `${recipe.article[0]} (${languageProfiles[preferredLanguage].label} translation)`,
        type: "article",
        url: buildTranslatedExternalUrl(recipe.article[1], preferredLanguage),
      },
      {
        title: preferredLanguage === "english" ? recipe.newsletter[0] : `${recipe.newsletter[0]} (${languageProfiles[preferredLanguage].label} translation)`,
        type: "newsletter",
        url: buildTranslatedExternalUrl(recipe.newsletter[1], preferredLanguage),
      },
    ],
  };
}

function buildTaskItems(topic: string, revisionTopic: string, targetRole: string, preferredLanguage: keyof typeof languageProfiles) {
  const recipe = getTopicRecipe(topic);
  const revisionRecipe = getTopicRecipe(revisionTopic);
  const [firstProblem, secondProblem = firstProblem] = recipe.problems;

  return [
    {
      title: firstProblem[0],
      type: "DSA",
      estimatedMinutes: 35,
      difficulty: firstProblem[1],
      referenceLabel: firstProblem[0],
      referenceUrl: firstProblem[2],
      summary: `Solve ${firstProblem[0]} to rehearse ${topic}. Focus on the core pattern, the data structure choice, and the time complexity you would say out loud for ${targetRole}.`,
    },
    {
      title: secondProblem[0],
      type: "DSA",
      estimatedMinutes: 45,
      difficulty: secondProblem[1],
      referenceLabel: secondProblem[0],
      referenceUrl: secondProblem[2],
      summary: `Use ${secondProblem[0]} as the deeper checkpoint for ${topic}. Finish by explaining one edge case and one tradeoff clearly.`,
    },
    {
      title: `Revision block: ${revisionTopic}`,
      type: "Revision",
      estimatedMinutes: 25,
      difficulty: "Medium",
      referenceLabel: revisionRecipe.article[0],
      referenceUrl: buildTranslatedExternalUrl(revisionRecipe.article[1], preferredLanguage),
      summary: `Review ${revisionTopic}, then explain it back in one minute and connect it to ${targetRole}.`,
    },
    {
      title: `Structured execution: apply ${topic}`,
      type: "Project",
      estimatedMinutes: 35,
      difficulty: "Medium",
      referenceLabel: `${languageProfiles[preferredLanguage].creators[0]}: ${topic}`,
      referenceUrl: buildYouTubeSearchUrl(`${languageProfiles[preferredLanguage].creators[0]} ${topic}`),
      summary: `Turn ${topic} into a small executable artifact or explanation note. Capture one concrete output you can mention in interviews.`,
    },
  ];
}

function buildPlan(
  input: { knownTopics: string[]; targetTopics: string[]; targetRole?: string; timePerDay?: number; durationMonths?: number; preferredLanguage?: string },
  version = 1,
  sourcePlanId: string | null = null,
) {
  const knownTopics = cleanTopics(input.knownTopics, 8);
  const targetTopics = cleanTopics(input.targetTopics, 8);
  const roleBias = getRoleBiasTopics(String(input.targetRole || ""));
  const orderedTopics = cleanTopics([
    ...targetTopics,
    ...roleBias,
  ], 5);
  const primary = orderedTopics[0] || "Operating Systems";
  const secondary = orderedTopics[1] || "DBMS";
  const targetRole = input.targetRole || "Backend Engineer";
  const preferredLanguage = normalizePrepLanguage(input.preferredLanguage);
  const durationMonths = clamp(Number(input.durationMonths || 1), 1, 12);
  const now = new Date().toISOString();

  const roadmapLength = clamp(durationMonths * 4, 4, 16);
  const roadmap = Array.from({ length: roadmapLength }, (_, index) => {
    const topic = orderedTopics[index % orderedTopics.length] || primary;
    return {
    week: index + 1,
    title: index === 0 ? "Foundation reset" : index === roadmapLength - 1 ? "Interview simulation week" : "Focused build week",
    focusTopics: cleanTopics([topic, orderedTopics[index + 1] || secondary], 2),
    estimatedHours: clamp(Math.round(((input.timePerDay || 180) * 6) / 60), 6, 24),
    goals: [
      `Make ${topic} interview-ready with one creator resource and one deep article.`,
      `Solve at least two concrete problems tied to ${topic}.`,
      `Translate ${topic} into spoken interview language for ${targetRole}.`,
    ],
  };
  });

  const tasks = Array.from({ length: 5 }, (_, index) => {
    const topic = orderedTopics[index % orderedTopics.length] || primary;
    const revisionTopic = orderedTopics[(index + 1) % orderedTopics.length] || secondary;
    const items = buildTaskItems(topic, revisionTopic, targetRole, preferredLanguage);
    return {
      day: `Day ${index + 1}`,
      theme: `${topic} into ${revisionTopic}`,
      totalEstimatedMinutes: items.reduce((sum, item) => sum + item.estimatedMinutes, 0),
      items,
    };
  });

  return {
    id: createId("prep"),
    userId: "demo-user",
    knownTopics,
    targetTopics,
    roadmap,
    tasks,
    resources: orderedTopics.slice(0, 4).map((topic) => buildStudyStack(topic, preferredLanguage)),
    flashcards: [
      { topic: primary, question: `What is the clean mental model for ${primary} in a ${targetRole} interview?`, answer: `Define ${primary} in one sentence, name one tradeoff, then tie it directly to the first task in the plan.` },
      { topic: secondary, question: `How do you explain ${secondary} without sounding memorized?`, answer: `Use one concrete example, one common mistake, and one performance tradeoff that would matter for ${targetRole}.` },
      { topic: orderedTopics[2] || "System Design", question: `How would ${orderedTopics[2] || "System Design"} show up in the planned work?`, answer: `Connect it to the structured execution block, then explain the practical decision you would make under interview pressure.` },
      { topic: orderedTopics[3] || "Dynamic Programming", question: `What would you say out loud before solving a problem on ${orderedTopics[3] || "Dynamic Programming"}?`, answer: "State the pattern, the data structure or state you need, and the edge case that could break a rushed solution." },
    ],
    timePerDay: input.timePerDay || 180,
    durationMonths,
    targetRole,
    preferredLanguage,
    version,
    isActive: true,
    sourcePlanId,
    metadata: {
      title: `${targetRole}: ${primary} + ${secondary}`,
      autoTitle: `${targetRole}: ${primary} + ${secondary}`,
      titleSource: "generated",
      coachLine: `Push ${primary} until it becomes automatic, then let ${secondary} carry the next layer of confidence.`,
      usedFallback: true,
      durationMonths,
      preferredLanguage,
    },
    title: `${targetRole}: ${primary} + ${secondary}`,
    autoTitle: `${targetRole}: ${primary} + ${secondary}`,
    titleSource: "generated",
    createdAt: now,
    updatedAt: now,
    coachLine: `Push ${primary} until it becomes automatic, then let ${secondary} carry the next layer of confidence.`,
    usedFallback: true,
  };
}

function buildTasksFromPlan(plan: ReturnType<typeof buildPlan>) {
  const scheduledFor = new Date().toISOString().slice(0, 10);
  return plan.tasks[0].items.map((item, index) => ({
    id: createId("task"),
    userId: "demo-user",
    title: item.title,
    description: item.summary || `${plan.tasks[0].day}: ${plan.tasks[0].theme}`,
    category: item.type === "Revision" ? "Core" : item.type === "Project" ? "Project" : "DSA",
    subcategory: plan.tasks[0].theme,
    status: index === 0 ? "completed" : index === 1 ? "in_progress" : "pending",
    priority: index < 2 ? "high" : "medium",
    intensity: item.type === "Project" ? "high" : "medium",
    referenceLabel: item.referenceLabel,
    referenceUrl: item.referenceUrl,
    dueDate: null,
    dueAt: null,
    scheduledFor,
    estimatedMinutes: item.estimatedMinutes,
    actualMinutes: index === 0 ? item.estimatedMinutes : 0,
    difficulty: /easy/i.test(item.difficulty) ? 2 : /hard/i.test(item.difficulty) ? 4 : 3,
    weakArea: plan.tasks[0].theme,
    aiGenerated: true,
    metadata: { source: "demo-mode", planId: plan.id, itemIndex: index, summary: item.summary || null },
    completedAt: index === 0 ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

function buildCoachProfile(tasks: Array<Record<string, unknown>>, plan: Record<string, unknown> | null) {
  const completed = tasks.filter((task) => task.status === "completed").length;
  return {
    solvedProblems: 148,
    weakTopics: (plan?.targetTopics as string[] | undefined)?.slice(0, 3) || ["Operating Systems", "DBMS", "System Design"],
    strongTopics: (plan?.knownTopics as string[] | undefined)?.slice(0, 3) || ["Arrays", "Strings", "Binary Trees"],
    averageTimePerProblem: 32,
    consistencyScore: 78,
    streak: 12,
    readinessScore: clamp(62 + completed * 4, 0, 100),
    failedAttempts: 19,
    mistakeCount: 23,
    focusArea: (plan?.targetTopics as string[] | undefined)?.[0] || "Operating Systems",
    trackedDays: 14,
    commandLine: String(plan?.coachLine || "Hold the line. Clear one meaningful weakness every day."),
    lastRefreshedAt: new Date().toISOString(),
  };
}

function buildProgressSummary(tasks: Array<Record<string, unknown>>, plan: Record<string, unknown> | null) {
  const completed = tasks.filter((task) => task.status === "completed").length;
  const executionRate = Math.round((completed / Math.max(tasks.length, 1)) * 100);
  const coachProfile = buildCoachProfile(tasks, plan);

  return {
    focusScore: 74,
    disciplineIndex: 81,
    executionRate,
    totalHoursLogged: 26.5,
    missionsCompleted: completed,
    streak: 12,
    bonusStreak: 3,
    consistencyScore: 78,
    readinessScore: coachProfile.readinessScore,
    weeklyProgress: [
      { date: "2026-04-09", day: "T", missions: 2, hours: 1.5 },
      { date: "2026-04-10", day: "F", missions: 3, hours: 2.2 },
      { date: "2026-04-11", day: "S", missions: 2, hours: 1.2 },
      { date: "2026-04-12", day: "S", missions: 4, hours: 2.8 },
      { date: "2026-04-13", day: "M", missions: 3, hours: 2.1 },
      { date: "2026-04-14", day: "T", missions: 2, hours: 1.6 },
      { date: "2026-04-15", day: "W", missions: completed, hours: Number((completed * 0.75).toFixed(1)) },
    ],
    topicStrength: [
      { topic: String(plan?.targetTopics?.[0] || "Operating Systems"), strength: 72 },
      { topic: String(plan?.targetTopics?.[1] || "DBMS"), strength: 65 },
      { topic: String(plan?.targetTopics?.[2] || "System Design"), strength: 54 },
      { topic: "Dynamic Programming", strength: 48 },
    ],
    coachProfile,
    stat: {
      id: "demo-stat",
      statDate: new Date().toISOString().slice(0, 10),
    },
  };
}

function buildProgressHistory(summary: ReturnType<typeof buildProgressSummary>) {
  return summary.weeklyProgress.map((entry, index) => ({
    id: `history-${index + 1}`,
    userId: "demo-user",
    statDate: entry.date,
    streak: 6 + index,
    bonusStreak: index > 4 ? 1 : 0,
    consistencyScore: 68 + index,
    readinessScore: 58 + index * 3,
    executionRate: clamp(entry.missions * 22, 30, 95),
    totalHours: entry.hours,
    tasksCompleted: entry.missions,
    powerPocketMinutes: index % 2 === 0 ? 25 : 0,
    metadata: { source: "demo-mode" },
    createdAt: new Date(`${entry.date}T20:00:00`).toISOString(),
    updatedAt: new Date(`${entry.date}T20:00:00`).toISOString(),
  }));
}

function getActivePlanFromState(state: Record<string, unknown>) {
  return ((state.prepPlans as Array<Record<string, unknown>>) || []).find((plan) => plan.isActive) || null;
}

function buildDemoAssessmentSources(
  plan: ReturnType<typeof buildPlan>,
  assessmentScope: "daily" | "weekly",
) {
  const taskPool = assessmentScope === "weekly"
    ? plan.tasks.flatMap((day) => day.items)
    : plan.tasks[0]?.items || [];
  const topicPool = cleanTopics([
    ...plan.knownTopics,
    ...plan.targetTopics,
    ...plan.roadmap.flatMap((week) => week.focusTopics || []),
  ], assessmentScope === "weekly" ? 8 : 6);

  const taskSources = taskPool.map((item) => ({
    kind: "task",
    topic: item.referenceLabel || item.title,
    promptTopic: item.title,
    referenceLabel: item.referenceLabel || item.title,
    referenceUrl: item.referenceUrl || null,
    taskTitle: item.title,
    summary: item.summary || null,
    type: item.type,
  }));

  const topicSources = topicPool.map((topic) => ({
    kind: "topic",
    topic,
    promptTopic: topic,
    referenceLabel: plan.resources.find((entry) => entry.topic === topic)?.items?.[0]?.title || topic,
    referenceUrl: plan.resources.find((entry) => entry.topic === topic)?.items?.[0]?.url || null,
    taskTitle: null,
    summary: null,
    type: "Revision",
  }));

  const interleaved: Array<(typeof taskSources)[number] | (typeof topicSources)[number]> = [];
  const taskQueue = [...taskSources];
  const topicQueue = [...topicSources];
  while (taskQueue.length || topicQueue.length) {
    if (taskQueue.length) {
      interleaved.push(taskQueue.shift()!);
    }
    if (topicQueue.length) {
      interleaved.push(topicQueue.shift()!);
    }
  }

  return interleaved;
}

function normalizeChoiceText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDemoKnowledgeAnswer(topic: string, referenceLabel?: string | null, taskTitle?: string | null, cardAnswer?: string) {
  const topicLabel = String(topic || referenceLabel || taskTitle || "this topic").trim() || "this topic";
  const normalizedTopic = normalizeChoiceText(`${topicLabel} ${referenceLabel || ""} ${taskTitle || ""}`);

  if (normalizedTopic.includes("two sum")) {
    return "Two Sum is solved efficiently by storing seen values in a hash map and checking each number for its needed complement in O(n) time.";
  }
  if (normalizedTopic.includes("binary search")) {
    return "Binary search works on a sorted search space by comparing the middle value and discarding half of the remaining range each step.";
  }
  if (normalizedTopic.includes("sliding window")) {
    return "Sliding window maintains a moving range over an array or string so repeated work is avoided while constraints are checked incrementally.";
  }
  if (normalizedTopic.includes("array") || normalizedTopic.includes("string")) {
    return "Array and string problems often depend on indexing, hash maps, two pointers, or sliding windows to reduce brute-force comparisons.";
  }
  if (normalizedTopic.includes("tree")) {
    return "Tree traversal visits nodes systematically with DFS using recursion or a stack, or BFS using a queue for level-order processing.";
  }
  if (normalizedTopic.includes("graph")) {
    return "Graph traversal uses BFS or DFS with a visited set; the standard traversal cost is O(V + E) for vertices and edges.";
  }
  if (normalizedTopic.includes("dynamic") || normalizedTopic === "dp") {
    return "Dynamic programming defines state, transition, and base cases, then uses memoization or tabulation to avoid recomputing overlapping subproblems.";
  }
  if (normalizedTopic.includes("sql") || normalizedTopic.includes("dbms") || normalizedTopic.includes("database")) {
    return "Database queries should use correct filtering, joins, grouping, and indexes while balancing read speed against write and storage overhead.";
  }
  if (normalizedTopic.includes("normalization")) {
    return "Normalization reduces redundancy and update anomalies by decomposing data into related tables with clear keys and relationships.";
  }
  if (normalizedTopic.includes("transaction") || normalizedTopic.includes("acid")) {
    return "ACID transactions preserve correctness by guaranteeing atomicity, consistency, isolation, and durability around database changes.";
  }
  if (normalizedTopic.includes("operating") || normalizedTopic === "os" || normalizedTopic.includes("paging")) {
    return "Operating systems manage processes, memory, files, and devices; paging maps virtual pages to physical frames for isolation and flexible memory use.";
  }
  if (normalizedTopic.includes("scheduling") || normalizedTopic.includes("process")) {
    return "CPU scheduling chooses which ready process or thread runs next according to a policy such as priority, round-robin, or shortest job first.";
  }
  if (normalizedTopic.includes("system") || normalizedTopic.includes("cache") || normalizedTopic.includes("scalability")) {
    return "System design answers should connect requirements to capacity, data model, caching, queues, consistency, bottlenecks, and failure handling.";
  }
  if (normalizedTopic.includes("api") || normalizedTopic.includes("backend") || normalizedTopic.includes("auth")) {
    return "A backend API should validate input, authenticate the caller, enforce business rules, persist data safely, and return a clear status response.";
  }
  if (cardAnswer && !/your|you|react|respond|approach/i.test(cardAnswer)) {
    return cardAnswer.trim();
  }

  return `A correct answer should define ${topicLabel}, name its main use case, and explain one practical tradeoff or edge case.`;
}

function buildMcqPrompt(topic: string, referenceLabel?: string | null, taskTitle?: string | null) {
  const label = referenceLabel || taskTitle || topic || "this topic";
  return `Which statement is correct about ${label}?`;
}

function buildTopicDistractors(topic: string, correctText: string) {
  const normalizedTopic = normalizeChoiceText(topic);
  const options = [
    "A hash table stores all elements in sorted order by default.",
    "Recursion is always faster than iteration for interview problems.",
    "Time complexity only matters after the code is fully written.",
    "Edge cases are handled automatically by the programming language.",
  ];

  if (normalizedTopic.includes("dbms") || normalizedTopic.includes("sql") || normalizedTopic.includes("database")) {
    options.push("A primary key encrypts every row in the table automatically.");
    options.push("Indexes always improve both read speed and write speed with no storage cost.");
  }
  if (normalizedTopic.includes("operating") || normalizedTopic === "os") {
    options.push("A process scheduler is responsible for choosing disk block locations.");
    options.push("Virtual memory requires every process to share the same physical addresses.");
  }
  if (normalizedTopic.includes("system")) {
    options.push("Caching removes every consistency and invalidation problem.");
    options.push("A load balancer stores the permanent source of truth for user data.");
  }
  if (normalizedTopic.includes("dynamic") || normalizedTopic === "dp") {
    options.push("Dynamic programming means sorting the input before every recursive call.");
    options.push("A DP transition is optional when memoization is used.");
  }
  if (normalizedTopic.includes("graph")) {
    options.push("DFS always returns the shortest weighted path in any graph.");
    options.push("Visited sets are unnecessary because graphs cannot contain cycles.");
  }
  if (normalizedTopic.includes("array") || normalizedTopic.includes("string")) {
    options.push("Two pointers require the input to be randomly shuffled first.");
    options.push("Sliding window recomputes every subarray from scratch.");
  }

  const correctFingerprint = normalizeChoiceText(correctText);
  return options.filter((option) => normalizeChoiceText(option) !== correctFingerprint);
}

function buildMcqChoices(questionId: string, correctText: string, distractors: string[]) {
  const seen = new Set<string>();
  const optionTexts = [correctText, ...distractors]
    .map((text) => String(text || "").trim())
    .filter((text) => {
      const fingerprint = normalizeChoiceText(text);
      if (!fingerprint || seen.has(fingerprint)) {
        return false;
      }
      seen.add(fingerprint);
      return true;
    })
    .slice(0, 4);

  while (optionTexts.length < 4) {
    optionTexts.push([
      "A database index removes the need for query filters.",
      "Caching permanently removes the need for a source database.",
      "BFS gives correct weighted shortest paths without checking edge weights.",
      "Transactions only apply to read-only SELECT queries.",
    ][optionTexts.length % 4]);
  }

  const shuffled = shuffle(optionTexts).map((text, optionIndex) => ({
    id: `${questionId}-option-${optionIndex + 1}`,
    label: String.fromCharCode(65 + optionIndex),
    text,
  }));

  return {
    choices: shuffled,
    correctOptionId: shuffled.find((choice) => normalizeChoiceText(choice.text) === normalizeChoiceText(correctText))?.id || shuffled[0].id,
  };
}

function buildAssessmentQuestions(
  plan: ReturnType<typeof buildPlan>,
  assessmentType: "mcq" | "fill_blank" | "coding",
  durationMinutes: number,
  assessmentScope: "daily" | "weekly",
) {
  const sources = buildDemoAssessmentSources(plan, assessmentScope);

  if (assessmentType === "coding") {
    return sources.filter((source) => source.kind === "task").slice(0, 3).map((source, index) => ({
      id: `coding-${index + 1}`,
      topic: source.promptTopic,
      prompt: `Write a short interview-style solution or pseudocode for ${source.referenceLabel || source.promptTopic}. Mention the core approach and time complexity.`,
      type: "coding",
      averageTimeMinutes: clamp(Math.round(durationMinutes / 3), 15, 30),
      referenceLabel: source.referenceLabel,
      referenceUrl: source.referenceUrl,
      placeholder: "Use short code or pseudocode. Keep it interview-focused.",
      taskTitle: source.taskTitle,
      expectedKeywords: cleanTopics([source.type, source.promptTopic, source.referenceLabel || "", "time complexity"], 6),
    }));
  }

  const questionCount = assessmentType === "fill_blank"
    ? (assessmentScope === "weekly" ? 6 : 4)
    : (assessmentScope === "weekly" ? 5 : 4);
  const relevantCards = sources.slice(0, questionCount).map((source) => {
    const card = plan.flashcards.find((entry) => entry.topic === source.promptTopic || entry.topic === source.topic)
      || plan.flashcards.find((entry) => source.promptTopic.toLowerCase().includes(entry.topic.toLowerCase()))
      || plan.flashcards.find((entry) => entry.topic.toLowerCase().includes(source.promptTopic.toLowerCase()))
      || plan.flashcards[0];

    return { source, card };
  });

  if (assessmentType === "fill_blank") {
    return relevantCards.map(({ source, card }, index) => {
      const answer = String(card.answer || "").trim();
      const keyPhrase = answer.split(/\s+/).slice(0, 4).join(" ");
      return {
        id: `fill-${index + 1}`,
        topic: source.promptTopic,
        prompt: `Fill in the blank for ${assessmentScope === "weekly" ? "this weekly focus" : "today's focus"} ${source.referenceLabel || source.promptTopic}: ${answer.replace(keyPhrase, "_____")}`,
        type: "fill_blank",
        averageTimeMinutes: clamp(Math.round(durationMinutes / Math.max(relevantCards.length, 1)), 3, 8),
        referenceLabel: source.referenceLabel,
        referenceUrl: source.referenceUrl,
        placeholder: "Type the missing idea",
        expectedAnswer: keyPhrase,
      };
    });
  }

  return relevantCards.map(({ source, card }, index) => {
    const questionId = `mcq-${index + 1}`;
    const correctText = buildDemoKnowledgeAnswer(
      source.promptTopic,
      source.referenceLabel,
      source.taskTitle,
      String(card.answer || ""),
    );
    const { choices, correctOptionId } = buildMcqChoices(
      questionId,
      correctText,
      buildTopicDistractors(source.promptTopic, correctText),
    );

    return {
      id: questionId,
      topic: source.promptTopic,
      prompt: buildMcqPrompt(source.promptTopic, source.referenceLabel, source.taskTitle),
      type: "mcq",
      averageTimeMinutes: clamp(Math.round(durationMinutes / Math.max(relevantCards.length, 1)), 3, 8),
      referenceLabel: source.referenceLabel,
      referenceUrl: source.referenceUrl,
      choices,
      correctOptionId,
    };
  });
}

function buildAssessmentSession(
  plan: ReturnType<typeof buildPlan>,
  assessmentType: "mcq" | "fill_blank" | "coding",
  durationMinutes: number,
  assessmentScope: "daily" | "weekly",
) {
  return {
    id: createId("assessment"),
    userId: "demo-user",
    planId: plan.id,
    status: "started",
    assessmentType,
    assessmentScope,
    durationMinutes,
    weakSpots: [],
    recommendations: [],
    questions: buildAssessmentQuestions(plan, assessmentType, durationMinutes, assessmentScope),
    submission: { answers: {} },
    score: 0,
    metadata: {
      planTitle: plan.title,
      targetRole: plan.targetRole,
      targetTopics: plan.targetTopics,
      scope: assessmentScope,
    },
    startedAt: new Date().toISOString(),
    submittedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function scoreDemoAssessmentQuestion(question: Record<string, unknown>, response: string) {
  const normalizedResponse = String(response || "").trim().toLowerCase();

  if (question.type === "mcq") {
    return String(response || "").trim() === String(question.correctOptionId || "") ? 1 : 0;
  }

  if (question.type === "fill_blank") {
    return normalizedResponse.includes(String(question.expectedAnswer || "").trim().toLowerCase()) ? 1 : 0;
  }

  const expectedKeywords = Array.isArray(question.expectedKeywords)
    ? question.expectedKeywords.map((entry) => String(entry).toLowerCase())
    : [];
  if (!expectedKeywords.length) {
    return normalizedResponse.length >= 80 ? 0.6 : 0;
  }

  const matches = expectedKeywords.filter((keyword) => normalizedResponse.includes(keyword)).length;
  const score = matches / expectedKeywords.length;
  if (/time complexity|o\(/.test(normalizedResponse)) {
    return clamp(score + 0.15, 0, 1);
  }

  return score;
}

function buildDemoAssessmentRecommendations(plan: ReturnType<typeof buildPlan>, weakSpots: string[]) {
  return weakSpots.map((topic) => {
    const resource = plan.resources.find((entry) => entry.topic === topic)?.items?.[0];
    const task = plan.tasks.flatMap((day) => day.items).find((item) => `${item.title} ${item.referenceLabel}`.toLowerCase().includes(topic.toLowerCase()));
    return {
      topic,
      reason: `${topic} needs another round of recall and execution.`,
      action: task
        ? `Redo ${task.referenceLabel || task.title}, then explain the approach out loud before checking notes.`
        : `Run one more focused revision loop on ${topic}.`,
      resourceLabel: resource?.title || null,
      resourceUrl: resource?.url || null,
      problemLabel: task?.referenceLabel || task?.title || null,
      problemUrl: task?.referenceUrl || null,
    };
  });
}

function buildDemoCoachStudents(now: string) {
  return [
    {
      id: "demo-student-1",
      name: "Asha Raman",
      username: "asha_backend",
      email: "asha.demo@placeprep.app",
      targetRole: "Backend Engineer Intern",
      readinessScore: 74,
      consistencyScore: 81,
      currentStreak: 9,
      solvedProblems: 132,
      weakAreas: ["Operating Systems", "DBMS", "System Design"],
      strongTopics: ["Arrays", "Strings"],
    },
    {
      id: "demo-student-2",
      name: "Vikram Sen",
      username: "vikram_data",
      email: "vikram.demo@placeprep.app",
      targetRole: "Data Analyst Intern",
      readinessScore: 68,
      consistencyScore: 73,
      currentStreak: 5,
      solvedProblems: 97,
      weakAreas: ["SQL", "Statistics", "Data Visualization"],
      strongTopics: ["Python", "Spreadsheets"],
    },
  ].map((student, index) => {
    const weeklyProgress = Array.from({ length: 7 }, (_, dayIndex) => ({
      date: new Date(Date.now() - (6 - dayIndex) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayIndex],
      missions: Math.max(1, 2 + ((dayIndex + index) % 4)),
      hours: Number((1.5 + ((dayIndex + index) % 3) * 0.7).toFixed(1)),
    }));
    const progressHistory = weeklyProgress.map((entry, historyIndex) => ({
      id: `demo-progress-${student.id}-${historyIndex + 1}`,
      userId: student.id,
      statDate: entry.date,
      streak: student.currentStreak - (6 - historyIndex),
      bonusStreak: historyIndex > 4 ? 1 : 0,
      consistencyScore: student.consistencyScore - (6 - historyIndex),
      readinessScore: student.readinessScore - (6 - historyIndex),
      executionRate: 65 + historyIndex * 4,
      totalHours: entry.hours,
      tasksCompleted: entry.missions,
      powerPocketMinutes: 25 + historyIndex * 5,
      metadata: { source: "demo-mode" },
      createdAt: now,
      updatedAt: now,
    }));
    const practiceCapsules = [{
      bundleId: `demo-capsule-${student.id}`,
      title: index === 0 ? "OS + DBMS recovery block" : "SQL dashboard drill",
      note: "Demo admin assignment created to show the oversight workflow.",
      studentUserId: student.id,
      assignedById: "demo-admin",
      assignedByName: "Demo Admin",
      assignmentId: `demo-assignment-${student.id}`,
      dueAt: addDaysIso(1),
      scheduledFor: new Date().toISOString().slice(0, 10),
      createdAt: now,
      items: [{
        taskId: `demo-capsule-task-${student.id}`,
        title: index === 0 ? "Explain paging and indexing tradeoffs" : "Build a SQL insight summary",
        description: "Complete the linked practice and upload a short proof note.",
        category: index === 0 ? "Core" : "SQL",
        status: "pending",
        referenceLabel: index === 0 ? "OS and DBMS revision" : "SQL analytics practice",
        referenceUrl: "https://www.geeksforgeeks.org/",
        capsuleType: "admin-assignment",
        dueAt: addDaysIso(1),
        scheduledFor: new Date().toISOString().slice(0, 10),
        createdAt: now,
      }],
    }];

    return {
      student: {
        id: student.id,
        name: student.name,
        username: student.username,
        role: "user",
        accessTier: "standard",
        email: student.email,
        weakAreas: student.weakAreas,
        strongTopics: student.strongTopics,
        targetRole: student.targetRole,
        placementDate: "2026-06-15",
        timezone: "Asia/Calcutta",
        solvedProblems: student.solvedProblems,
        averageTimePerProblem: 31 + index * 4,
        failedAttempts: 12 + index * 3,
        mistakeCount: 15 + index * 4,
        consistencyScore: student.consistencyScore,
        currentStreak: student.currentStreak,
        readinessScore: student.readinessScore,
        preferredLanguage: "english",
        coachMetadata: { invitedBy: "demo-admin", demo: true },
        createdAt: now,
        updatedAt: now,
      },
      invitedBy: {
        id: "demo-admin",
        name: "Demo Admin",
        username: "admin-demo",
        inviteCode: index === 0 ? "USER-DEMO" : "USER-DEMO-2",
        invitedAt: now,
      },
      progress: {
        streak: student.currentStreak,
        consistencyScore: student.consistencyScore,
        readinessScore: student.readinessScore,
        solvedProblems: student.solvedProblems,
        averageTimePerProblem: 31 + index * 4,
        failedAttempts: 12 + index * 3,
        totalHours: weeklyProgress.reduce((sum, entry) => sum + entry.hours, 0),
        tasksCompleted: weeklyProgress.reduce((sum, entry) => sum + entry.missions, 0),
        statDate: new Date().toISOString().slice(0, 10),
        weeklyProgress,
        topicStrength: student.strongTopics.concat(student.weakAreas).slice(0, 5).map((topic, topicIndex) => ({
          topic,
          strength: topicIndex < 2 ? 82 - topicIndex * 5 : 54 + topicIndex * 4,
        })),
      },
      taskSummary: {
        userId: student.id,
        total: 8 + index,
        pending: 3,
        inProgress: 2,
        completed: 3 + index,
        skipped: 0,
        overdue: index,
      },
      recentProofs: [{
        id: `demo-proof-${student.id}`,
        userId: student.id,
        secureUrl: createDemoSvgDataUrl(index === 0 ? "OS Notes" : "SQL Proof"),
        publicId: `demo-proof-${student.id}`,
        mimeType: "image/svg+xml",
        storageProvider: "demo-local",
        proofDate: new Date().toISOString().slice(0, 10),
        caption: index === 0 ? "Paging notes and indexing comparison." : "Dashboard metric sketch.",
        createdAt: now,
        updatedAt: now,
      }],
      progressHistory,
      practiceCapsules,
    };
  });
}

function buildInitialState(role: DemoRole = "user") {
  const activePlan = buildPlan({
    knownTopics: ["Arrays", "Strings"],
    targetTopics: ["Operating Systems", "DBMS", "System Design"],
    targetRole: "Backend Engineer Intern",
    timePerDay: 180,
    durationMonths: 3,
  }, 3);
  const previousPlan = { ...buildPlan({
    knownTopics: ["Arrays", "Strings"],
    targetTopics: ["Dynamic Programming", "Graphs", "Operating Systems"],
    targetRole: "Backend Engineer Intern",
    timePerDay: 150,
    durationMonths: 2,
  }, 2, activePlan.id), isActive: false, title: "Backend Interview Sprint: DP + Graphs", autoTitle: "Backend Interview Sprint: DP + Graphs" };
  previousPlan.metadata = { ...previousPlan.metadata, title: previousPlan.title, autoTitle: previousPlan.autoTitle };
  const tasks = buildTasksFromPlan(activePlan);
  const progressSummary = buildProgressSummary(tasks, activePlan);
  const now = new Date().toISOString();
  const isAdminDemo = role === "admin";
  const demoUser = {
    id: isAdminDemo ? "demo-admin" : "demo-user",
    name: isAdminDemo ? "Demo Admin" : "Demo Operator",
    username: isAdminDemo ? "admin-demo" : "demo",
    role,
    accessTier: "standard",
    email: isAdminDemo ? "admin.demo@placeprep.app" : "demo@placeprep.app",
    weakAreas: activePlan.targetTopics,
    strongTopics: activePlan.knownTopics,
    targetRole: isAdminDemo ? "Placement Coach" : activePlan.targetRole,
    placementDate: "2026-05-30",
    timezone: "Asia/Calcutta",
    solvedProblems: isAdminDemo ? 0 : 148,
    averageTimePerProblem: isAdminDemo ? 0 : 32,
    failedAttempts: isAdminDemo ? 0 : 19,
    mistakeCount: isAdminDemo ? 0 : 23,
    consistencyScore: progressSummary.consistencyScore,
    currentStreak: progressSummary.streak,
    readinessScore: progressSummary.readinessScore,
    preferredLanguage: "english",
    coachMetadata: {
      prepArchitectPlanId: activePlan.id,
      prepArchitectPlanTitle: activePlan.title,
      demoRole: role,
    },
    createdAt: now,
    updatedAt: now,
  };
  const demoStudents = buildDemoCoachStudents(now);
  const demoGroups = [{
    id: "demo-group-core",
    name: "Backend sprint cohort",
    description: "Demo students preparing for backend internship rounds.",
    createdBy: "demo-admin",
    createdByName: "Demo Admin",
    metadata: { source: "demo-mode" },
    createdAt: now,
    updatedAt: now,
    memberCount: 2,
    assignmentRecipientCount: 2,
    members: demoStudents.map((entry) => ({
      groupId: "demo-group-core",
      userId: entry.student.id,
      name: entry.student.name,
      username: entry.student.username,
      role: entry.student.role,
      email: entry.student.email,
      targetRole: entry.student.targetRole,
      readinessScore: entry.student.readinessScore,
      accessTier: entry.student.accessTier,
      addedBy: "demo-admin",
      addedByName: "Demo Admin",
      createdAt: now,
    })),
  }];

  return {
    user: demoUser,
    profile: {
      id: "demo-profile",
      userId: "demo-user",
      linkedinUrl: "https://www.linkedin.com/",
      githubUrl: "https://github.com/",
      leetcodeUrl: "https://leetcode.com/",
      portfolioUrl: "https://roadmap.sh/",
      resumeUrl: createDemoTextDataUrl("Demo resume link for PlacePrep walkthrough."),
      avatarUrl: createDemoSvgDataUrl("PP", "#7b1f1f"),
      notificationsEnabled: true,
      notificationEmailEnabled: true,
      notificationBrowserEnabled: false,
      notificationBrowserPermission: "default",
      createdAt: now,
      updatedAt: now,
    },
    prepPlans: [activePlan, previousPlan],
    assessmentSessions: [],
    tasks,
    progressSummary,
    progressHistory: buildProgressHistory(progressSummary),
    mentorHistory: [
      { id: createId("mentor"), userId: "demo-user", role: "assistant", content: "Start from Operating Systems. Tighten process scheduling, memory management, and the language you use to explain tradeoffs.", metadata: { source: "demo-mode" }, createdAt: now },
      { id: createId("mentor"), userId: "demo-user", role: "user", content: "What should I do if DBMS theory feels memorized but not internalized?", metadata: { source: "demo-mode" }, createdAt: now },
      { id: createId("mentor"), userId: "demo-user", role: "assistant", content: "Switch from raw notes to retrieval. Pick one concept like normalization, explain it out loud, then solve one concrete SQL or schema problem immediately after.", metadata: { source: "demo-mode" }, createdAt: now },
    ],
    notifications: [
      { id: createId("notif"), userId: "demo-user", type: "pending_tasks", message: "Two high-priority Prep Architect tasks are still open.", sentAt: now, read: false, readAt: null, deliveryChannels: ["in-app"], metadata: { route: "/tasks" }, dedupeKey: "demo-pending", createdAt: now, updatedAt: now },
      { id: createId("notif"), userId: "demo-user", type: "countdown_urgency", message: "Placement day is getting close. Finish one revision loop tonight.", sentAt: now, read: true, readAt: now, deliveryChannels: ["in-app"], metadata: { route: "/dashboard" }, dedupeKey: "demo-countdown", createdAt: now, updatedAt: now },
    ],
    uploads: [
      { id: createId("proof"), userId: "demo-user", secureUrl: createDemoSvgDataUrl("Binary Tree Notes"), publicId: "demo-proof", caption: "Finished one binary tree revision sheet.", proofDate: new Date().toISOString().slice(0, 10), createdAt: now, updatedAt: now },
    ],
    resumeHistory: [
      {
        id: createId("resume"),
        userId: "demo-user",
        fileName: "backend-intern-resume-demo.txt",
        mimeType: "text/plain",
        secureUrl: createDemoTextDataUrl("Demo backend resume for PlacePrep."),
        publicId: "demo-resume",
        storageProvider: "demo-local",
        sizeBytes: 4096,
        extractedText: "Demo resume text",
        analysisSummary: "Strong project framing and clear backend stack, but quantify outcomes harder.",
        score: 82,
        strengths: ["Projects connect directly to backend interview themes.", "Skills section is clean and scannable."],
        improvements: ["Add metrics to project outcomes.", "Tighten one-line summary to match backend internship roles."],
        keywords: ["Node.js", "PostgreSQL", "REST APIs", "System Design"],
        sections: { summary: true, education: true, experience: true, projects: true, skills: true, achievements: false },
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    powerPocketSession: null,
    apkVersions: [],
    invites: [
      buildInviteRecord("user", "Demo user invite"),
      buildInviteRecord("admin", "Demo admin invite"),
      buildInviteRecord("user", "Already used demo invite", true),
    ],
    coachStudents: demoStudents,
    coachGroups: demoGroups,
    groupCandidates: demoStudents.map((entry) => ({
      id: entry.student.id,
      name: entry.student.name,
      username: entry.student.username,
      role: entry.student.role,
      email: entry.student.email,
      targetRole: entry.student.targetRole,
      accessTier: entry.student.accessTier,
    })),
  };
}

function safeParse(value: string, fallback: Record<string, unknown> | null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readState() {
  const stored = window.localStorage.getItem(DEMO_STATE_STORAGE_KEY);
  const state = stored ? safeParse(stored, null) : null;
  const role = window.localStorage.getItem(DEMO_ROLE_STORAGE_KEY) === "admin" ? "admin" : "user";
  const resolved = state || buildInitialState(role);
  window.localStorage.setItem(DEMO_STATE_STORAGE_KEY, JSON.stringify(resolved));
  return resolved;
}

function writeState(state: Record<string, unknown>) {
  window.localStorage.setItem(DEMO_STATE_STORAGE_KEY, JSON.stringify(state));
  return state;
}

function updateState(updater: (state: Record<string, unknown>) => Record<string, unknown>) {
  return writeState(updater(readState()));
}

function parseBody(body?: BodyInit | null) {
  if (!body) {
    return {};
  }
  if (typeof body === "string") {
    return safeParse(body, {}) || {};
  }
  if (body instanceof FormData) {
    const result: Record<string, unknown> = {};
    body.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  return {};
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read this file in demo mode."));
    reader.readAsDataURL(file);
  });
}

function buildMentorReply(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("os") || lower.includes("operating")) {
    return "Anchor the answer in one mechanism and one tradeoff. Explain paging, then connect it to fragmentation or lookup cost.";
  }
  if (lower.includes("dbms") || lower.includes("sql")) {
    return "Move from memory to retrieval. Read one transaction or indexing concept, explain it aloud, then solve one SQL problem immediately after.";
  }
  if (lower.includes("system design")) {
    return "Start by pinning scope, traffic, and bottlenecks. If the first two minutes are clear, the rest of the design gets much easier to defend.";
  }
  return "Keep the next step concrete. Pick one topic, one creator resource, one article, and one problem. Finish that before widening the plan.";
}

function refreshState(state: Record<string, unknown>) {
  const activePlan = getActivePlanFromState(state);
  const tasks = (state.tasks as Array<Record<string, unknown>>) || [];
  const progressSummary = buildProgressSummary(tasks, activePlan);
  return {
    ...state,
    user: {
      ...(state.user as Record<string, unknown>),
      weakAreas: (activePlan?.targetTopics as string[] | undefined) || (state.user as Record<string, unknown>).weakAreas,
      strongTopics: (activePlan?.knownTopics as string[] | undefined) || (state.user as Record<string, unknown>).strongTopics,
      targetRole: activePlan?.targetRole || (state.user as Record<string, unknown>).targetRole,
      readinessScore: progressSummary.readinessScore,
      consistencyScore: progressSummary.consistencyScore,
      currentStreak: progressSummary.streak,
      coachMetadata: {
        ...(((state.user as Record<string, unknown>).coachMetadata as Record<string, unknown>) || {}),
        prepArchitectPlanId: activePlan?.id || null,
        prepArchitectPlanTitle: activePlan?.title || null,
      },
      updatedAt: new Date().toISOString(),
    },
    progressSummary,
  };
}

export function isDemoModeEnabled() {
  return window.localStorage.getItem(DEMO_MODE_STORAGE_KEY) === "true";
}

export function activateDemoMode(role: DemoRole = "user"): AuthResult {
  window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, "true");
  window.localStorage.setItem(DEMO_ROLE_STORAGE_KEY, role);
  const state = buildInitialState(role);
  window.localStorage.setItem(DEMO_STATE_STORAGE_KEY, JSON.stringify(state));
  return { token: DEMO_SESSION_TOKEN, user: state.user as AuthResult["user"] };
}

export function clearDemoMode() {
  window.localStorage.removeItem(DEMO_MODE_STORAGE_KEY);
  window.localStorage.removeItem(DEMO_ROLE_STORAGE_KEY);
  window.localStorage.removeItem(DEMO_STATE_STORAGE_KEY);
}

export async function handleDemoRequest<T>(path: string, options: { method?: string; body?: BodyInit | null } = {}): Promise<T> {
  await wait(DEMO_DELAY_MS);

  const url = new URL(path, window.location.origin);
  const pathname = url.pathname;
  const method = (options.method || "GET").toUpperCase();
  const body = parseBody(options.body);
  const state = readState();

  if (pathname === "/auth/me" && method === "GET") return state.user as T;
  if (pathname === "/profile" && method === "GET") return state.profile as T;
  if (pathname === "/profile/web-push/config" && method === "GET") return { enabled: false, publicKey: "" } as T;
  if (pathname === "/profile/push-subscriptions") return {} as T;
  if (pathname === "/ai/status" && method === "GET") return { aiEnabled: true, reason: "working", provider: "demo", model: "demo-curated", fallbackMode: true, lastCheckedAt: new Date().toISOString(), lastError: null } as T;
  if (pathname === "/progress/summary" && method === "GET") return refreshState(state).progressSummary as T;
  if (pathname === "/progress/history" && method === "GET") {
    const days = Number(url.searchParams.get("days") || state.progressHistory.length);
    return state.progressHistory.slice(0, days) as T;
  }
  if (pathname === "/assessments/overview" && method === "GET") {
    const activePlan = getActivePlanFromState(state) as ReturnType<typeof buildPlan> | null;
    const assessmentSessions = ((state.assessmentSessions as Array<Record<string, unknown>>) || [])
      .slice()
      .sort((left, right) => new Date(String(right.createdAt || 0)).getTime() - new Date(String(left.createdAt || 0)).getTime());
    const currentSession = assessmentSessions.find((session) => session.status !== "completed" && session.status !== "skipped")
      || assessmentSessions[0]
      || null;

    return {
      activePlan: activePlan
        ? {
            id: activePlan.id,
            title: activePlan.title,
            targetRole: activePlan.targetRole,
            targetTopics: activePlan.targetTopics,
            knownTopics: activePlan.knownTopics,
            timePerDay: activePlan.timePerDay,
            durationMonths: activePlan.durationMonths,
            version: activePlan.version,
            isActive: activePlan.isActive,
          }
        : null,
      currentSession,
      recentSessions: assessmentSessions,
    } as T;
  }
  if (pathname === "/notifications" && method === "GET") {
    const unreadOnly = url.searchParams.get("unread") === "true";
    const limit = Number(url.searchParams.get("limit") || state.notifications.length);
    return state.notifications.filter((item: Record<string, unknown>) => (unreadOnly ? !item.read : true)).slice(0, limit) as T;
  }
  if (pathname === "/resume/latest" && method === "GET") return (state.resumeHistory[0] || null) as T;
  if (pathname === "/resume" && method === "GET") return state.resumeHistory as T;
  if (pathname === "/resume/match" && method === "POST") {
    const activeRole = typeof body.targetRole === "string" ? body.targetRole : state.user.targetRole;
    const jdText = String(body.jobDescription || "");
    const matchedKeywords = cleanTopics(
      jdText
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .filter((token) => token.length > 3)
        .filter((token) => String((state.resumeHistory[0] as Record<string, unknown>)?.extractedText || "").toLowerCase().includes(token)),
      8,
    );
    return {
      targetRole: activeRole,
      atsScore: 84,
      jobMatchScore: clamp(58 + matchedKeywords.length * 5, 0, 100),
      matchedKeywords,
      missingKeywords: cleanTopics(["metrics", "ownership", "testing", "performance"].filter((token) => !matchedKeywords.includes(token)), 6),
      benchmarkHighlights: [
        `${activeRole} resumes read best when they show measurable impact, not just tool names.`,
        "Projects should state the problem, stack, action, and result in one tight bullet flow.",
        "Mirror the JD language naturally in relevant bullets instead of stuffing a keyword list.",
      ],
      tailoredSuggestions: [
        "Add one more quantified project bullet with a clear outcome.",
        "Bring the missing JD terms into experience or projects where they are genuinely true.",
        "Tighten the summary so the first three lines already match the role direction.",
      ],
      summary: "Demo job-specific ATS score generated from the active resume snapshot and the pasted JD.",
    } as T;
  }
  if (pathname === "/uploads/images" && method === "GET") return state.uploads as T;
  if (pathname === "/apk/latest" && method === "GET") return (state.apkVersions[0] || null) as T;
  if (pathname === "/apk/versions" && method === "GET") return state.apkVersions as T;
  if (pathname === "/invites" && method === "GET") {
    const limit = Number(url.searchParams.get("limit") || 25);
    return ((state.invites as Array<Record<string, unknown>>) || []).slice(0, limit) as T;
  }
  if (pathname === "/coach/students" && method === "GET") return ((state.coachStudents as unknown[]) || []) as T;
  if (pathname === "/coach/groups" && method === "GET") return ((state.coachGroups as unknown[]) || []) as T;
  if (pathname === "/coach/group-candidates" && method === "GET") return ((state.groupCandidates as unknown[]) || []) as T;
  if (pathname === "/power-pocket/active" && method === "GET") return state.powerPocketSession as T;
  if (pathname === "/ai/chat" && method === "GET") return state.mentorHistory as T;
  if (pathname === "/ai/prep-architect/latest" && method === "GET") return (state.prepPlans.find((plan: Record<string, unknown>) => plan.isActive) || null) as T;
  if (pathname === "/ai/prep-architect/history" && method === "GET") return state.prepPlans as T;

  if (pathname === "/tasks/today" && method === "GET") return state.tasks as T;
  if (pathname === "/tasks" && method === "GET") {
    const status = url.searchParams.get("status");
    const category = url.searchParams.get("category");
    return state.tasks.filter((task: Record<string, unknown>) => (!status || task.status === status) && (!category || task.category === category)) as T;
  }

  if (pathname === "/auth/me" && method === "PATCH") {
    return updateState((current) => refreshState({
      ...current,
      user: {
        ...(current.user as Record<string, unknown>),
        ...(body as Record<string, unknown>),
        updatedAt: new Date().toISOString(),
      },
    })).user as T;
  }

  if (pathname === "/profile" && (method === "POST" || method === "PATCH")) {
    return updateState((current) => ({
      ...current,
      profile: {
        ...(current.profile as Record<string, unknown>),
        ...(body as Record<string, unknown>),
        updatedAt: new Date().toISOString(),
      },
    })).profile as T;
  }

  if (pathname === "/invites" && method === "POST") {
    const invite = buildInviteRecord(body.role === "admin" ? "admin" : "user", String(body.label || "Demo invite"));
    return updateState((current) => ({
      ...current,
      invites: [invite, ...((current.invites as Array<Record<string, unknown>>) || [])],
    })).invites[0] as T;
  }

  if (pathname === "/invites/bulk" && method === "POST") {
    const quantity = clamp(Number(body.quantity || 1), 1, 100);
    const invites = Array.from({ length: quantity }, (_, index) =>
      buildInviteRecord(
        body.role === "admin" ? "admin" : "user",
        String(body.label || "Demo invite") + (quantity > 1 ? ` #${index + 1}` : ""),
      )
    );
    updateState((current) => ({
      ...current,
      invites: [...invites, ...((current.invites as Array<Record<string, unknown>>) || [])],
    }));
    return invites as T;
  }

  if (pathname === "/invites/history" && method === "DELETE") {
    const inactive = ((state.invites as Array<Record<string, unknown>>) || []).filter((invite) => invite.status !== "valid");
    updateState((current) => ({
      ...current,
      invites: ((current.invites as Array<Record<string, unknown>>) || []).filter((invite) => invite.status === "valid"),
    }));
    return { deleted: inactive.length, clearedAt: new Date().toISOString() } as T;
  }

  if (pathname === "/coach/groups" && method === "POST") {
    const group = {
      id: createId("group"),
      name: String(body.name || "Demo group"),
      description: typeof body.description === "string" ? body.description : null,
      createdBy: "demo-admin",
      createdByName: "Demo Admin",
      metadata: { source: "demo-mode" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      memberCount: 0,
      assignmentRecipientCount: 0,
      members: [],
    };
    return updateState((current) => ({
      ...current,
      coachGroups: [group, ...((current.coachGroups as Array<Record<string, unknown>>) || [])],
    })).coachGroups[0] as T;
  }

  const groupMembersMatch = pathname.match(/^\/coach\/groups\/([^/]+)\/members$/);
  if (groupMembersMatch && method === "POST") {
    const groupId = groupMembersMatch[1];
    const studentIds = Array.isArray(body.studentUserIds) ? body.studentUserIds.map(String) : [];
    const candidates = ((state.groupCandidates as Array<Record<string, unknown>>) || []);
    const nextGroups = ((state.coachGroups as Array<Record<string, unknown>>) || []).map((group) => {
      if (group.id !== groupId) {
        return group;
      }
      const existingMembers = (group.members as Array<Record<string, unknown>>) || [];
      const members = [
        ...existingMembers,
        ...studentIds
          .filter((id) => !existingMembers.some((member) => member.userId === id))
          .map((id) => {
            const candidate = candidates.find((entry) => entry.id === id);
            return {
              groupId,
              userId: id,
              name: candidate?.name || "Demo student",
              username: candidate?.username || null,
              role: candidate?.role || "user",
              email: candidate?.email || "student.demo@placeprep.app",
              targetRole: candidate?.targetRole || null,
              readinessScore: candidate?.readinessScore || 70,
              accessTier: candidate?.accessTier || "standard",
              addedBy: "demo-admin",
              addedByName: "Demo Admin",
              createdAt: new Date().toISOString(),
            };
          }),
      ];
      return { ...group, members, memberCount: members.length, assignmentRecipientCount: members.filter((member) => member.role === "user").length, updatedAt: new Date().toISOString() };
    });
    const updated = nextGroups.find((group) => group.id === groupId) || null;
    updateState((current) => ({ ...current, coachGroups: nextGroups }));
    return updated as T;
  }

  const groupMemberDeleteMatch = pathname.match(/^\/coach\/groups\/([^/]+)\/members\/([^/]+)$/);
  if (groupMemberDeleteMatch && method === "DELETE") {
    const [, groupId, studentUserId] = groupMemberDeleteMatch;
    const nextGroups = ((state.coachGroups as Array<Record<string, unknown>>) || []).map((group) => {
      if (group.id !== groupId) {
        return group;
      }
      const members = ((group.members as Array<Record<string, unknown>>) || []).filter((member) => member.userId !== studentUserId);
      return { ...group, members, memberCount: members.length, assignmentRecipientCount: members.filter((member) => member.role === "user").length, updatedAt: new Date().toISOString() };
    });
    const updated = nextGroups.find((group) => group.id === groupId) || null;
    updateState((current) => ({ ...current, coachGroups: nextGroups }));
    return updated as T;
  }

  if (pathname === "/coach/practice-capsules" && method === "POST") {
    const students = ((state.coachStudents as Array<Record<string, unknown>>) || []);
    const groups = ((state.coachGroups as Array<Record<string, unknown>>) || []);
    const targetStudentIds = typeof body.studentUserId === "string"
      ? [body.studentUserId]
      : typeof body.groupId === "string"
        ? (((groups.find((group) => group.id === body.groupId)?.members as Array<Record<string, unknown>>) || [])
          .filter((member) => member.role === "user")
          .map((member) => String(member.userId)))
        : [];
    const items = Array.isArray(body.items) && body.items.length ? body.items : [{ title: "Demo admin practice", category: "Core" }];
    const capsules = targetStudentIds.map((studentId) => ({
      bundleId: createId("capsule"),
      title: String(body.title || "Demo admin bundle"),
      note: typeof body.note === "string" ? body.note : null,
      studentUserId: studentId,
      assignedById: "demo-admin",
      assignedByName: "Demo Admin",
      assignmentId: createId("assignment"),
      dueAt: typeof body.deadlineAt === "string" ? body.deadlineAt : addDaysIso(1),
      scheduledFor: typeof body.scheduledFor === "string" ? body.scheduledFor : new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      items: items.map((item: Record<string, unknown>, index: number) => ({
        taskId: createId("capsule-task"),
        title: String(item.title || `Demo assignment ${index + 1}`),
        description: typeof item.description === "string" ? item.description : null,
        category: typeof item.category === "string" ? item.category : "Core",
        status: "pending",
        referenceLabel: typeof item.referenceLabel === "string" ? item.referenceLabel : String(item.title || "Demo assignment"),
        referenceUrl: typeof item.referenceUrl === "string" ? item.referenceUrl : null,
        capsuleType: "admin-assignment",
        dueAt: typeof body.deadlineAt === "string" ? body.deadlineAt : addDaysIso(1),
        scheduledFor: typeof body.scheduledFor === "string" ? body.scheduledFor : new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      })),
    }));
    const nextStudents = students.map((entry) => targetStudentIds.includes(String((entry.student as Record<string, unknown>)?.id))
      ? { ...entry, practiceCapsules: [...capsules.filter((capsule) => capsule.studentUserId === (entry.student as Record<string, unknown>)?.id), ...((entry.practiceCapsules as unknown[]) || [])] }
      : entry);
    updateState((current) => ({ ...current, coachStudents: nextStudents }));
    return {
      dispatchId: createId("dispatch"),
      targetKind: typeof body.groupId === "string" ? "group" : "student",
      targetId: String(body.groupId || body.studentUserId || ""),
      targetLabel: typeof body.groupId === "string" ? "Demo group" : "Demo student",
      recipientsCount: targetStudentIds.length,
      notificationsCreated: targetStudentIds.length,
      capsules,
    } as T;
  }

  if (pathname === "/tasks" && method === "POST") {
    const task = {
      id: createId("task"),
      userId: "demo-user",
      title: String(body.title || "Demo task"),
      description: typeof body.description === "string" ? body.description : null,
      category: typeof body.category === "string" ? body.category : "DSA",
      subcategory: typeof body.subcategory === "string" ? body.subcategory : null,
      status: body.status || "pending",
      priority: "medium",
      intensity: "medium",
      referenceLabel: typeof body.referenceLabel === "string" ? body.referenceLabel : "Demo reference",
      referenceUrl: typeof body.referenceUrl === "string" ? body.referenceUrl : null,
      dueDate: null,
      dueAt: null,
      scheduledFor: new Date().toISOString().slice(0, 10),
      estimatedMinutes: Number(body.estimatedMinutes || 30),
      actualMinutes: 0,
      difficulty: Number(body.difficulty || 3),
      weakArea: typeof body.weakArea === "string" ? body.weakArea : null,
      aiGenerated: false,
      metadata: { source: "demo-mode" },
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return updateState((current) => refreshState({ ...current, tasks: [task, ...(current.tasks as unknown[])] })).tasks[0] as T;
  }

  if (/^\/tasks\/[^/]+$/.test(pathname) && method === "PATCH") {
    const taskId = pathname.split("/").pop();
    return updateState((current) => refreshState({
      ...current,
      tasks: (current.tasks as Array<Record<string, unknown>>).map((task) => task.id === taskId ? { ...task, ...(body as Record<string, unknown>), completedAt: body.status === "completed" ? new Date().toISOString() : task.completedAt, updatedAt: new Date().toISOString() } : task),
    })).tasks.find((task: Record<string, unknown>) => task.id === taskId) as T;
  }

  if (/^\/tasks\/[^/]+$/.test(pathname) && method === "DELETE") {
    const taskId = pathname.split("/").pop();
    const deleted = state.tasks.find((task: Record<string, unknown>) => task.id === taskId) || null;
    updateState((current) => refreshState({ ...current, tasks: (current.tasks as Array<Record<string, unknown>>).filter((task) => task.id !== taskId) }));
    return deleted as T;
  }

  if (pathname === "/ai/prep-architect" && method === "POST") {
    const nextPlan = buildPlan({
      knownTopics: cleanTopics((body.knownTopics as string[]) || state.user.strongTopics),
      targetTopics: cleanTopics((body.targetTopics as string[]) || state.user.weakAreas),
      targetRole: typeof body.targetRole === "string" ? body.targetRole : state.user.targetRole,
      timePerDay: Number(body.timePerDay || 180),
      durationMonths: Number(body.durationMonths || 1),
      preferredLanguage: typeof body.preferredLanguage === "string" ? body.preferredLanguage : "english",
    }, state.prepPlans.length + 1);
    const tasks = buildTasksFromPlan(nextPlan);
    return updateState((current) => refreshState({ ...current, prepPlans: [nextPlan, ...(current.prepPlans as Array<Record<string, unknown>>).map((plan) => ({ ...plan, isActive: false }))], tasks })).prepPlans[0] as T;
  }

  if (pathname === "/ai/prep-architect/update" && method === "POST") {
    const sourcePlan = state.prepPlans.find((plan: Record<string, unknown>) => plan.id === body.planId) || state.prepPlans[0];
    const nextPlan = buildPlan({
      knownTopics: cleanTopics((body.knownTopics as string[]) || sourcePlan.knownTopics),
      targetTopics: cleanTopics((body.targetTopics as string[]) || sourcePlan.targetTopics),
      targetRole: typeof body.targetRole === "string" ? body.targetRole : sourcePlan.targetRole,
      timePerDay: Number(body.timePerDay || sourcePlan.timePerDay || 180),
      durationMonths: Number(body.durationMonths || sourcePlan.durationMonths || 1),
      preferredLanguage: typeof body.preferredLanguage === "string" ? body.preferredLanguage : sourcePlan.preferredLanguage,
    }, state.prepPlans.length + 1, String(sourcePlan.id));
    return updateState((current) => refreshState({ ...current, prepPlans: [nextPlan, ...(current.prepPlans as Array<Record<string, unknown>>).map((plan) => ({ ...plan, isActive: false }))], tasks: buildTasksFromPlan(nextPlan) })).prepPlans[0] as T;
  }

  if (pathname === "/ai/prep-architect/activate" && method === "POST") {
    const planId = String(body.planId || "");
    return updateState((current) => {
      const plans = (current.prepPlans as Array<Record<string, unknown>>).map((plan) => ({ ...plan, isActive: plan.id === planId }));
      const activePlan = plans.find((plan) => plan.id === planId) || plans[0];
      return refreshState({ ...current, prepPlans: plans, tasks: buildTasksFromPlan(activePlan as ReturnType<typeof buildPlan>) });
    }).prepPlans.find((plan: Record<string, unknown>) => plan.id === planId) as T;
  }

  if (pathname === "/ai/prep-architect/rename" && method === "POST") {
    const planId = String(body.planId || "");
    const title = String(body.title || "").trim();
    return updateState((current) => refreshState({
      ...current,
      prepPlans: (current.prepPlans as Array<Record<string, unknown>>).map((plan) => plan.id === planId ? { ...plan, title, autoTitle: title, titleSource: "custom", metadata: { ...(plan.metadata as Record<string, unknown>), title, autoTitle: title, titleSource: "custom" }, updatedAt: new Date().toISOString() } : plan),
    })).prepPlans.find((plan: Record<string, unknown>) => plan.id === planId) as T;
  }

  if (pathname === "/ai/chat" && method === "POST") {
    const userMessage = { id: createId("mentor"), userId: "demo-user", role: "user", content: String(body.message || ""), metadata: { source: "demo-mode" }, createdAt: new Date().toISOString() };
    const assistantMessage = { id: createId("mentor"), userId: "demo-user", role: "assistant", content: buildMentorReply(String(body.message || "")), metadata: { source: "demo-mode" }, createdAt: new Date().toISOString() };
    const next = updateState((current) => ({ ...current, mentorHistory: [...(current.mentorHistory as unknown[]), userMessage, assistantMessage] }));
    return { reply: assistantMessage.content, usedFallback: true, message: assistantMessage, history: next.mentorHistory } as T;
  }

  if (pathname === "/ai/help" && method === "POST") return { hint: "Pick one pattern, say it aloud, then solve one concrete problem before looking at notes again.", approachSteps: ["Name the constraint.", "Choose the pattern.", "Test one edge case immediately."], similarProblems: ["Revisit one easier problem first.", "Then solve one timed medium problem."], youtubeSearchKeywords: ["freeCodeCamp interview prep", "Bro Code interview prep"], profile: refreshState(state).progressSummary.coachProfile, profileLinks: state.profile, usedFallback: true } as T;
  if (pathname === "/ai/evaluate" && method === "POST") return { productivityScore: 82, weakAreas: ["Revision depth", "Explaining tradeoffs", "Timed medium problems"], tomorrowImprovements: ["Do one timed problem before reading any solution.", "Speak one OS concept aloud before revising DBMS.", "Close the day with one flashcard loop instead of passive scrolling."], verdict: "Steady day. Good execution, but you still need more pressure-tested recall.", profile: refreshState(state).progressSummary.coachProfile, profileLinks: state.profile, usedFallback: true } as T;
  if (pathname === "/ai/generate-tasks" && method === "POST") return { motivationLine: state.prepPlans[0]?.coachLine || "Clear the next weakness before the day ends.", tasks: state.tasks, profile: refreshState(state).progressSummary.coachProfile, profileLinks: state.profile, totalEstimatedMinutes: state.tasks.reduce((sum: number, task: Record<string, unknown>) => sum + Number(task.estimatedMinutes || 0), 0), persisted: false, replacedCount: 0, usedFallback: true } as T;
  if (pathname === "/ai/quick-task" && method === "POST") return { task: { title: "Tight 30-minute OS recall block", category: "Core", estimatedMinutes: Number(body.availableMinutes || 30), difficulty: "Medium", referenceLabel: "freeCodeCamp: Operating Systems interview revision", referenceUrl: buildYouTubeSearchUrl("freeCodeCamp operating systems interview"), reason: "High-value recall before the day drifts." }, suggestionLine: "Use this window to clear one core-systems concept before context-switching again.", profile: refreshState(state).progressSummary.coachProfile, profileLinks: state.profile, usedFallback: true } as T;

  if (pathname === "/assessments/generate" && method === "POST") {
    const activePlan = getActivePlanFromState(state) as ReturnType<typeof buildPlan> | null;
    if (!activePlan) {
      throw new Error("Create a Prep Architect plan first, then start an assessment.");
    }

    const nextSession = buildAssessmentSession(
      activePlan,
      (body.assessmentType as "mcq" | "fill_blank" | "coding") || "mcq",
      clamp(Number(body.durationMinutes || 20), 10, 90),
      body.assessmentScope === "weekly" ? "weekly" : "daily",
    );

    const nextState = updateState((current) => ({
      ...current,
      assessmentSessions: [nextSession, ...((current.assessmentSessions as Array<Record<string, unknown>>) || [])],
    }));

    return {
      activePlan: {
        id: activePlan.id,
        title: activePlan.title,
        targetRole: activePlan.targetRole,
        targetTopics: activePlan.targetTopics,
        knownTopics: activePlan.knownTopics,
        timePerDay: activePlan.timePerDay,
        durationMonths: activePlan.durationMonths,
        version: activePlan.version,
        isActive: activePlan.isActive,
      },
      session: nextState.assessmentSessions[0],
    } as T;
  }

  if (/^\/assessments\/[^/]+\/submit$/.test(pathname) && method === "POST") {
    const assessmentId = pathname.split("/")[2];
    const answers = body.answers && typeof body.answers === "object" ? body.answers as Record<string, string> : {};
    return updateState((current) => {
      const plan = getActivePlanFromState(current) as ReturnType<typeof buildPlan> | null;
      const assessmentSessions = ((current.assessmentSessions as Array<Record<string, unknown>>) || []).map((session) => {
        if (session.id !== assessmentId) {
          return session;
        }

        const results = ((session.questions as Array<Record<string, unknown>>) || []).map((question) => {
          const score = scoreDemoAssessmentQuestion(question, String(answers[String(question.id)] || ""));
          return {
            questionId: question.id,
            topic: question.topic,
            score,
            correct: score >= 0.75,
            feedback: score >= 0.75
              ? "Solid recall. Keep the explanation pressure-tested."
              : `Revisit ${question.topic} once more before assuming the idea is locked in.`,
          };
        });
        const averageScore = results.length
          ? (results.reduce((sum, item) => sum + Number(item.score || 0), 0) / results.length) * 100
          : 0;
        const weakSpots = cleanTopics(results.filter((item) => Number(item.score || 0) < 0.75).map((item) => String(item.topic || "")), 5);
        return {
          ...session,
          status: "completed",
          weakSpots,
          recommendations: plan ? buildDemoAssessmentRecommendations(plan, weakSpots) : [],
          score: Number(averageScore.toFixed(2)),
          submission: {
            answers,
            questionResults: results,
            submittedAt: new Date().toISOString(),
          },
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      return {
        ...current,
        assessmentSessions,
      };
    }).assessmentSessions.find((session: Record<string, unknown>) => session.id === assessmentId) as T;
  }

  if (/^\/assessments\/[^/]+\/apply-plan-update$/.test(pathname) && method === "POST") {
    const assessmentId = pathname.split("/")[2];
    const nextState = updateState((current) => {
      const targetSession = ((current.assessmentSessions as Array<Record<string, unknown>>) || []).find((session) => session.id === assessmentId) || null;
      const activePlan = getActivePlanFromState(current) as ReturnType<typeof buildPlan> | null;
      if (!targetSession || !activePlan) {
        return current;
      }

      const nextTargetTopics = cleanTopics([
        ...((targetSession.weakSpots as string[]) || []),
        ...(activePlan.targetTopics || []),
      ], 8);
      const nextPlan = buildPlan({
        knownTopics: activePlan.knownTopics,
        targetTopics: nextTargetTopics,
        targetRole: activePlan.targetRole,
        timePerDay: activePlan.timePerDay,
        durationMonths: activePlan.durationMonths,
      }, Number((current.prepPlans as Array<Record<string, unknown>>).length || 0) + 1, String(activePlan.id));

      const updatedSessions = ((current.assessmentSessions as Array<Record<string, unknown>>) || []).map((session) =>
        session.id === assessmentId
          ? {
              ...session,
              metadata: {
                ...((session.metadata as Record<string, unknown>) || {}),
                appliedPlanId: nextPlan.id,
                appliedPlanVersion: nextPlan.version,
                appliedPlanUpdateAt: new Date().toISOString(),
              },
            }
          : session
      );

      return refreshState({
        ...current,
        prepPlans: [nextPlan, ...(current.prepPlans as Array<Record<string, unknown>>).map((plan) => ({ ...plan, isActive: false }))],
        tasks: buildTasksFromPlan(nextPlan),
        assessmentSessions: updatedSessions,
      });
    });

    const updatedPlan = getActivePlanFromState(nextState);
    const session = ((nextState.assessmentSessions as Array<Record<string, unknown>>) || []).find((entry) => entry.id === assessmentId) || null;

    return {
      session,
      updatedPlan,
    } as T;
  }

  if (pathname === "/power-pocket/start" && method === "POST") {
    return updateState((current) => ({ ...current, powerPocketSession: { id: createId("pocket"), userId: "demo-user", taskId: typeof body.taskId === "string" ? body.taskId : null, title: typeof body.title === "string" ? body.title : "Focused sprint", notes: typeof body.notes === "string" ? body.notes : null, status: "active", source: body.source || "manual", startedAt: new Date().toISOString(), endedAt: null, durationMinutes: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } })).powerPocketSession as T;
  }

  if (/^\/power-pocket\/[^/]+\/end$/.test(pathname) && method === "POST") {
    const completedSession = state.powerPocketSession ? { ...state.powerPocketSession, status: "completed", endedAt: new Date().toISOString(), durationMinutes: 30, updatedAt: new Date().toISOString() } : null;
    updateState((current) => ({ ...current, powerPocketSession: null }));
    return completedSession as T;
  }

  if (pathname === "/notifications/sync" && method === "POST") {
    const nextNotification = { id: createId("notif"), userId: "demo-user", type: "motivation", message: "Demo mode generated a fresh signal: finish one concrete problem before switching tabs.", sentAt: new Date().toISOString(), read: false, readAt: null, deliveryChannels: ["in-app"], metadata: { route: "/dashboard" }, dedupeKey: createId("notif-dedupe"), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    updateState((current) => ({ ...current, notifications: [nextNotification, ...(current.notifications as unknown[])] }));
    return { created: [nextNotification], emailAttempted: false, emailSent: false, emailReason: "disabled in demo mode", emailError: "Email delivery is disabled in demo mode.", emailReady: false } as T;
  }
  if (pathname === "/notifications/read-all" && method === "POST") {
    const updated = state.notifications.filter((item: Record<string, unknown>) => !item.read).length;
    updateState((current) => ({
      ...current,
      notifications: (current.notifications as Array<Record<string, unknown>>).map((item) => ({
        ...item,
        read: true,
        readAt: new Date().toISOString(),
      })),
    }));
    return { updated } as T;
  }
  if (/^\/notifications\/[^/]+\/read$/.test(pathname) && method === "POST") {
    const notificationId = pathname.split("/")[2];
    return updateState((current) => ({
      ...current,
      notifications: (current.notifications as Array<Record<string, unknown>>).map((item) => item.id === notificationId
        ? { ...item, read: true, readAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : item),
    })).notifications.find((item: Record<string, unknown>) => item.id === notificationId) as T;
  }

  if (pathname === "/resume" && method === "POST") {
    const file = body.resume instanceof File ? body.resume : null;
    const secureUrl = file ? await readFileAsDataUrl(file) : createDemoTextDataUrl(String(body.resumeText || "Demo resume text"));
    const record = { id: createId("resume"), userId: "demo-user", fileName: file?.name || "demo-resume.txt", mimeType: file?.type || "text/plain", secureUrl, publicId: createId("resume-file"), storageProvider: "demo-local", sizeBytes: file?.size || String(body.resumeText || "").length, extractedText: String(body.resumeText || "Demo resume text"), analysisSummary: "Good baseline. Strengthen quantified outcomes and align the headline with the target role.", score: 79, strengths: ["Stack and projects are easy to scan.", "Resume already leans toward the requested role."], improvements: ["Add at least one metric to each project bullet.", "Move the most relevant backend keyword higher in the page."], keywords: ["Node.js", "SQL", "REST", "Operating Systems"], sections: { summary: true, education: true, experience: true, projects: true, skills: true, achievements: false }, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    return updateState((current) => ({ ...current, resumeHistory: [record, ...(current.resumeHistory as Array<Record<string, unknown>>).map((entry) => ({ ...entry, isActive: false }))] })).resumeHistory[0] as T;
  }

  if (pathname === "/uploads/images" && method === "POST") {
    const file = body.image instanceof File ? body.image : null;
    const taskId = typeof body.taskId === "string" ? body.taskId : null;
    const proof = { id: createId("proof"), userId: "demo-user", taskId, secureUrl: file ? await readFileAsDataUrl(file) : createDemoSvgDataUrl("Demo Upload"), publicId: createId("proof-file"), mimeType: file?.type || "image/svg+xml", proofDate: typeof body.proofDate === "string" ? body.proofDate : new Date().toISOString().slice(0, 10), caption: typeof body.caption === "string" ? body.caption : "Demo proof upload", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const nextState = updateState((current) => {
      const nextTasks = (current.tasks as Array<Record<string, unknown>>).map((task) => (
        task.id === taskId
          ? { ...task, status: "completed", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), metadata: { ...(task.metadata as Record<string, unknown>), autoVerification: { verified: true, provider: "proof", method: "demo-proof-upload", reason: "Demo proof matched the linked task." } } }
          : task
      ));
      return refreshState({ ...current, uploads: [proof, ...(current.uploads as unknown[])], tasks: nextTasks });
    });
    return {
      ...(nextState.uploads[0] as Record<string, unknown>),
      verification: taskId
        ? { attempted: true, verified: true, method: "demo-proof-upload", reason: "Demo proof matched the linked task.", taskId, taskStatus: "completed" }
        : undefined,
    } as T;
  }

  if (pathname === "/apk" && method === "POST") {
    const file = body.apk instanceof File ? body.apk : null;
    const record = { id: createId("apk"), version: String(body.version || `demo-${state.apkVersions.length + 1}`), fileName: file?.name || "placeprep-demo.apk", fileUrl: createDemoTextDataUrl("Demo APK placeholder"), publicId: createId("apk-file"), mimeType: file?.type || "application/vnd.android.package-archive", bytes: file?.size || 0, storageProvider: "demo-local", uploadedBy: "demo-user", isActive: true, metadata: { source: "demo-mode" }, uploadedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), downloadPath: "/demo-apk" };
    return updateState((current) => ({ ...current, apkVersions: [record, ...(current.apkVersions as Array<Record<string, unknown>>).map((item) => ({ ...item, isActive: false }))] })).apkVersions[0] as T;
  }

  if (pathname === "/progress/history" && method === "DELETE") {
    const entryIds = Array.isArray(body.entryIds) ? body.entryIds.map((entry) => String(entry)) : [];
    const deleted = entryIds.length
      ? state.progressHistory.filter((entry: Record<string, unknown>) => entryIds.includes(String(entry.id))).length
      : state.progressHistory.length;
    updateState((current) => ({
      ...current,
      progressHistory: entryIds.length
        ? (current.progressHistory as Array<Record<string, unknown>>).filter((entry) => !entryIds.includes(String(entry.id)))
        : [],
    }));
    return { deleted, clearedAt: new Date().toISOString() } as T;
  }
  if (pathname === "/notifications/history" && method === "DELETE") {
    const deleted = state.notifications.length;
    updateState((current) => ({ ...current, notifications: [] }));
    return { deleted, clearedAt: new Date().toISOString() } as T;
  }
  if (pathname === "/resume/history" && method === "DELETE") {
    const deleted = state.resumeHistory.length;
    updateState((current) => ({ ...current, resumeHistory: [] }));
    return { deleted, clearedAt: new Date().toISOString() } as T;
  }
  if (pathname === "/uploads/images/history" && method === "DELETE") {
    const deleted = state.uploads.length;
    updateState((current) => ({ ...current, uploads: [] }));
    return { deleted, clearedAt: new Date().toISOString() } as T;
  }
  if (pathname === "/ai/chat/history" && method === "DELETE") {
    const deleted = state.mentorHistory.length;
    updateState((current) => ({ ...current, mentorHistory: [] }));
    return { deleted, clearedAt: new Date().toISOString() } as T;
  }
  if (pathname === "/ai/prep-architect/history" && method === "DELETE") {
    const planIds = Array.isArray(body.planIds) ? body.planIds.map((item) => String(item)) : [];
    const deleted = planIds.length ? state.prepPlans.filter((plan: Record<string, unknown>) => planIds.includes(String(plan.id))).length : state.prepPlans.length;
    updateState((current) => {
      const remainingPlans = planIds.length
        ? (current.prepPlans as Array<Record<string, unknown>>).filter((plan) => !planIds.includes(String(plan.id)))
        : [];
      const nextPlans = remainingPlans.map((plan, index) => ({ ...plan, isActive: index === 0 }));
      return refreshState({
        ...current,
        prepPlans: nextPlans,
        tasks: nextPlans.length ? buildTasksFromPlan(nextPlans[0] as ReturnType<typeof buildPlan>) : [],
      });
    });
    return { deleted, clearedAt: new Date().toISOString() } as T;
  }

  if (/^\/coach\/students\/[^/]+\/proofs$/.test(pathname) && method === "DELETE") {
    return { deleted: 1, clearedAt: new Date().toISOString() } as T;
  }
  if (pathname === "/coach/progress/history" && method === "DELETE") {
    return { deleted: 3, clearedAt: new Date().toISOString(), affectedUsers: 1, scope: body.scope || "selected" } as T;
  }
  if (pathname === "/coach/practice-capsules/history" && method === "DELETE") {
    const requestedIds = Array.isArray(body.assignmentIds) ? body.assignmentIds.length : 0;
    return { deleted: requestedIds || 1, clearedAt: new Date().toISOString(), affectedUsers: 1, scope: body.groupId ? "group" : "student" } as T;
  }

  if (pathname.endsWith("/history") && method === "DELETE") return { deleted: 0, clearedAt: new Date().toISOString() } as T;
  throw new Error(`Demo mode has no handler for ${method} ${pathname}.`);
}
