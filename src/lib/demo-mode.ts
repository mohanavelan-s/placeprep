import type { AuthResult } from "@/lib/api";

const DEMO_MODE_STORAGE_KEY = "placeprep.demo-mode";
const DEMO_STATE_STORAGE_KEY = "placeprep.demo-state";
export const DEMO_SESSION_TOKEN = "demo-session-token";
const DEMO_DELAY_MS = 180;

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

function getTopicRecipe(topic: string) {
  return topicBank.find((entry) => entry.pattern.test(topic)) || {
    article: [`GeeksforGeeks: ${topic}`, `https://www.geeksforgeeks.org/search/${encodeURIComponent(topic)}/`],
    newsletter: ["TLDR: practical engineering updates", "https://tldr.tech/"],
    videos: [
      [`freeCodeCamp: ${topic}`, buildYouTubeSearchUrl(`freeCodeCamp ${topic}`)],
      [`Bro Code: ${topic}`, buildYouTubeSearchUrl(`Bro Code ${topic}`)],
    ],
    problems: [[`LeetCode: ${topic} practice`, "Medium", `https://leetcode.com/problemset/?search=${encodeURIComponent(topic)}`]],
  };
}

function buildStudyStack(topic: string) {
  const recipe = getTopicRecipe(topic);
  return {
    topic,
    items: [
      { title: recipe.videos[0][0], type: "youtube", url: recipe.videos[0][1] },
      { title: recipe.videos[1][0], type: "youtube", url: recipe.videos[1][1] },
      { title: recipe.article[0], type: "article", url: recipe.article[1] },
      { title: recipe.newsletter[0], type: "newsletter", url: recipe.newsletter[1] },
    ],
  };
}

function buildTaskItems(topic: string, revisionTopic: string) {
  const recipe = getTopicRecipe(topic);
  const revisionRecipe = getTopicRecipe(revisionTopic);
  const [firstProblem, secondProblem = firstProblem] = recipe.problems;

  return [
    {
      title: `${firstProblem[0].startsWith("LeetCode") ? "LeetCode" : firstProblem[0].startsWith("HackerRank") ? "HackerRank" : "CodeChef"} warm-up`,
      type: "DSA",
      estimatedMinutes: 35,
      difficulty: firstProblem[1],
      referenceLabel: firstProblem[0],
      referenceUrl: firstProblem[2],
    },
    {
      title: `${secondProblem[0].startsWith("LeetCode") ? "LeetCode" : secondProblem[0].startsWith("HackerRank") ? "HackerRank" : "CodeChef"} checkpoint`,
      type: "DSA",
      estimatedMinutes: 45,
      difficulty: secondProblem[1],
      referenceLabel: secondProblem[0],
      referenceUrl: secondProblem[2],
    },
    {
      title: `Revision block: ${revisionTopic}`,
      type: "Revision",
      estimatedMinutes: 25,
      difficulty: "Medium",
      referenceLabel: revisionRecipe.article[0],
      referenceUrl: revisionRecipe.article[1],
    },
    {
      title: `Structured execution: apply ${topic}`,
      type: "Project",
      estimatedMinutes: 35,
      difficulty: "Medium",
      referenceLabel: recipe.videos[0][0],
      referenceUrl: recipe.videos[0][1],
    },
  ];
}

