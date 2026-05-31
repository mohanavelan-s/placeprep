const env = require('../config/env');
const assessmentRepository = require('../repositories/assessment.repository');
const codingSubmissionRepository = require('../repositories/codingSubmission.repository');
const prepPlanRepository = require('../repositories/prepPlan.repository');
const taskRepository = require('../repositories/task.repository');
const AppError = require('../utils/appError');
const judge0Service = require('./judge0.service');
const progressService = require('./progress.service');

const SQL_LANGUAGES = new Set(['mysql', 'postgresql']);
const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql/';
const LEETCODE_REFERER = 'https://leetcode.com/problemset/all/';
const LEETCODE_USER_AGENT = 'Mozilla/5.0 PlacePrep Coding Lab';
const DEFAULT_STARTER_CODE = {
  python: '# Write your solution here\n',
  c: '#include <stdio.h>\n\nint main(void) {\n  return 0;\n}\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  return 0;\n}\n',
  java: 'class Main {\n  public static void main(String[] args) {\n  }\n}\n',
  javascript: 'function solve() {\n  // Write your solution here\n}\n\nsolve();\n',
  typescript: 'function solve(): void {\n  // Write your solution here\n}\n\nsolve();\n',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello, PlacePrep")\n}\n',
  rust: 'fn main() {\n    println!("Hello, PlacePrep");\n}\n',
  csharp: 'using System;\n\nclass Program {\n  static void Main() {\n  }\n}\n',
  mysql: '-- Write your MySQL query here\n',
  postgresql: '-- Write your PostgreSQL query here\n',
};

const LEETCODE_CATALOG = {
  '1': {
    number: '1',
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. Each input has exactly one solution, and you may not use the same element twice.',
    examples: [
      'Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]',
      'Input: nums = [3,2,4], target = 6\nOutput: [1,2]',
    ],
    constraints: ['Array', 'Hash Table'],
    testCases: [
      { name: 'Basic complement', input: '[2,7,11,15]\n9', expectedOutput: '[0,1]' },
      { name: 'Middle pair', input: '[3,2,4]\n6', expectedOutput: '[1,2]' },
      { name: 'Duplicate value', input: '[3,3]\n6', expectedOutput: '[0,1]' },
    ],
  },
  '20': {
    number: '20',
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    description: 'Given a string s containing only parentheses and brackets, determine if the input string is valid. Open brackets must be closed by the same type of brackets and in the correct order.',
    examples: ['Input: s = "()[]{}"\nOutput: true', 'Input: s = "(]"\nOutput: false'],
    constraints: ['String', 'Stack'],
    testCases: [
      { name: 'All pairs', input: '()[]{}', expectedOutput: 'true' },
      { name: 'Wrong close', input: '(]', expectedOutput: 'false' },
      { name: 'Nested valid', input: '{[]}', expectedOutput: 'true' },
    ],
  },
  '21': {
    number: '21',
    slug: 'merge-two-sorted-lists',
    title: 'Merge Two Sorted Lists',
    difficulty: 'Easy',
    description: 'Merge the two sorted linked lists into one sorted list. Return the head of the merged linked list.',
    examples: ['Input: list1 = [1,2,4], list2 = [1,3,4]\nOutput: [1,1,2,3,4,4]'],
    constraints: ['Linked List', 'Recursion'],
    testCases: [
      { name: 'Interleaved', input: '[1,2,4]\n[1,3,4]', expectedOutput: '[1,1,2,3,4,4]' },
      { name: 'One empty', input: '[]\n[0]', expectedOutput: '[0]' },
    ],
  },
  '121': {
    number: '121',
    slug: 'best-time-to-buy-and-sell-stock',
    title: 'Best Time to Buy and Sell Stock',
    difficulty: 'Easy',
    description: 'Given prices where prices[i] is the price of a stock on day i, choose one day to buy and a future day to sell to maximize profit. Return the maximum profit, or 0 if no profit is possible.',
    examples: ['Input: prices = [7,1,5,3,6,4]\nOutput: 5', 'Input: prices = [7,6,4,3,1]\nOutput: 0'],
    constraints: ['Array', 'Dynamic Programming'],
    testCases: [
      { name: 'Profit exists', input: '[7,1,5,3,6,4]', expectedOutput: '5' },
      { name: 'Descending', input: '[7,6,4,3,1]', expectedOutput: '0' },
    ],
  },
  '125': {
    number: '125',
    slug: 'valid-palindrome',
    title: 'Valid Palindrome',
    difficulty: 'Easy',
    description: 'Given a string s, return true if it is a palindrome after converting uppercase letters to lowercase and removing all non-alphanumeric characters.',
    examples: ['Input: s = "A man, a plan, a canal: Panama"\nOutput: true', 'Input: s = "race a car"\nOutput: false'],
    constraints: ['Two Pointers', 'String'],
    testCases: [
      { name: 'Phrase', input: 'A man, a plan, a canal: Panama', expectedOutput: 'true' },
      { name: 'Not palindrome', input: 'race a car', expectedOutput: 'false' },
    ],
  },
  '136': {
    number: '136',
    slug: 'single-number',
    title: 'Single Number',
    difficulty: 'Easy',
    description: 'Given a non-empty array of integers nums, every element appears twice except for one. Find that single one with linear runtime complexity and constant extra space.',
    examples: ['Input: nums = [2,2,1]\nOutput: 1'],
    constraints: ['Array', 'Bit Manipulation'],
    testCases: [
      { name: 'Short', input: '[2,2,1]', expectedOutput: '1' },
      { name: 'Longer', input: '[4,1,2,1,2]', expectedOutput: '4' },
    ],
  },
  '152': {
    number: '152',
    slug: 'maximum-product-subarray',
    title: 'Maximum Product Subarray',
    difficulty: 'Medium',
    description: 'Given an integer array nums, find a non-empty subarray that has the largest product and return the product. Track both maximum and minimum running products because a negative number can flip them.',
    examples: ['Input: nums = [2,3,-2,4]\nOutput: 6', 'Input: nums = [-2,0,-1]\nOutput: 0'],
    constraints: ['Array', 'Dynamic Programming'],
    testCases: [
      { name: 'Positive then negative', input: '[2,3,-2,4]', expectedOutput: '6' },
      { name: 'Zero split', input: '[-2,0,-1]', expectedOutput: '0' },
      { name: 'Negative flip', input: '[-2,3,-4]', expectedOutput: '24' },
    ],
  },
  '169': {
    number: '169',
    slug: 'majority-element',
    title: 'Majority Element',
    difficulty: 'Easy',
    description: 'Given an array nums, return the majority element that appears more than floor(n / 2) times.',
    examples: ['Input: nums = [3,2,3]\nOutput: 3'],
    constraints: ['Array', 'Hash Table', 'Boyer-Moore Voting'],
    testCases: [
      { name: 'Three items', input: '[3,2,3]', expectedOutput: '3' },
      { name: 'Seven items', input: '[2,2,1,1,1,2,2]', expectedOutput: '2' },
    ],
  },
  '217': {
    number: '217',
    slug: 'contains-duplicate',
    title: 'Contains Duplicate',
    difficulty: 'Easy',
    description: 'Given an integer array nums, return true if any value appears at least twice, and false if every element is distinct.',
    examples: ['Input: nums = [1,2,3,1]\nOutput: true'],
    constraints: ['Array', 'Hash Table', 'Sorting'],
    testCases: [
      { name: 'Duplicate exists', input: '[1,2,3,1]', expectedOutput: 'true' },
      { name: 'All unique', input: '[1,2,3,4]', expectedOutput: 'false' },
    ],
  },
  '226': {
    number: '226',
    slug: 'invert-binary-tree',
    title: 'Invert Binary Tree',
    difficulty: 'Easy',
    description: 'Given the root of a binary tree, invert the tree and return its root.',
    examples: ['Input: root = [4,2,7,1,3,6,9]\nOutput: [4,7,2,9,6,3,1]'],
    constraints: ['Tree', 'DFS', 'BFS'],
    testCases: [
      { name: 'Full tree', input: '[4,2,7,1,3,6,9]', expectedOutput: '[4,7,2,9,6,3,1]' },
      { name: 'Empty', input: '[]', expectedOutput: '[]' },
    ],
  },
  '704': {
    number: '704',
    slug: 'binary-search',
    title: 'Binary Search',
    difficulty: 'Easy',
    description: 'Given a sorted array nums and an integer target, return the index if the target exists. Otherwise, return -1. The algorithm must run in O(log n) time.',
    examples: ['Input: nums = [-1,0,3,5,9,12], target = 9\nOutput: 4'],
    constraints: ['Array', 'Binary Search'],
    testCases: [
      { name: 'Found', input: '[-1,0,3,5,9,12]\n9', expectedOutput: '4' },
      { name: 'Missing', input: '[-1,0,3,5,9,12]\n2', expectedOutput: '-1' },
    ],
  },
};

