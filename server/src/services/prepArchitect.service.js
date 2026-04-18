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

const TOPIC_REFERENCE_BANK = [
  {
    pattern: /array/i,
    article: { title: 'GeeksforGeeks: Top 50 Array Interview Problems', url: 'https://www.geeksforgeeks.org/top-50-array-coding-problems-for-interviews/' },
    newsletter: { title: 'TLDR: practical engineering updates', url: 'https://tldr.tech/' },
    videos: [
      { title: 'freeCodeCamp: Arrays and interview patterns', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+arrays+interview+patterns' },
      { title: 'Bro Code: Arrays walkthrough', url: 'https://www.youtube.com/results?search_query=Bro+Code+arrays+tutorial' },
    ],
    problems: [
      { label: 'LeetCode: Two Sum', difficulty: 'Easy', url: 'https://leetcode.com/problems/two-sum/' },
      { label: 'HackerRank: Arrays - DS', difficulty: 'Easy', url: 'https://www.hackerrank.com/challenges/arrays-ds/problem' },
      { label: 'CodeChef: TSORT', difficulty: 'Medium', url: 'https://www.codechef.com/problems/TSORT' },
    ],
  },
  {
    pattern: /string/i,
    article: { title: 'GeeksforGeeks: Top 50 String Interview Questions', url: 'https://www.geeksforgeeks.org/top-50-string-coding-problems-for-interviews/' },
    newsletter: { title: 'Bytes.dev: concise frontend and language patterns', url: 'https://bytes.dev/' },
    videos: [
      { title: 'CodeWithMosh: String interview practice', url: 'https://www.youtube.com/results?search_query=CodeWithMosh+string+interview+questions' },
      { title: 'freeCodeCamp: String algorithms and pattern drills', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+string+algorithms+interview' },
    ],
    problems: [
      { label: 'LeetCode: Longest Substring Without Repeating Characters', difficulty: 'Medium', url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/' },
      { label: 'HackerRank: Strings - Making Anagrams', difficulty: 'Easy', url: 'https://www.hackerrank.com/challenges/ctci-making-anagrams/problem' },
      { label: 'CodeChef: FLOW006', difficulty: 'Easy', url: 'https://www.codechef.com/problems/FLOW006' },
    ],
  },
  {
    pattern: /linked list/i,
    article: { title: 'GeeksforGeeks: Linked List Data Structure', url: 'https://www.geeksforgeeks.org/data-structures/linked-list/' },
    newsletter: { title: 'The Pragmatic Engineer: system thinking for implementation work', url: 'https://www.pragmaticengineer.com/' },
    videos: [
      { title: 'Bro Code: Linked list fundamentals', url: 'https://www.youtube.com/results?search_query=Bro+Code+linked+list+tutorial' },
      { title: 'freeCodeCamp: Linked list interview questions', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+linked+list+interview+questions' },
    ],
    problems: [
      { label: 'LeetCode: Reverse Linked List', difficulty: 'Easy', url: 'https://leetcode.com/problems/reverse-linked-list/' },
      { label: 'HackerRank: Insert a Node at a Specific Position in a Linked List', difficulty: 'Easy', url: 'https://www.hackerrank.com/challenges/insert-a-node-at-a-specific-position-in-a-linked-list/problem' },
      { label: 'CodeChef: MARCHA1', difficulty: 'Medium', url: 'https://www.codechef.com/problems/MARCHA1' },
    ],
  },
  {
    pattern: /stack/i,
    article: { title: 'GeeksforGeeks: Stack Data Structure', url: 'https://www.geeksforgeeks.org/stack-data-structure/' },
    newsletter: { title: 'TLDR: practical coding + systems briefs', url: 'https://tldr.tech/' },
    videos: [
      { title: 'Bro Code: Stack tutorial', url: 'https://www.youtube.com/results?search_query=Bro+Code+stack+data+structure' },
      { title: 'freeCodeCamp: Stack interview prep', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+stack+interview+prep' },
    ],
    problems: [
      { label: 'LeetCode: Valid Parentheses', difficulty: 'Easy', url: 'https://leetcode.com/problems/valid-parentheses/' },
      { label: 'HackerRank: Balanced Brackets', difficulty: 'Medium', url: 'https://www.hackerrank.com/challenges/balanced-brackets/problem' },
      { label: 'CodeChef: ZCO14003', difficulty: 'Medium', url: 'https://www.codechef.com/problems/ZCO14003' },
    ],
  },
  {
    pattern: /queue/i,
    article: { title: 'GeeksforGeeks: Queue Data Structure', url: 'https://www.geeksforgeeks.org/queue-data-structure/' },
    newsletter: { title: 'TLDR: practical coding + systems briefs', url: 'https://tldr.tech/' },
    videos: [
      { title: 'Bro Code: Queue tutorial', url: 'https://www.youtube.com/results?search_query=Bro+Code+queue+data+structure' },
      { title: 'freeCodeCamp: Queue interview prep', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+queue+interview+questions' },
    ],
    problems: [
      { label: 'LeetCode: Implement Queue using Stacks', difficulty: 'Easy', url: 'https://leetcode.com/problems/implement-queue-using-stacks/' },
      { label: 'HackerRank: Queue using Two Stacks', difficulty: 'Medium', url: 'https://www.hackerrank.com/challenges/queue-using-two-stacks/problem' },
      { label: 'CodeChef: INTEST', difficulty: 'Easy', url: 'https://www.codechef.com/problems/INTEST' },
    ],
  },
  {
    pattern: /tree|bst/i,
    article: { title: 'GeeksforGeeks: Binary Tree Data Structure', url: 'https://www.geeksforgeeks.org/binary-tree-data-structure/' },
    newsletter: { title: 'ByteByteGo: structured systems intuition', url: 'https://bytebytego.com/' },
    videos: [
      { title: 'freeCodeCamp: Binary tree interview patterns', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+binary+tree+interview' },
      { title: 'Bro Code: Binary tree basics', url: 'https://www.youtube.com/results?search_query=Bro+Code+binary+tree+tutorial' },
    ],
    problems: [
      { label: 'LeetCode: Binary Tree Level Order Traversal', difficulty: 'Medium', url: 'https://leetcode.com/problems/binary-tree-level-order-traversal/' },
      { label: 'HackerRank: Tree - Height of a Binary Tree', difficulty: 'Easy', url: 'https://www.hackerrank.com/challenges/tree-height-of-a-binary-tree/problem' },
      { label: 'CodeChef: COINS', difficulty: 'Medium', url: 'https://www.codechef.com/problems/COINS' },
    ],
  },
  {
    pattern: /graph/i,
    article: { title: 'GeeksforGeeks: Graph Data Structure and Algorithms', url: 'https://www.geeksforgeeks.org/graph-data-structure-and-algorithms/' },
    newsletter: { title: 'ByteByteGo: systems patterns and graph intuition', url: 'https://bytebytego.com/' },
    videos: [
      { title: 'freeCodeCamp: Graph algorithms for interviews', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+graph+algorithms+interview' },
      { title: 'CodeWithMosh: Graphs and traversal intuition', url: 'https://www.youtube.com/results?search_query=CodeWithMosh+graph+algorithms' },
    ],
    problems: [
      { label: 'LeetCode: Number of Islands', difficulty: 'Medium', url: 'https://leetcode.com/problems/number-of-islands/' },
      { label: 'HackerRank: BFS - Shortest Reach in a Graph', difficulty: 'Medium', url: 'https://www.hackerrank.com/challenges/bfsshortreach/problem' },
      { label: 'CodeChef: COINS', difficulty: 'Medium', url: 'https://www.codechef.com/problems/COINS' },
    ],
  },
  {
    pattern: /dynamic programming|dp/i,
    article: { title: 'GeeksforGeeks: Dynamic Programming', url: 'https://www.geeksforgeeks.org/dynamic-programming/' },
    newsletter: { title: 'ByteByteGo: methodical systems and pattern thinking', url: 'https://bytebytego.com/' },
    videos: [
      { title: 'freeCodeCamp: Dynamic programming interview prep', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+dynamic+programming+interview' },
      { title: 'CodeWithMosh: Dynamic programming intuition', url: 'https://www.youtube.com/results?search_query=CodeWithMosh+dynamic+programming' },
    ],
    problems: [
      { label: 'LeetCode: House Robber', difficulty: 'Medium', url: 'https://leetcode.com/problems/house-robber/' },
      { label: 'HackerRank: Max Array Sum', difficulty: 'Medium', url: 'https://www.hackerrank.com/challenges/max-array-sum/problem' },
      { label: 'CodeChef: COINS', difficulty: 'Medium', url: 'https://www.codechef.com/problems/COINS' },
    ],
  },
  {
    pattern: /greedy/i,
    article: { title: 'GeeksforGeeks: Greedy Algorithms', url: 'https://www.geeksforgeeks.org/greedy-algorithms/' },
    newsletter: { title: 'TLDR: sharp daily tech summaries', url: 'https://tldr.tech/' },
    videos: [
      { title: 'freeCodeCamp: Greedy algorithms interview prep', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+greedy+algorithms+interview' },
      { title: 'Bro Code: Greedy problem solving', url: 'https://www.youtube.com/results?search_query=Bro+Code+greedy+algorithms' },
    ],
    problems: [
      { label: 'LeetCode: Best Time to Buy and Sell Stock', difficulty: 'Easy', url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/' },
      { label: 'HackerRank: Greedy Florist', difficulty: 'Medium', url: 'https://www.hackerrank.com/challenges/greedy-florist/problem' },
      { label: 'CodeChef: ZCO14003', difficulty: 'Medium', url: 'https://www.codechef.com/problems/ZCO14003' },
    ],
  },
  {
    pattern: /recursion|backtracking/i,
    article: { title: 'GeeksforGeeks: Recursion', url: 'https://www.geeksforgeeks.org/recursion/' },
    newsletter: { title: 'TLDR: sharp daily tech summaries', url: 'https://tldr.tech/' },
    videos: [
      { title: 'freeCodeCamp: Recursion and backtracking for interviews', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+recursion+backtracking+interview' },
      { title: 'Bro Code: Recursion tutorial', url: 'https://www.youtube.com/results?search_query=Bro+Code+recursion+tutorial' },
    ],
    problems: [
      { label: 'LeetCode: Subsets', difficulty: 'Medium', url: 'https://leetcode.com/problems/subsets/' },
      { label: 'HackerRank: Recursive Digit Sum', difficulty: 'Easy', url: 'https://www.hackerrank.com/challenges/recursive-digit-sum/problem' },
      { label: 'CodeChef: MARCHA1', difficulty: 'Medium', url: 'https://www.codechef.com/problems/MARCHA1' },
    ],
  },
  {
    pattern: /system design/i,
    article: { title: 'GeeksforGeeks: System Design Tutorial', url: 'https://www.geeksforgeeks.org/system-design-tutorial/' },
    newsletter: { title: 'ByteByteGo: system design breakdowns', url: 'https://bytebytego.com/' },
    videos: [
      { title: 'freeCodeCamp: System design interview prep', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+system+design+interview' },
      { title: 'CodeWithMosh: System design basics', url: 'https://www.youtube.com/results?search_query=CodeWithMosh+system+design+tutorial' },
    ],
    problems: [
      { label: 'LeetCode: Design Twitter', difficulty: 'Medium', url: 'https://leetcode.com/problems/design-twitter/' },
      { label: 'HackerRank: Simple Text Editor', difficulty: 'Medium', url: 'https://www.hackerrank.com/challenges/simple-text-editor/problem' },
      { label: 'CodeChef: ZCO14003', difficulty: 'Medium', url: 'https://www.codechef.com/problems/ZCO14003' },
    ],
  },
  {
    pattern: /dbms|database/i,
    article: { title: 'GeeksforGeeks: DBMS', url: 'https://www.geeksforgeeks.org/dbms/' },
    newsletter: { title: 'DB Weekly: database internals and tooling', url: 'https://dbweekly.com/' },
    videos: [
      { title: 'freeCodeCamp: DBMS and SQL revision', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+DBMS+SQL+interview' },
      { title: 'CodeWithMosh: SQL and relational database intuition', url: 'https://www.youtube.com/results?search_query=CodeWithMosh+SQL+database+tutorial' },
    ],
    problems: [
      { label: 'LeetCode: Combine Two Tables', difficulty: 'Easy', url: 'https://leetcode.com/problems/combine-two-tables/' },
      { label: 'HackerRank: Revising the Select Query I', difficulty: 'Easy', url: 'https://www.hackerrank.com/challenges/revising-the-select-query/problem' },
      { label: 'CodeChef: INTEST', difficulty: 'Easy', url: 'https://www.codechef.com/problems/INTEST' },
    ],
  },
  {
    pattern: /operating systems|os/i,
    article: { title: 'GeeksforGeeks: Operating Systems', url: 'https://www.geeksforgeeks.org/operating-systems/' },
    newsletter: { title: 'Linux Weekly News: operating systems and kernel thinking', url: 'https://lwn.net/' },
    videos: [
      { title: 'freeCodeCamp: Operating Systems full revision', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+operating+systems+interview' },
      { title: 'Bro Code: Operating systems walkthrough', url: 'https://www.youtube.com/results?search_query=Bro+Code+operating+systems+tutorial' },
    ],
    problems: [
      { label: 'LeetCode: LRU Cache', difficulty: 'Medium', url: 'https://leetcode.com/problems/lru-cache/' },
      { label: 'HackerRank: Queue using Two Stacks', difficulty: 'Medium', url: 'https://www.hackerrank.com/challenges/queue-using-two-stacks/problem' },
      { label: 'CodeChef: INTEST', difficulty: 'Easy', url: 'https://www.codechef.com/problems/INTEST' },
    ],
  },
];

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

function normalizePlanTitle(title, fallback = '') {
  const normalized = String(title || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, 80).trim();
}

function splitThemeTopics(theme) {
  return String(theme || '')
    .split(/\s+into\s+/i)
    .map((part) => normalizePlanTitle(part))
    .filter(Boolean);
}

function buildAutoPlanTitle({ targetRole, targetTopics = [], roadmap = [], tasks = [] }) {
  const role = normalizePlanTitle(targetRole);
  const roadmapTopics = Array.isArray(roadmap)
    ? roadmap.flatMap((week) => cleanTopics(week?.focusTopics || [], 3))
    : [];
  const dayThemes = Array.isArray(tasks)
    ? tasks.flatMap((day) => splitThemeTopics(day?.theme))
    : [];
  const focusTopics = cleanTopics([
    ...targetTopics,
    ...roadmapTopics,
    ...dayThemes,
  ], 3);
  const primaryFocus = focusTopics[0] || '';
  const secondaryFocus = focusTopics.find((topic) => topic.toLowerCase() !== primaryFocus.toLowerCase()) || '';

  if (role && primaryFocus && secondaryFocus) {
    return normalizePlanTitle(`${role}: ${primaryFocus} + ${secondaryFocus}`, 'Placement Prep Plan');
  }

  if (role && primaryFocus) {
    return normalizePlanTitle(`${role}: ${primaryFocus}`, 'Placement Prep Plan');
  }

  if (primaryFocus && secondaryFocus) {
    return normalizePlanTitle(`${primaryFocus} + ${secondaryFocus} Focus Plan`, 'Placement Prep Plan');
  }

  if (primaryFocus) {
    return normalizePlanTitle(`${primaryFocus} Focus Plan`, 'Placement Prep Plan');
  }

  if (role) {
    return normalizePlanTitle(`${role} Prep Plan`, 'Placement Prep Plan');
  }

  return 'Placement Prep Plan';
}

function resolvePlanTitles(plan, preferredTitle = '', titleSource = 'generated') {
  const autoTitle = buildAutoPlanTitle(plan);
  const customTitle = normalizePlanTitle(preferredTitle);

  if (customTitle) {
    return {
      title: customTitle,
      autoTitle,
      titleSource,
    };
  }

  return {
    title: autoTitle,
    autoTitle,
    titleSource: 'generated',
  };
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

function getTopicReferenceProfile(topic) {
  const normalized = String(topic || '').toLowerCase();
  const match = TOPIC_REFERENCE_BANK.find((item) => item.pattern.test(normalized));

  if (match) {
    return match;
  }

  return {
    article: {
      title: `GeeksforGeeks: ${topic || 'Interview preparation'}`,
      url: `https://www.geeksforgeeks.org/search/${encodeURIComponent(topic || 'interview preparation')}/`,
    },
    newsletter: {
      title: 'TLDR: practical engineering updates',
      url: 'https://tldr.tech/',
    },
    videos: [
      {
        title: `freeCodeCamp: ${topic || 'interview preparation'}`,
        url: buildSearchUrl(`freeCodeCamp ${topic || 'interview preparation'}`),
      },
      {
        title: `Bro Code: ${topic || 'interview preparation'}`,
        url: buildSearchUrl(`Bro Code ${topic || 'interview preparation'}`),
      },
    ],
    problems: [
      {
        label: `LeetCode: ${topic || 'practice'} practice`,
        difficulty: 'Medium',
        url: `https://leetcode.com/problemset/?search=${encodeURIComponent(topic || 'interview')}`,
      },
    ],
  };
}

function buildArticleUrl(topic) {
  return getTopicReferenceProfile(topic).article.url;
}

function buildProblemSet(topic) {
  return getTopicReferenceProfile(topic).problems;
}

function buildCuratedResourceItems(topic) {
  const profile = getTopicReferenceProfile(topic);
  return [
    {
      title: profile.videos[0].title,
      type: 'youtube',
      url: profile.videos[0].url,
    },
    {
      title: profile.article.title,
      type: 'article',
      url: profile.article.url,
    },
    {
      title: profile.newsletter.title,
      type: 'newsletter',
      url: profile.newsletter.url,
    },
    {
      title: profile.videos[1].title,
      type: 'youtube',
      url: profile.videos[1].url,
    },
  ].filter((item) => item.url);
}

function buildProjectReference(targetRole) {
  const role = String(targetRole || '').toLowerCase();

  if (/backend/.test(role)) {
    return {
      label: 'roadmap.sh backend projects',
      url: 'https://roadmap.sh/backend/projects',
    };
  }

  if (/frontend/.test(role)) {
    return {
      label: 'roadmap.sh frontend projects',
      url: 'https://roadmap.sh/frontend/projects',
    };
  }

  if (/full.?stack/.test(role)) {
    return {
      label: 'roadmap.sh full stack projects',
      url: 'https://roadmap.sh/full-stack',
    };
  }

  return {
    label: 'roadmap.sh computer science projects',
    url: 'https://roadmap.sh/computer-science',
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
  const projectReference = buildProjectReference(targetRole);
  const days = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'];
  const totalMinutes = clamp(timePerDay || 120, 60, 480);
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
    const primaryProblem = buildProblemSet(primaryTopic)[0];
    const secondaryProblem = buildProblemSet(secondaryTopic)[1] || buildProblemSet(secondaryTopic)[0];

    return {
      day,
      theme: `${primaryTopic} into ${revisionTopic}`,
      totalEstimatedMinutes: chunks.reduce((sum, minutes) => sum + minutes, 0),
      items: [
        {
          title: `${primaryTopic} platform warm-up`,
          type: 'DSA',
          estimatedMinutes: chunks[0],
          difficulty: primaryProblem.difficulty,
          referenceLabel: primaryProblem.label,
          referenceUrl: primaryProblem.url,
        },
        {
          title: `${secondaryTopic} medium checkpoint`,
          type: 'DSA',
          estimatedMinutes: chunks[1],
          difficulty: secondaryProblem.difficulty,
          referenceLabel: secondaryProblem.label,
          referenceUrl: secondaryProblem.url,
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
          referenceLabel: projectReference.label,
          referenceUrl: projectReference.url,
        },
      ],
    };
  });
}

function buildResources(prioritizedTopics, targetRole) {
  const topics = cleanTopics([...prioritizedTopics, ...getRoleBiasTopics(targetRole)], 5);

  return topics.map((topic) => ({
    topic,
    items: buildCuratedResourceItems(topic),
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
  const titles = resolvePlanTitles({
    targetRole,
    targetTopics,
    roadmap,
    tasks,
  });

  return {
    id: planId,
    knownTopics,
    targetTopics,
    timePerDay,
    targetRole,
    title: titles.title,
    autoTitle: titles.autoTitle,
    titleSource: titles.titleSource,
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
        480
      ),
      items: Array.isArray(dayPlan.items) && dayPlan.items.length
        ? dayPlan.items.slice(0, 4).map((item, itemIndex) => ({
          title: String(item.title || fallbackPlan.tasks[index]?.items[itemIndex]?.title || 'Focused task').trim(),
          type: String(item.type || fallbackPlan.tasks[index]?.items[itemIndex]?.type || 'DSA').trim(),
          estimatedMinutes: clamp(item.estimatedMinutes || fallbackPlan.tasks[index]?.items[itemIndex]?.estimatedMinutes || 30, 10, 240),
          difficulty: String(item.difficulty || fallbackPlan.tasks[index]?.items[itemIndex]?.difficulty || 'Medium').trim(),
          referenceLabel: String(
            fallbackPlan.tasks[index]?.items[itemIndex]?.referenceLabel
            || item.referenceLabel
            || 'Reference'
          ).trim(),
          referenceUrl: fallbackPlan.tasks[index]?.items[itemIndex]?.referenceUrl || item.referenceUrl || null,
        }))
        : fallbackPlan.tasks[index]?.items || [],
    }))
    : fallbackPlan.tasks;

  const resources = fallbackPlan.resources;

  const flashcards = Array.isArray(rawPlan.flashcards) && rawPlan.flashcards.length
    ? rawPlan.flashcards.slice(0, 10).map((card, index) => ({
      topic: String(card.topic || fallbackPlan.flashcards[index]?.topic || 'Prep').trim(),
      question: String(card.question || fallbackPlan.flashcards[index]?.question || 'Question').trim(),
      answer: String(card.answer || fallbackPlan.flashcards[index]?.answer || 'Answer').trim(),
    }))
    : fallbackPlan.flashcards;
  const titles = resolvePlanTitles({
    targetRole: fallbackPlan.targetRole,
    targetTopics: fallbackPlan.targetTopics,
    roadmap,
    tasks,
  }, rawPlan.title, 'generated');

  return {
    title: titles.title,
    autoTitle: titles.autoTitle,
    titleSource: titles.titleSource,
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

  const titles = resolvePlanTitles({
    targetRole: plan.targetRole,
    targetTopics: plan.targetTopics,
    roadmap: plan.roadmap,
    tasks: plan.tasks,
  }, typeof plan.metadata?.title === 'string' ? plan.metadata.title : '', plan.metadata?.titleSource === 'custom' ? 'custom' : 'generated');

  return {
    ...plan,
    title: titles.title,
    autoTitle: titles.autoTitle,
    titleSource: titles.titleSource,
    coachLine: typeof plan.metadata?.coachLine === 'string' ? plan.metadata.coachLine : null,
    usedFallback: Boolean(plan.metadata?.usedFallback),
  };
}

function buildPriorPlanTaskLookup(previousTasks = []) {
  const byIndex = new Map();
  const byTitle = new Map();

  previousTasks.forEach((task) => {
    const rawIndex = task?.metadata?.itemIndex;
    const itemIndex = Number.isInteger(Number(rawIndex)) ? Number(rawIndex) : null;
    if (itemIndex !== null && !byIndex.has(itemIndex)) {
      byIndex.set(itemIndex, task);
    }

    const normalizedTitle = String(task?.title || '').trim().toLowerCase();
    if (normalizedTitle && !byTitle.has(normalizedTitle)) {
      byTitle.set(normalizedTitle, task);
    }
  });

  return { byIndex, byTitle };
}

function planTasksForSync(plan, planId, previousTasks = []) {
  const firstDay = plan.tasks[0];
  if (!firstDay?.items?.length) {
    return [];
  }

  const lookup = buildPriorPlanTaskLookup(previousTasks);

  return firstDay.items.slice(0, 4).map((item, index) => {
    const matchedTask = lookup.byIndex.get(index)
      || lookup.byTitle.get(String(item.title || '').trim().toLowerCase())
      || null;

    return {
      title: item.title,
      description: `${firstDay.day}: ${firstDay.theme}`,
      category: item.type === 'Project' ? 'Project' : item.type === 'Revision' ? 'Core' : 'DSA',
      subcategory: firstDay.theme,
      status: matchedTask?.status || 'pending',
      priority: index <= 1 ? 'high' : 'medium',
      intensity: item.type === 'Project' ? 'high' : 'medium',
      referenceLabel: item.referenceLabel || null,
      referenceUrl: item.referenceUrl || null,
      estimatedMinutes: clamp(item.estimatedMinutes, 10, 240),
      actualMinutes: Number(matchedTask?.actualMinutes || 0),
      difficulty: /easy/i.test(item.difficulty) ? 2 : /hard/i.test(item.difficulty) ? 4 : 3,
      weakArea: firstDay.theme,
      aiGenerated: true,
      metadata: {
        source: 'prep-architect',
        planId,
        day: firstDay.day,
        theme: firstDay.theme,
        itemIndex: index,
      },
      completedAt: matchedTask?.completedAt || null,
    };
  });
}

async function syncTodayTasks(user, plan) {
  const scheduledFor = getTodayInTimezone(user.timezone);
  const existingTasks = await taskRepository.listPrepArchitectTasksByPlanAndDate(
    user.id,
    plan.id,
    scheduledFor,
  );

  if (existingTasks.length) {
    return existingTasks;
  }

  const previousTasks = await taskRepository.listRecentPrepArchitectTasksByPlan(user.id, plan.id);
  const tasksToCreate = planTasksForSync(plan, plan.id, previousTasks);

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

async function syncUserWithActivePlan(user, plan = null) {
  const currentUser = await userRepository.findById(user.id);
  const nextCoachMetadata = { ...(currentUser?.coachMetadata || {}) };

  if (plan) {
    nextCoachMetadata.prepArchitectUpdatedAt = new Date().toISOString();
    nextCoachMetadata.prepArchitectPlanId = plan.id;
    nextCoachMetadata.prepArchitectPlanTitle = plan.title || plan.metadata?.title || null;
    nextCoachMetadata.prepArchitectCoachLine = plan.coachLine || plan.metadata?.coachLine || null;
  } else {
    delete nextCoachMetadata.prepArchitectUpdatedAt;
    delete nextCoachMetadata.prepArchitectPlanId;
    delete nextCoachMetadata.prepArchitectPlanTitle;
    delete nextCoachMetadata.prepArchitectCoachLine;
  }

  const updates = {
    coachMetadata: nextCoachMetadata,
  };

  if (plan) {
    updates.strongTopics = cleanTopics(plan.knownTopics, 8);
    updates.weakAreas = cleanTopics(plan.targetTopics, 8);
    updates.targetRole = plan.targetRole || currentUser?.targetRole || user.targetRole || null;
  }

  await userRepository.updateUser(user.id, updates);
}

async function persistPlan(user, plan, sourcePlanId = null) {
  const titles = resolvePlanTitles(plan, plan.title, plan.titleSource || 'generated');
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
        title: titles.title,
        autoTitle: titles.autoTitle,
        titleSource: titles.titleSource,
        coachLine: plan.coachLine,
        usedFallback: plan.usedFallback,
      },
    }, client);
  });

  const finalPlan = {
    ...persistedPlan,
    title: titles.title,
    autoTitle: titles.autoTitle,
    titleSource: titles.titleSource,
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

  await syncUserWithActivePlan(user, finalPlan);
  await syncTodayTasks(user, finalPlan);
  await progressService.refreshProgressStats(user.id, user.timezone);

  return finalPlan;
}

function buildPlanRequestPayload(user, payload = {}, currentPlan = null) {
  const knownTopics = cleanTopics(payload.knownTopics || currentPlan?.knownTopics || user.strongTopics, 8);
  const targetTopics = cleanTopics(payload.targetTopics || currentPlan?.targetTopics || user.weakAreas, 8);
  const timePerDay = clamp(payload.timePerDay || currentPlan?.timePerDay || 120, 60, 480);
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
    'Act as a placement preparation coach. Return only JSON with title, roadmap, tasks, resources, flashcards, and coachLine.',
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
      '   * 2 DSA problems (with direct links and specific problem names from LeetCode, HackerRank, or CodeChef)',
      '   * 1 revision topic',
      '   * 1 project task with a direct resource link',
      '3. Resources:',
      '   * Creator-specific YouTube resources (freeCodeCamp, Bro Code, CodeWithMosh when relevant)',
      '   * Direct article links such as GeeksforGeeks',
      '   * One relevant newsletter or reading stream',
      '4. Flashcards:',
      '   * 5-10 Q&A cards',
      '',
      'Rules:',
      '* Focus on weak areas',
      '* Keep it realistic',
      '* No fluff',
      '* Avoid broad generic search links when a direct problem or targeted creator search is possible',
      '',
      'Return JSON in this exact shape:',
      '{',
      '  "title": "string",',
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
    'Act as a placement preparation coach. Return only JSON with title, roadmap, tasks, resources, flashcards, and coachLine.',
    [
      'Act as a placement preparation coach.',
      '',
      `Current plan id: ${currentPlan.id}`,
      `User knows: ${input.knownTopics.join(', ') || 'Starting fresh'}`,
      `User wants to learn: ${input.targetTopics.join(', ') || 'Need role-guided focus'}`,
      `Time per day: ${input.timePerDay} minutes`,
      `Target role: ${input.targetRole}`,
      '',
      'Regenerate the title, roadmap, tasks, resources, and flashcards while keeping the plan realistic and editable.',
      'Use direct, specific practice problems instead of broad problem-set searches whenever possible.',
      'Prefer creator-specific YouTube resources and direct articles/newsletters over generic searches.',
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

async function activatePlan(user, planId) {
  const targetPlan = await prepPlanRepository.findById(planId, user.id);

  if (!targetPlan) {
    throw new AppError('Prep plan not found.', 404);
  }

  if (!targetPlan.isActive) {
    await withTransaction(async (client) => {
      await prepPlanRepository.deactivateActivePlans(user.id, client);
      await prepPlanRepository.activatePlan(user.id, targetPlan.id, client);
    });
  }

  const activePlan = hydrateStoredPlan({
    ...targetPlan,
    isActive: true,
  });

  await syncUserWithActivePlan(user, activePlan);
  await syncTodayTasks(user, activePlan);
  await progressService.refreshProgressStats(user.id, user.timezone);

  return activePlan;
}

async function renamePlan(user, payload = {}) {
  const targetPlan = await prepPlanRepository.findById(payload.planId, user.id);

  if (!targetPlan) {
    throw new AppError('Prep plan not found.', 404);
  }

  const title = normalizePlanTitle(payload.title);
  if (title.length < 2) {
    throw new AppError('Enter a plan name with at least 2 characters.', 400);
  }

  const hydratedPlan = hydrateStoredPlan(targetPlan);
  const titles = resolvePlanTitles(hydratedPlan, title, 'custom');
  const updatedPlan = await prepPlanRepository.updateMetadata(targetPlan.id, user.id, {
    ...(targetPlan.metadata || {}),
    title: titles.title,
    autoTitle: titles.autoTitle,
    titleSource: titles.titleSource,
    renamedAt: new Date().toISOString(),
  });

  const renamedPlan = hydrateStoredPlan(updatedPlan);

  if (renamedPlan?.isActive) {
    await syncUserWithActivePlan(user, renamedPlan);
  }

  return renamedPlan;
}

async function clearPlanHistory(user, planIds = null) {
  const normalizedPlanIds = Array.isArray(planIds)
    ? Array.from(new Set(planIds.map((planId) => String(planId || '').trim()).filter(Boolean)))
    : [];

  const { deletedPlans, nextActivePlan, deletedActivePlan } = await withTransaction(async (client) => {
    const plansToDelete = normalizedPlanIds.length
      ? await prepPlanRepository.deleteByIds(user.id, normalizedPlanIds, client)
      : await prepPlanRepository.deleteByUser(user.id, client);

    let promotedPlan = null;
    const removedActivePlan = plansToDelete.some((plan) => plan.isActive);

    if (removedActivePlan) {
      const remainingPlans = await prepPlanRepository.listByUser(user.id, 1, client);
      if (remainingPlans.length) {
        await prepPlanRepository.deactivateActivePlans(user.id, client);
        promotedPlan = await prepPlanRepository.activatePlan(user.id, remainingPlans[0].id, client);
      }
    }

    return {
      deletedPlans: plansToDelete,
      nextActivePlan: promotedPlan,
      deletedActivePlan: removedActivePlan,
    };
  });

  const deletedPlanIds = deletedPlans.map((plan) => plan.id);
  if (deletedPlanIds.length) {
    await taskRepository.deletePrepArchitectTasksByPlanIds(user.id, deletedPlanIds);
  }

  const hydratedActivePlan = hydrateStoredPlan(nextActivePlan);
  if (deletedActivePlan) {
    await syncUserWithActivePlan(user, hydratedActivePlan);

    if (hydratedActivePlan) {
      await syncTodayTasks(user, hydratedActivePlan);
    }
  }

  await progressService.refreshProgressStats(user.id, user.timezone);

  return {
    deleted: deletedPlans.length,
    clearedAt: new Date().toISOString(),
  };
}

module.exports = {
  TOPIC_DATASET,
  generatePlan,
  updatePlan,
  getLatestPlan,
  getPlanHistory,
  activatePlan,
  renamePlan,
  clearPlanHistory,
};