function buildPlan(input: { knownTopics: string[]; targetTopics: string[]; targetRole?: string; timePerDay?: number }, version = 1, sourcePlanId: string | null = null) {
  const knownTopics = cleanTopics(input.knownTopics, 8);
  const targetTopics = cleanTopics(input.targetTopics, 8);
  const orderedTopics = cleanTopics([
    ...targetTopics,
    String(input.targetRole || "").toLowerCase().includes("backend") ? "Operating Systems" : "",
    String(input.targetRole || "").toLowerCase().includes("backend") ? "DBMS" : "",
    String(input.targetRole || "").toLowerCase().includes("backend") ? "System Design" : "",
    "Dynamic Programming",
  ], 5);
  const primary = orderedTopics[0] || "Operating Systems";
  const secondary = orderedTopics[1] || "DBMS";
  const targetRole = input.targetRole || "Backend Engineer Intern";
  const now = new Date().toISOString();

  const roadmap = orderedTopics.slice(0, 4).map((topic, index) => ({
    week: index + 1,
    title: index === 0 ? "Foundation reset" : index === 3 ? "Interview simulation week" : "Focused build week",
    focusTopics: cleanTopics([topic, orderedTopics[index + 1] || secondary], 2),
    estimatedHours: clamp(Math.round(((input.timePerDay || 180) * 6) / 60), 6, 24),
    goals: [
      `Make ${topic} interview-ready with one creator resource and one deep article.`,
      `Solve at least two concrete problems tied to ${topic}.`,
      `Translate ${topic} into spoken interview language for ${targetRole}.`,
    ],
  }));

  const tasks = Array.from({ length: 5 }, (_, index) => {
    const topic = orderedTopics[index % orderedTopics.length] || primary;
    const revisionTopic = orderedTopics[(index + 1) % orderedTopics.length] || secondary;
    const items = buildTaskItems(topic, revisionTopic);
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
    resources: orderedTopics.slice(0, 4).map(buildStudyStack),
    flashcards: [
      { topic: primary, question: `What is the clean mental model for ${primary}?`, answer: `Define ${primary} in one sentence, name one tradeoff, then tie it to a real interview use-case.` },
      { topic: secondary, question: `How do you explain ${secondary} without sounding memorized?`, answer: `Use one concrete example, one common mistake, and one performance tradeoff.` },
      { topic: "System Design", question: "What should anchor the first two minutes of a design answer?", answer: "Clarify traffic, read-write ratio, reliability expectations, and the likely bottleneck." },
      { topic: "Dynamic Programming", question: "What makes a DP state strong?", answer: "A precise subproblem, a clean transition, and a base case you can trust." },
    ],
    timePerDay: input.timePerDay || 180,
    targetRole,
    version,
    isActive: true,
    sourcePlanId,
    metadata: {
      title: `${targetRole}: ${primary} + ${secondary}`,
      autoTitle: `${targetRole}: ${primary} + ${secondary}`,
      titleSource: "generated",
      coachLine: `Push ${primary} until it becomes automatic, then let ${secondary} carry the next layer of confidence.`,
      usedFallback: true,
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
    description: `${plan.tasks[0].day}: ${plan.tasks[0].theme}`,
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
    metadata: { source: "demo-mode", planId: plan.id, itemIndex: index },
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

function buildInitialState() {
  const activePlan = buildPlan({
    knownTopics: ["Arrays", "Strings"],
    targetTopics: ["Operating Systems", "DBMS", "System Design"],
    targetRole: "Backend Engineer Intern",
    timePerDay: 180,
  }, 3);
  const previousPlan = { ...buildPlan({
    knownTopics: ["Arrays", "Strings"],
    targetTopics: ["Dynamic Programming", "Graphs", "Operating Systems"],
    targetRole: "Backend Engineer Intern",
    timePerDay: 150,
  }, 2, activePlan.id), isActive: false, title: "Backend Interview Sprint: DP + Graphs", autoTitle: "Backend Interview Sprint: DP + Graphs" };
  previousPlan.metadata = { ...previousPlan.metadata, title: previousPlan.title, autoTitle: previousPlan.autoTitle };
  const tasks = buildTasksFromPlan(activePlan);
  const progressSummary = buildProgressSummary(tasks, activePlan);
  const now = new Date().toISOString();

  return {
    user: {
      id: "demo-user",
      name: "Demo Operator",
      username: "demo",
      role: "user",
      accessTier: "standard",
      email: "demo@placeprep.app",
      weakAreas: activePlan.targetTopics,
      strongTopics: activePlan.knownTopics,
      targetRole: activePlan.targetRole,
      placementDate: "2026-05-30",
      timezone: "Asia/Calcutta",
      solvedProblems: 148,
      averageTimePerProblem: 32,
      failedAttempts: 19,
      mistakeCount: 23,
      consistencyScore: progressSummary.consistencyScore,
      currentStreak: progressSummary.streak,
      readinessScore: progressSummary.readinessScore,
      coachMetadata: { prepArchitectPlanId: activePlan.id, prepArchitectPlanTitle: activePlan.title },
      createdAt: now,
      updatedAt: now,
    },
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
  const resolved = state || buildInitialState();
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
  const activePlan = ((state.prepPlans as Array<Record<string, unknown>>) || []).find((plan) => plan.isActive) || null;
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

export function activateDemoMode(): AuthResult {
  window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, "true");
  const state = readState();
  return { token: DEMO_SESSION_TOKEN, user: state.user as AuthResult["user"] };
}

export function clearDemoMode() {
  window.localStorage.removeItem(DEMO_MODE_STORAGE_KEY);
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
  if (pathname === "/notifications" && method === "GET") {
    const unreadOnly = url.searchParams.get("unread") === "true";
    const limit = Number(url.searchParams.get("limit") || state.notifications.length);
    return state.notifications.filter((item: Record<string, unknown>) => (unreadOnly ? !item.read : true)).slice(0, limit) as T;
  }
  if (pathname === "/resume/latest" && method === "GET") return (state.resumeHistory[0] || null) as T;
  if (pathname === "/resume" && method === "GET") return state.resumeHistory as T;
  if (pathname === "/uploads/images" && method === "GET") return state.uploads as T;
  if (pathname === "/apk/latest" && method === "GET") return (state.apkVersions[0] || null) as T;
  if (pathname === "/apk/versions" && method === "GET") return state.apkVersions as T;
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
    const nextPlan = buildPlan({ knownTopics: cleanTopics((body.knownTopics as string[]) || state.user.strongTopics), targetTopics: cleanTopics((body.targetTopics as string[]) || state.user.weakAreas), targetRole: typeof body.targetRole === "string" ? body.targetRole : state.user.targetRole, timePerDay: Number(body.timePerDay || 180) }, state.prepPlans.length + 1);
    const tasks = buildTasksFromPlan(nextPlan);
    return updateState((current) => refreshState({ ...current, prepPlans: [nextPlan, ...(current.prepPlans as Array<Record<string, unknown>>).map((plan) => ({ ...plan, isActive: false }))], tasks })).prepPlans[0] as T;
  }

  if (pathname === "/ai/prep-architect/update" && method === "POST") {
    const sourcePlan = state.prepPlans.find((plan: Record<string, unknown>) => plan.id === body.planId) || state.prepPlans[0];
    const nextPlan = buildPlan({ knownTopics: cleanTopics((body.knownTopics as string[]) || sourcePlan.knownTopics), targetTopics: cleanTopics((body.targetTopics as string[]) || sourcePlan.targetTopics), targetRole: typeof body.targetRole === "string" ? body.targetRole : sourcePlan.targetRole, timePerDay: Number(body.timePerDay || sourcePlan.timePerDay || 180) }, state.prepPlans.length + 1, String(sourcePlan.id));
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
    return { created: [nextNotification], emailAttempted: false, emailSent: false, emailReason: "disabled in demo mode", emailReady: false } as T;
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
    const proof = { id: createId("proof"), userId: "demo-user", secureUrl: file ? await readFileAsDataUrl(file) : createDemoSvgDataUrl("Demo Upload"), publicId: createId("proof-file"), mimeType: file?.type || "image/svg+xml", proofDate: typeof body.proofDate === "string" ? body.proofDate : new Date().toISOString().slice(0, 10), caption: typeof body.caption === "string" ? body.caption : "Demo proof upload", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    return updateState((current) => ({ ...current, uploads: [proof, ...(current.uploads as unknown[])] })).uploads[0] as T;
  }

  if (pathname === "/apk" && method === "POST") {
    const file = body.apk instanceof File ? body.apk : null;
    const record = { id: createId("apk"), version: String(body.version || `demo-${state.apkVersions.length + 1}`), fileName: file?.name || "placeprep-demo.apk", fileUrl: createDemoTextDataUrl("Demo APK placeholder"), publicId: createId("apk-file"), mimeType: file?.type || "application/vnd.android.package-archive", bytes: file?.size || 0, storageProvider: "demo-local", uploadedBy: "demo-user", isActive: true, metadata: { source: "demo-mode" }, uploadedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), downloadPath: "/demo-apk" };
    return updateState((current) => ({ ...current, apkVersions: [record, ...(current.apkVersions as Array<Record<string, unknown>>).map((item) => ({ ...item, isActive: false }))] })).apkVersions[0] as T;
  }

  if (pathname === "/progress/history" && method === "DELETE") {
    const deleted = state.progressHistory.length;
    updateState((current) => ({ ...current, progressHistory: [] }));
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

  if (pathname.endsWith("/history") && method === "DELETE") return { deleted: 0, clearedAt: new Date().toISOString() } as T;
  throw new Error(`Demo mode has no handler for ${method} ${pathname}.`);
}