const LEETCODE_CATALOG_BY_SLUG = Object.fromEntries(
  Object.values(LEETCODE_CATALOG).map((problem) => [problem.slug, problem]),
);

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value) {
  return normalizeText(value).replace(/\s+/g, '-').replace(/[+#]/g, '').slice(0, 80) || 'practice-problem';
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function isSqlLanguage(language) {
  return SQL_LANGUAGES.has(judge0Service.normalizeLanguageKey(language));
}

function stripHtml(value) {
  const decoded = String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<pre[^>]*>/gi, '\n')
    .replace(/<\/pre>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<tr[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<t[dh][^>]*>/gi, ' ')
    .replace(/<\/?(strong|b|em|i|code|span|sup|sub)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&le;/g, '<=')
    .replace(/&ge;/g, '>=')
    .replace(/&times;/g, 'x')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

  return decoded
    .split('\n')
    .map((line) => line
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+\|\s+/g, ' | ')
      .replace(/\|\s+\|/g, '| |')
      .trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/(Example\s+\d+:)/gi, '\n$1\n')
    .replace(/\b(Input:|Output:|Explanation:|Constraints:)\s*/gi, '\n$1 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripSecrets(value) {
  return String(value || '')
    .replace(/(sk-[a-zA-Z0-9_-]{16,})/g, '[redacted-secret]')
    .replace(/((?:api|access|auth|secret|token|password|passwd|pwd)[\w-]*\s*[:=]\s*)["']?[^"'\s]{8,}/gi, '$1[redacted-secret]')
    .slice(0, 12000);
}

function assertPayloadSize(sourceCode, stdin = '') {
  const sourceBytes = Buffer.byteLength(String(sourceCode || ''), 'utf8');
  const stdinBytes = Buffer.byteLength(String(stdin || ''), 'utf8');

  if (!sourceCode || !String(sourceCode).trim()) {
    throw new AppError('Source code is required before execution.', 400);
  }

  if (sourceBytes > env.judge0MaxSourceBytes) {
    throw new AppError(`Source code is too large. Keep it under ${env.judge0MaxSourceBytes} bytes.`, 413);
  }

  if (stdinBytes > env.judge0MaxStdinBytes) {
    throw new AppError(`Input is too large. Keep stdin under ${env.judge0MaxStdinBytes} bytes.`, 413);
  }
}

function extractLeetCodeSlug(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const urlMatch = text.match(/leetcode\.com\/problems\/([^/?#]+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1].trim();
  }

  if (/^[a-z0-9-]+$/i.test(text) && text.includes('-')) {
    return text.toLowerCase();
  }

  return '';
}

function extractLeetCodeNumber(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const prefixedMatch = text.match(/\b(?:leetcode|lc)\s*#?\s*(\d{1,5})\b/i);
  if (prefixedMatch?.[1]) {
    return prefixedMatch[1];
  }

  if (/^\d{1,5}$/.test(text)) {
    return text;
  }

  return '';
}

async function getLeetCodeSessionHeaders() {
  try {
    const response = await fetch(LEETCODE_REFERER, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': LEETCODE_USER_AGENT,
      },
    });
    const cookieHeader = response.headers.get('set-cookie') || '';
    const csrfToken = cookieHeader.match(/csrftoken=([^;]+)/)?.[1] || '';

    if (!csrfToken) {
      return {};
    }

    return {
      Cookie: `csrftoken=${csrfToken}`,
      'X-CSRFToken': csrfToken,
    };
  } catch {
    return {};
  }
}

async function requestLeetCodeGraphql(body) {
  const baseHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Referer: LEETCODE_REFERER,
    'User-Agent': LEETCODE_USER_AGENT,
  };
  let response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify(body),
  });

  if ([403, 419, 429, 499].includes(Number(response.status))) {
    const sessionHeaders = await getLeetCodeSessionHeaders();
    if (Object.keys(sessionHeaders).length) {
      response = await fetch(LEETCODE_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          ...baseHeaders,
          ...sessionHeaders,
        },
        body: JSON.stringify(body),
      });
    }
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.errors?.[0]?.message || `LeetCode responded with ${response.status}`);
  }

  return data;
}

function inferPlatform(value) {
  const text = String(value || '').trim();
  if (/leetcode\.com/i.test(text)) {
    return 'leetcode';
  }
  if (extractLeetCodeNumber(text)) {
    return 'leetcode';
  }
  if (/hackerrank\.com/i.test(text)) {
    return 'hackerrank';
  }
  if (/codechef\.com/i.test(text)) {
    return 'codechef';
  }
  return 'custom';
}

function normalizeProblemPayload(payload = {}) {
  const source = payload.url || payload.slug || payload.title || payload.problemTitle || payload.problemNumber || '';
  const problemNumber = String(payload.number || payload.problemNumber || extractLeetCodeNumber(source) || '').trim() || null;
  const platform = payload.platform || inferPlatform(source);
  const leetCodeSlug = extractLeetCodeSlug(payload.url || payload.slug || payload.title);
  const title = String(payload.title || payload.problemTitle || '').trim()
    || (leetCodeSlug ? leetCodeSlug.split('-').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ') : '')
    || (problemNumber ? `LeetCode ${problemNumber}` : '')
    || String(payload.url || payload.slug || 'Practice problem').trim();

  return {
    platform,
    number: problemNumber,
    slug: leetCodeSlug || String(payload.slug || '').trim() || (problemNumber ? `leetcode-${problemNumber}` : slugify(title)),
    title,
    url: String(payload.url || (leetCodeSlug ? `https://leetcode.com/problems/${leetCodeSlug}/` : '')).trim() || null,
    description: String(payload.description || '').trim(),
    difficulty: String(payload.difficulty || '').trim() || null,
    examples: toArray(payload.examples),
    constraints: toArray(payload.constraints),
    testCases: toArray(payload.testCases),
    starterCode: payload.starterCode && typeof payload.starterCode === 'object' ? payload.starterCode : {},
  };
}

function buildCatalogProblem(problem) {
  return {
    platform: 'leetcode',
    number: problem.number,
    slug: problem.slug,
    title: problem.title,
    url: `https://leetcode.com/problems/${problem.slug}/`,
    description: problem.description,
    difficulty: problem.difficulty,
    examples: problem.examples || [],
    constraints: problem.constraints || [],
    testCases: problem.testCases || [],
    starterCode: DEFAULT_STARTER_CODE,
    extractionStatus: 'catalog',
  };
}

function findCatalogProblem(problem = {}) {
  const number = String(problem.number || '').trim();
  const slug = String(problem.slug || extractLeetCodeSlug(problem.url || problem.title || '') || '').trim().toLowerCase();

  if (number && LEETCODE_CATALOG[number]) {
    return buildCatalogProblem(LEETCODE_CATALOG[number]);
  }

  if (slug && LEETCODE_CATALOG_BY_SLUG[slug]) {
    return buildCatalogProblem(LEETCODE_CATALOG_BY_SLUG[slug]);
  }

  return null;
}

async function fetchLeetCodeProblem(titleSlug) {
  const json = await requestLeetCodeGraphql({
      query: `
        query questionData($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            questionFrontendId
            title
            titleSlug
            content
            difficulty
            exampleTestcases
            topicTags { name }
            codeSnippets { langSlug code }
          }
        }
      `,
      variables: { titleSlug },
  });
  const question = json?.data?.question;
  if (!question) {
    throw new Error('Question was not found on LeetCode.');
  }

  return {
    platform: 'leetcode',
    number: question.questionFrontendId || null,
    slug: question.titleSlug || titleSlug,
    title: question.title || titleSlug,
    url: `https://leetcode.com/problems/${question.titleSlug || titleSlug}/`,
    description: stripHtml(question.content || ''),
    difficulty: question.difficulty || null,
    examples: String(question.exampleTestcases || '')
      .split(/\n{2,}/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 3),
    constraints: toArray(question.topicTags).map((tag) => tag?.name).filter(Boolean).slice(0, 8),
    testCases: findCatalogProblem({ number: question.questionFrontendId, slug: question.titleSlug })?.testCases || [],
    starterCode: buildStarterCodeFromSnippets(question.codeSnippets),
  };
}

function buildStarterCodeFromSnippets(snippets = []) {
  const starterCode = {};
  const languageMap = {
    python3: 'python',
    python: 'python',
    c: 'c',
    cpp: 'cpp',
    'c++': 'cpp',
    java: 'java',
    javascript: 'javascript',
    typescript: 'typescript',
    golang: 'go',
    go: 'go',
    rust: 'rust',
    csharp: 'csharp',
    'c#': 'csharp',
    mysql: 'mysql',
    postgresql: 'postgresql',
  };

  toArray(snippets).forEach((snippet) => {
    const key = languageMap[String(snippet?.langSlug || '').toLowerCase()];
    const code = String(snippet?.code || '').trim();
    if (key && code) {
      starterCode[key] = `${code}\n`;
    }
  });

  return starterCode;
}

async function fetchLeetCodeProblemByNumber(frontendId) {
  const json = await requestLeetCodeGraphql({
      query: `
        query problemsetQuestionList($categorySlug: String, $skip: Int, $limit: Int, $filters: QuestionListFilterInput) {
          problemsetQuestionList: questionList(categorySlug: $categorySlug, skip: $skip, limit: $limit, filters: $filters) {
            questions {
              frontendQuestionId
              title
              titleSlug
            }
          }
        }
      `,
      variables: {
        categorySlug: '',
        skip: 0,
        limit: 20,
        filters: { searchKeywords: String(frontendId) },
      },
  });
  const questions = toArray(json?.data?.problemsetQuestionList?.questions);
  const match = questions.find((question) => String(question?.frontendQuestionId) === String(frontendId))
    || questions.find((question) => String(question?.title || '').startsWith(`${frontendId}.`));

  if (!match?.titleSlug) {
    throw new Error('Question number was not found on LeetCode.');
  }

  return fetchLeetCodeProblem(match.titleSlug);
}

async function resolveProblem(payload = {}) {
  const normalizedProblem = normalizeProblemPayload(payload);
  const catalogProblem = normalizedProblem.platform === 'leetcode'
    ? findCatalogProblem(normalizedProblem)
    : null;

  if (catalogProblem) {
    return {
      ...normalizedProblem,
      ...catalogProblem,
      starterCode: {
        ...DEFAULT_STARTER_CODE,
        ...(catalogProblem.starterCode || {}),
        ...(normalizedProblem.starterCode || {}),
      },
    };
  }

  if (normalizedProblem.platform === 'leetcode' && (normalizedProblem.slug || normalizedProblem.number)) {
    try {
      const leetCodeProblem = normalizedProblem.slug && !/^leetcode-\d+$/.test(normalizedProblem.slug)
        ? await fetchLeetCodeProblem(normalizedProblem.slug)
        : await fetchLeetCodeProblemByNumber(normalizedProblem.number);
      const fallbackCatalogProblem = findCatalogProblem(leetCodeProblem);

      return {
        ...normalizedProblem,
        ...leetCodeProblem,
        testCases: leetCodeProblem.testCases?.length
          ? leetCodeProblem.testCases
          : (fallbackCatalogProblem?.testCases || normalizedProblem.testCases || []),
        extractionStatus: 'resolved',
      };
    } catch (error) {
      return {
        ...normalizedProblem,
        testCases: normalizedProblem.testCases || [],
        extractionStatus: 'fallback',
        extractionMessage: 'Live LeetCode extraction was unavailable, so PlacePrep built the workspace from the provided number, title, or URL.',
      };
    }
  }

  return {
    ...normalizedProblem,
    testCases: normalizedProblem.testCases || [],
    extractionStatus: normalizedProblem.description ? 'provided' : 'manual',
  };
}

function problemFromTask(task) {
  const metadata = task?.metadata || {};
  return normalizeProblemPayload({
    platform: metadata.problemPlatform || metadata.platform || inferPlatform(task?.referenceUrl || task?.referenceLabel || task?.title),
    number: metadata.problemNumber || null,
    slug: metadata.problemSlug || metadata.slug || extractLeetCodeSlug(task?.referenceUrl || task?.referenceLabel || task?.title),
    title: metadata.problemTitle || task?.referenceLabel || task?.title,
    url: task?.referenceUrl || metadata.problemUrl || null,
    description: task?.description || metadata.summary || '',
    difficulty: task?.difficulty >= 4 ? 'Hard' : task?.difficulty <= 2 ? 'Easy' : 'Medium',
  });
}

async function getCodingTask(user, taskId) {
  const task = await taskRepository.findById(taskId, user.id);
  if (!task) {
    throw new AppError('Coding task not found.', 404);
  }

  const [languages, submissions] = await Promise.all([
    getLanguages(),
    codingSubmissionRepository.listByTask(user.id, taskId, 8),
  ]);

  return {
    task,
    problem: await resolveProblem(problemFromTask(task)),
    languages,
    submissions,
  };
}

async function getLanguages() {
  const discovered = await judge0Service.listLanguages();

  return discovered.map((language) => ({
    ...language,
    setupWarning: !language.enabled && isSqlLanguage(language.key)
      ? 'SQL execution not configured on this Judge0 provider. Static SQL analysis is still available.'
      : language.unavailableReason,
  }));
}

function detectComplexity(sourceCode) {
  const source = String(sourceCode || '');
  const lower = source.toLowerCase();

  const timeMatch = source.match(/(?:time\s*(?:complexity)?\s*[:=-]?\s*)?(o\s*\([^)]*\))/i);
  if (timeMatch) {
    return timeMatch[1] || 'mentioned';
  }

  const loopCount = (source.match(/\b(for|while)\b/g) || []).length;
  if (loopCount >= 2 && /for[\s\S]*for|while[\s\S]*while|for[\s\S]*while|while[\s\S]*for/.test(lower)) {
    return 'likely O(n^2)';
  }
  if (loopCount === 1) {
    return 'likely O(n)';
  }
  if (/\b(select|join|group by|order by)\b/i.test(source)) {
    return 'query-plan dependent';
  }
  return 'not stated';
}

function detectSpaceComplexity(sourceCode) {
  const source = String(sourceCode || '');
  const lower = source.toLowerCase();
  const spaceMatch = source.match(/space\s*(?:complexity)?\s*[:=-]?\s*(o\s*\([^)]*\))/i);

  if (spaceMatch) {
    return spaceMatch[1];
  }

  if (/\b(hashmap|hash map|map|set|dict|dictionary|array|list|queue|stack|heap)\b/i.test(source)) {
    return 'likely O(n)';
  }
  if (/\brecursion|recursive|dfs\b/i.test(source)) {
    return 'likely O(h) recursion stack';
  }
  if (/\b(select|join|group by|order by)\b/i.test(lower)) {
    return 'query-plan dependent';
  }

  return 'likely O(1)';
}

function scoreTimeComplexity(sourceCode, status) {
  const source = String(sourceCode || '');
  const complexity = detectComplexity(source);
  let score = 55;

  if (/time\s*(?:complexity)?|o\s*\(/i.test(source)) {
    score += 20;
  }
  if (/\b(hash|map|set|queue|stack|heap|binary search|two pointer|window|index|join|group by)\b/i.test(source)) {
    score += 12;
  }
  if (/likely O\(n\^2\)/i.test(complexity) && !/o\s*\(\s*n\^?2/i.test(source)) {
    score -= 15;
  }
  if (['compile_error', 'runtime_error', 'timeout'].includes(status)) {
    score -= 18;
  }

  return clampScore(score);
}

function scoreSpaceComplexity(sourceCode, status) {
  const source = String(sourceCode || '');
  const space = detectSpaceComplexity(source);
  let score = 58;

  if (/space\s*(?:complexity)?/i.test(source)) {
    score += 18;
  }
  if (/o\s*\(\s*1\s*\)/i.test(space)) {
    score += 10;
  }
  if (/likely O\(n\)/i.test(space) && /\b(hash|map|set|dict|array|list|stack|queue|heap)\b/i.test(source)) {
    score += 8;
  }
  if (['compile_error', 'runtime_error', 'timeout'].includes(status)) {
    score -= 15;
  }

  return clampScore(score);
}

function scoreSpeed(durationSeconds, timeLimitSeconds, status) {
  if (!durationSeconds || !timeLimitSeconds) {
    return status === 'accepted' ? 70 : 55;
  }

  const ratio = Number(durationSeconds) / Math.max(1, Number(timeLimitSeconds));
  let score = ratio <= 0.5
    ? 100
    : ratio <= 0.85
      ? 88
      : ratio <= 1
        ? 76
        : ratio <= 1.35
          ? 58
          : 38;

  if (['compile_error', 'runtime_error', 'timeout', 'failed'].includes(status)) {
    score -= 18;
  }

  return clampScore(score);
}

function inferProblemTimeLimitSeconds(problem = {}) {
  const difficulty = String(problem.difficulty || '').toLowerCase();
  if (difficulty.includes('hard')) {
    return 45 * 60;
  }
  if (difficulty.includes('medium')) {
    return 30 * 60;
  }
  return 20 * 60;
}

function scoreLogic(sourceCode, status, problem) {
  const source = String(sourceCode || '');
  let score = 45;

  if (source.trim().length > 120) {
    score += 12;
  }
  if (/\b(if|else|case|switch|where|having)\b/i.test(source)) {
    score += 10;
  }
  if (/\b(empty|null|edge|boundary|duplicate|negative|overflow|constraint)\b/i.test(source)) {
    score += 10;
  }
  if (/\b(return|print|select)\b/i.test(source)) {
    score += 8;
  }
  if (problem?.description && normalizeText(source).includes(normalizeText(problem.title).split(' ')[0])) {
    score += 5;
  }
  if (status === 'accepted') {
    score += 10;
  }
  if (['compile_error', 'runtime_error', 'timeout'].includes(status)) {
    score -= 20;
  }

  return clampScore(score);
}

function scoreReadability(sourceCode) {
  const source = String(sourceCode || '');
  const lines = source.split('\n');
  let score = 55;

  if (lines.length >= 4 && lines.length <= 90) {
    score += 12;
  }
  if (/\b[a-z][a-zA-Z0-9_]{2,}\b/.test(source)) {
    score += 10;
  }
  if (lines.some((line) => /^\s{2,}\S/.test(line)) || /\n\s+(SELECT|FROM|WHERE|JOIN)/i.test(source)) {
    score += 8;
  }
  if (source.length > 12000) {
    score -= 20;
  }
  if ((source.match(/;/g) || []).length > 0 || /\b(def|class|function|int main|public static|select)\b/i.test(source)) {
    score += 8;
  }

  return clampScore(score);
}

function compareOutput(stdout, expectedOutput) {
  if (!String(expectedOutput || '').trim()) {
    return null;
  }

  const normalizeOutput = (value) => String(value || '').replace(/\r\n/g, '\n').trim();
  return normalizeOutput(stdout) === normalizeOutput(expectedOutput);
}

function buildRubric({
  sourceCode,
  status,
  stdout,
  expectedOutput,
  compileOutput,
  stderr,
  problem,
  durationSeconds = 0,
  timeLimitSeconds = 0,
}) {
  const outputMatched = compareOutput(stdout, expectedOutput);
  const accepted = status === 'accepted';
  const failedAtRuntime = ['compile_error', 'runtime_error', 'timeout', 'failed'].includes(status);
  const executionScore = status === 'accepted'
    ? 100
    : status === 'wrong_answer'
      ? 42
      : status === 'compile_error'
        ? 18
        : status === 'timeout'
          ? 12
          : status === 'runtime_error'
            ? 20
            : status === 'analysis_only'
              ? 30
              : 25;
  const correctnessScore = outputMatched === true
    ? 100
    : outputMatched === false
      ? 20
      : accepted
        ? 70
        : failedAtRuntime
          ? 10
          : 45;
  const timeComplexityScore = scoreTimeComplexity(sourceCode, status);
  const spaceComplexityScore = scoreSpaceComplexity(sourceCode, status);
  const complexityScore = clampScore((timeComplexityScore * 0.6) + (spaceComplexityScore * 0.4));
  const speedScore = scoreSpeed(durationSeconds, timeLimitSeconds, status);
  const logicScore = scoreLogic(sourceCode, status, problem);
  const readabilityScore = scoreReadability(sourceCode);
  const finalScore = clampScore(
    correctnessScore * 0.4
    + executionScore * 0.15
    + complexityScore * 0.2
    + speedScore * 0.1
    + logicScore * 0.1
    + readabilityScore * 0.05,
  );
  const recommendations = [];

  if (status === 'compile_error') {
    recommendations.push('Fix the compile error first; scoring stays low until the code can run.');
  }
  if (status === 'runtime_error') {
    recommendations.push('Add guards for null, empty, and boundary inputs before optimizing.');
  }
  if (status === 'timeout') {
    recommendations.push('Revisit the algorithmic complexity and remove repeated scanning.');
  }
  if (outputMatched === false) {
    recommendations.push('Dry-run the expected output and compare formatting, ordering, and edge cases.');
  }
  if (!/o\s*\(/i.test(sourceCode)) {
    recommendations.push('State time complexity in the final explanation.');
  }
  if (!/space\s*(?:complexity)?/i.test(sourceCode)) {
    recommendations.push('State space complexity, especially if you used maps, stacks, arrays, or recursion.');
  }
  if (speedScore < 60) {
    recommendations.push('You ran past the target pace. Practice the pattern until the first correct approach appears faster.');
  }
  if (!recommendations.length) {
    recommendations.push(finalScore >= 75
      ? 'Good submission. Copy the final code when you are ready to reuse it on the original platform.'
      : 'Improve the edge-case handling and add a clearer complexity note before resubmitting.');
  }

  return {
    weights: {
      correctness: 40,
      execution: 15,
      complexity: 20,
      speed: 10,
      logic: 10,
      readability: 5,
    },
    correctnessScore,
    executionScore,
    timeComplexityScore,
    spaceComplexityScore,
    complexityScore,
    speedScore,
    logicScore,
    readabilityScore,
    finalScore,
    outputMatched,
    detectedComplexity: detectComplexity(sourceCode),
    detectedTimeComplexity: detectComplexity(sourceCode),
    detectedSpaceComplexity: detectSpaceComplexity(sourceCode),
    durationSeconds: Number(durationSeconds || 0),
    timeLimitSeconds: Number(timeLimitSeconds || 0),
    recommendations,
    signals: {
      stdoutPresent: Boolean(stdout),
      stderrPresent: Boolean(stderr),
      compileOutputPresent: Boolean(compileOutput),
    },
  };
}

function buildAnalysis({ problem, language, status, stdout, stderr, compileOutput, rubric, executionUnavailable = false }) {
  const weakSpots = [];
  if (rubric.correctnessScore < 75) weakSpots.push('Correctness');
  if (rubric.executionScore < 75) weakSpots.push('Execution stability');
  if (rubric.complexityScore < 70) weakSpots.push('Time and space complexity');
  if (rubric.speedScore < 70) weakSpots.push('Solve speed');
  if (rubric.logicScore < 70) weakSpots.push('Logic and edge cases');
  if (rubric.readabilityScore < 70) weakSpots.push('Readability');

  return {
    problemTitle: problem?.title || 'Coding Lab problem',
    language,
    status,
    summary: executionUnavailable
      ? `${language} execution is not configured, so PlacePrep used static analysis only.`
      : status === 'accepted'
        ? 'The sandbox run completed successfully. Review the rubric before copying the final code.'
        : 'The sandbox run completed with issues. Fix the highest-impact rubric area and rerun.',
    stdoutPreview: stdout ? stripSecrets(stdout).slice(0, 1200) : null,
    stderrPreview: stderr ? stripSecrets(stderr).slice(0, 1200) : null,
    compileOutputPreview: compileOutput ? stripSecrets(compileOutput).slice(0, 1200) : null,
    weakSpots,
    recommendations: rubric.recommendations,
    detectedComplexity: rubric.detectedComplexity,
    detectedTimeComplexity: rubric.detectedTimeComplexity,
    detectedSpaceComplexity: rubric.detectedSpaceComplexity,
    speedScore: rubric.speedScore,
    durationSeconds: rubric.durationSeconds,
    timeLimitSeconds: rubric.timeLimitSeconds,
    executionUnavailable,
  };
}

function normalizeSubmission(submission) {
  if (!submission) {
    return null;
  }

  return {
    ...submission,
    score: Number(submission.score || 0),
    time: submission.time === null || submission.time === undefined ? null : Number(submission.time),
    memory: submission.memory === null || submission.memory === undefined ? null : Number(submission.memory),
    stdout: stripSecrets(submission.stdout || ''),
    stderr: stripSecrets(submission.stderr || ''),
    compileOutput: stripSecrets(submission.compileOutput || ''),
  };
}

async function createAssessmentEntry(user, submission) {
  const activePlan = await prepPlanRepository.findLatestActiveByUser(user.id);
  const rubric = submission.rubric || {};
  const analysis = submission.analysis || {};
  const weakSpots = toArray(analysis.weakSpots).slice(0, 5);
  const problem = submission.problem || {};

  await assessmentRepository.createSession({
    userId: user.id,
    planId: activePlan?.id || null,
    status: 'completed',
    assessmentType: 'coding_lab',
    durationMinutes: 20,
    weakSpots,
    recommendations: toArray(rubric.recommendations).map((recommendation) => ({
      topic: problem.title || 'Coding Lab',
      reason: `${submission.language} submission scored ${Math.round(Number(submission.score || 0))}%.`,
      action: String(recommendation || 'Review the code and resubmit.'),
      problemLabel: problem.title || null,
      problemUrl: problem.url || null,
    })),
    questions: [
      {
        id: `coding-lab-${submission.id}`,
        type: 'coding',
        topic: problem.title || 'Coding Lab',
        prompt: `Solve ${problem.title || 'the selected Coding Lab problem'} in ${submission.language}.`,
        difficulty: problem.difficulty || 'medium',
        averageTimeMinutes: 20,
        referenceLabel: problem.platform || null,
        referenceUrl: problem.url || null,
        taskTitle: problem.title || null,
        approachHint: 'Use the sandbox feedback, then resubmit only after the correctness and complexity notes are addressed.',
      },
    ],
    submission: {
      answers: { [`coding-lab-${submission.id}`]: submission.sourceCode },
      questionResults: [
        {
          questionId: `coding-lab-${submission.id}`,
          topic: problem.title || 'Coding Lab',
          score: Number(submission.score || 0) / 100,
          correct: Number(submission.score || 0) >= 75,
          feedback: analysis.summary || 'Coding Lab submission recorded.',
          rubric,
          analysis,
          codingSubmissionId: submission.id,
        },
      ],
      codingSubmissionId: submission.id,
      submittedAt: new Date().toISOString(),
    },
    score: Number(submission.score || 0),
    metadata: {
      scope: 'daily',
      source: 'coding_lab',
      codingSubmissionId: submission.id,
      taskId: submission.taskId || null,
      language: submission.language,
      rubric,
      analysis,
    },
    startedAt: submission.createdAt || new Date().toISOString(),
    submittedAt: new Date().toISOString(),
  });
}

async function updateTaskProgress(user, submission, final = false) {
  if (!final || !submission.taskId) {
    return null;
  }

  const task = await taskRepository.findById(submission.taskId, user.id);
  if (!task) {
    return null;
  }

  const score = Number(submission.score || 0);
  const nextStatus = score >= 75 ? 'completed' : (task.status === 'pending' ? 'in_progress' : task.status);
  const updatedTask = await taskRepository.updateTask(task.id, user.id, {
    status: nextStatus,
    completedAt: nextStatus === 'completed' ? new Date() : undefined,
    metadata: {
      ...(task.metadata || {}),
      codingLabEnabled: true,
      codingLabLastSubmissionId: submission.id,
      codingLabLastScore: score,
      codingLabLastStatus: submission.status,
      codingLabLastSubmittedAt: new Date().toISOString(),
    },
  });

  await progressService.refreshProgressStats(user.id, user.timezone, { skipAutoVerification: true });
  return updatedTask;
}

async function runCode(user, payload = {}, options = {}) {
  const language = judge0Service.normalizeLanguageKey(payload.language || 'python');
  const sourceCode = String(payload.sourceCode || payload.source || '');
  const stdin = String(payload.stdin || '');
  const expectedOutput = payload.expectedOutput === undefined ? null : String(payload.expectedOutput || '');
  const final = Boolean(options.final || payload.final);
  const durationSeconds = Math.max(0, Number(payload.durationSeconds || 0));
  const requestedTimeLimitSeconds = Math.max(0, Number(payload.timeLimitSeconds || 0));

  assertPayloadSize(sourceCode, stdin);

  const task = payload.taskId ? await taskRepository.findById(payload.taskId, user.id) : null;
  if (payload.taskId && !task) {
    throw new AppError('Coding task not found.', 404);
  }

  const problem = await resolveProblem({
    ...(task ? problemFromTask(task) : {}),
    ...(payload.problem || {}),
    title: payload.problem?.title || payload.problemTitle || task?.referenceLabel || task?.title,
    url: payload.problem?.url || payload.problemUrl || task?.referenceUrl,
  });
  const timeLimitSeconds = requestedTimeLimitSeconds || inferProblemTimeLimitSeconds(problem);

  let queuedSubmission = null;
  let finalResult = null;
  let executionUnavailable = false;

  try {
    const queued = await judge0Service.submit({
      language,
      sourceCode,
      stdin,
      expectedOutput,
    });
    queuedSubmission = await codingSubmissionRepository.createSubmission({
      userId: user.id,
      taskId: task?.id || null,
      problem,
      language,
      sourceCode,
      stdin,
      expectedOutput,
      status: 'queued',
      judgeToken: queued.token,
        analysis: {
          providerLanguage: queued.language.providerName,
          assessmentId: payload.assessmentId || null,
          assessmentQuestionId: payload.assessmentQuestionId || null,
          durationSeconds,
          timeLimitSeconds,
        },
      });
    finalResult = await judge0Service.poll(queued.token);
  } catch (error) {
    if (error instanceof AppError && ['judge0_disabled', 'language_unavailable', 'language_not_allowed'].includes(error.details?.code)) {
      executionUnavailable = true;
      queuedSubmission = await codingSubmissionRepository.createSubmission({
        userId: user.id,
        taskId: task?.id || null,
        problem,
        language,
        sourceCode,
        stdin,
        expectedOutput,
        status: 'analysis_only',
        analysis: {
          executionUnavailable: true,
          unavailableReason: error.message,
          assessmentId: payload.assessmentId || null,
          assessmentQuestionId: payload.assessmentQuestionId || null,
          durationSeconds,
          timeLimitSeconds,
        },
      });
      finalResult = {
        status: 'analysis_only',
        stdout: null,
        stderr: null,
        compileOutput: null,
        time: null,
        memory: null,
        statusDescription: error.message,
      };
    } else {
      throw error;
    }
  }

  const stdout = stripSecrets(finalResult.stdout || '');
  const stderr = stripSecrets(finalResult.stderr || finalResult.message || '');
  const compileOutput = stripSecrets(finalResult.compileOutput || '');
  const rubric = buildRubric({
    sourceCode,
    status: finalResult.status,
    stdout,
    expectedOutput,
    compileOutput,
    stderr,
    problem,
    durationSeconds,
    timeLimitSeconds,
  });
  const analysis = buildAnalysis({
    problem,
    language,
    status: finalResult.status,
    stdout,
    stderr,
    compileOutput,
    rubric,
    executionUnavailable,
  });
  const testResults = [
    {
      name: expectedOutput ? 'Expected output' : 'Sandbox run',
      passed: finalResult.status === 'accepted' && compareOutput(stdout, expectedOutput) !== false,
      status: finalResult.status,
      expectedOutput,
      actualOutput: stdout || null,
      message: finalResult.statusDescription || null,
    },
  ];

  const updatedSubmission = await codingSubmissionRepository.updateSubmission(queuedSubmission.id, user.id, {
    status: finalResult.status,
    stdout,
    stderr,
    compileOutput,
    time: finalResult.time,
    memory: finalResult.memory,
    testResults,
    analysis: {
      ...(queuedSubmission.analysis || {}),
      ...analysis,
      finalized: final,
      assessmentId: payload.assessmentId || null,
      assessmentQuestionId: payload.assessmentQuestionId || null,
    },
    rubric,
    score: rubric.finalScore,
  });

  if (final) {
    await createAssessmentEntry(user, updatedSubmission);
    await updateTaskProgress(user, updatedSubmission, true);
  }

  return normalizeSubmission(updatedSubmission);
}

async function submitCode(user, payload = {}) {
  return runCode(user, payload, { final: true });
}

async function getRun(user, runId) {
  const submission = await codingSubmissionRepository.findById(runId, user.id);
  if (!submission) {
    throw new AppError('Coding run not found.', 404);
  }

  return normalizeSubmission(submission);
}

async function listSubmissions(user, filters = {}) {
  const limit = Math.max(1, Math.min(50, Number(filters.limit || 20)));
  const submissions = await codingSubmissionRepository.listByUser(user.id, limit);
  return submissions.map(normalizeSubmission);
}

module.exports = {
  DEFAULT_STARTER_CODE,
  resolveProblem,
  getLanguages,
  getCodingTask,
  runCode,
  submitCode,
  getRun,
  listSubmissions,
};
