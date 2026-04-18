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
  'SQL',
  'Python',
  'Statistics',
  'Pandas',
  'Data Visualization',
  'Excel',
  'Power BI',
  'Tableau',
  'ETL',
  'Data Warehousing',
  'Data Modeling',
  'Spark',
  'Airflow',
  'Machine Learning',
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
  SQL: {
    question: 'What makes a SQL answer interview-ready instead of just syntactically correct?',
    answer: 'Choose the right join or aggregation, explain why it works, and sanity-check nulls, duplicates, and ordering.',
  },
  Python: {
    question: 'What is the best Python habit for interview code?',
    answer: 'Keep the solution readable, use built-in data structures well, and avoid clever shortcuts that hide the logic.',
  },
  Statistics: {
    question: 'How do you make a statistics answer feel practical?',
    answer: 'Define the metric, explain what it means, then connect it to uncertainty, variance, or business impact.',
  },
  Pandas: {
    question: 'What is a strong first instinct in a pandas problem?',
    answer: 'Clarify the grain of the data, then group, filter, reshape, or merge only after checking the columns and null behavior.',
  },
  ETL: {
    question: 'What makes an ETL explanation credible?',
    answer: 'Describe the source, the transformations, the destination, and how you keep the pipeline reliable when data changes.',
  },
  'Data Warehousing': {
    question: 'What should you mention first when discussing a warehouse design?',
    answer: 'State the business grain, the fact tables, the key dimensions, and how fresh and historical data will be handled.',
  },
  'Data Modeling': {
    question: 'What is the safest way to explain data modeling in interviews?',
    answer: 'Start with the business questions, then show how entities, relationships, grain, and constraints support those questions.',
  },
  Spark: {
    question: 'What is a practical Spark interview explanation?',
    answer: 'Talk about distributed transforms, shuffles, partitioning, and how those choices affect job speed and reliability.',
  },
  Airflow: {
    question: 'What makes an Airflow answer strong?',
    answer: 'Explain the DAG, task dependencies, retries, scheduling, and how failures are observed and recovered.',
  },
  'Machine Learning': {
    question: 'What anchors a machine learning explanation?',
    answer: 'Start with the prediction goal, the data, the evaluation metric, and the trade-off between accuracy and generalization.',
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
    pattern: /sql|postgres|mysql|query/i,
    article: { title: 'GeeksforGeeks: SQL Tutorial', url: 'https://www.geeksforgeeks.org/sql-tutorial/' },
    newsletter: { title: 'DB Weekly: database internals and SQL practice', url: 'https://dbweekly.com/' },
    videos: [
      { title: 'freeCodeCamp: SQL full course', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+SQL+full+course' },
      { title: 'CodeWithMosh: SQL tutorial for beginners', url: 'https://www.youtube.com/results?search_query=CodeWithMosh+SQL+tutorial' },
    ],
    problems: [
      { label: 'LeetCode: Combine Two Tables', difficulty: 'Easy', url: 'https://leetcode.com/problems/combine-two-tables/' },
      { label: 'HackerRank: Revising the Select Query I', difficulty: 'Easy', url: 'https://www.hackerrank.com/challenges/revising-the-select-query/problem' },
      { label: 'LeetCode: Rank Scores', difficulty: 'Medium', url: 'https://leetcode.com/problems/rank-scores/' },
    ],
  },
  {
    pattern: /python|pandas/i,
    article: { title: 'GeeksforGeeks: Python Tutorial', url: 'https://www.geeksforgeeks.org/python-programming-language-tutorial/' },
    newsletter: { title: 'Python Weekly: practical Python updates', url: 'https://www.pythonweekly.com/' },
    videos: [
      { title: 'freeCodeCamp: Python for beginners', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+python+for+beginners' },
      { title: 'CodeWithMosh: Python tutorial', url: 'https://www.youtube.com/results?search_query=CodeWithMosh+python+tutorial' },
    ],
    problems: [
      { label: 'HackerRank: Python Lists', difficulty: 'Easy', url: 'https://www.hackerrank.com/challenges/python-lists/problem' },
      { label: 'HackerRank: Find the Runner-Up Score!', difficulty: 'Easy', url: 'https://www.hackerrank.com/challenges/find-second-maximum-number-in-a-list/problem' },
      { label: 'LeetCode: Contains Duplicate', difficulty: 'Easy', url: 'https://leetcode.com/problems/contains-duplicate/' },
    ],
  },
  {
    pattern: /statistics|probability|a\/b testing|experimentation/i,
    article: { title: 'GeeksforGeeks: Statistics for Data Science', url: 'https://www.geeksforgeeks.org/statistics-for-data-science/' },
    newsletter: { title: 'Data Elixir: analytics and experimentation reading', url: 'https://dataelixir.com/' },
    videos: [
      { title: 'freeCodeCamp: Statistics for data science', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+statistics+for+data+science' },
      { title: 'codebasics: Statistics for analytics interviews', url: 'https://www.youtube.com/results?search_query=codebasics+statistics+for+data+science' },
    ],
    problems: [
      { label: 'LeetCode: Statistics from a Large Sample', difficulty: 'Hard', url: 'https://leetcode.com/problems/statistics-from-a-large-sample/' },
      { label: 'HackerRank: Day 0 - Mean, Median, and Mode', difficulty: 'Easy', url: 'https://www.hackerrank.com/challenges/s10-basic-statistics/problem' },
      { label: 'HackerRank: Day 4 - Binomial Distribution I', difficulty: 'Medium', url: 'https://www.hackerrank.com/challenges/s10-binomial-distribution-1/problem' },
    ],
  },
  {
    pattern: /data visualization|dashboard|excel|power bi|tableau/i,
    article: { title: 'GeeksforGeeks: Data Visualization Tutorial', url: 'https://www.geeksforgeeks.org/data-visualization-tutorial/' },
    newsletter: { title: 'Data Elixir: analytics and dashboard thinking', url: 'https://dataelixir.com/' },
    videos: [
      { title: 'freeCodeCamp: Data visualization projects', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+data+visualization+projects' },
      { title: 'codebasics: Power BI and dashboard walkthroughs', url: 'https://www.youtube.com/results?search_query=codebasics+power+bi+dashboard+tutorial' },
    ],
    problems: [
      { label: 'LeetCode: Department Highest Salary', difficulty: 'Medium', url: 'https://leetcode.com/problems/department-highest-salary/' },
      { label: 'HackerRank: Top Earners', difficulty: 'Easy', url: 'https://www.hackerrank.com/challenges/earnings-of-employees/problem' },
      { label: 'HackerRank: Weather Observation Station 20', difficulty: 'Medium', url: 'https://www.hackerrank.com/challenges/weather-observation-station-20/problem' },
    ],
  },
  {
    pattern: /etl|data warehouse|data warehousing|data modeling|spark|airflow|pipeline/i,
    article: { title: 'GeeksforGeeks: ETL Full Form and Process', url: 'https://www.geeksforgeeks.org/etl-extract-transform-load-process/' },
    newsletter: { title: 'Data Engineering Weekly: pipelines and warehousing', url: 'https://www.dataengineeringweekly.com/' },
    videos: [
      { title: 'freeCodeCamp: Data engineering basics', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+data+engineering+tutorial' },
      { title: 'codebasics: Data engineering projects and pipelines', url: 'https://www.youtube.com/results?search_query=codebasics+data+engineering+project' },
    ],
    problems: [
      { label: 'LeetCode: Trips and Users', difficulty: 'Hard', url: 'https://leetcode.com/problems/trips-and-users/' },
      { label: 'HackerRank: SQL Project Planning', difficulty: 'Medium', url: 'https://www.hackerrank.com/challenges/sql-projects/problem' },
      { label: 'HackerRank: Occupations', difficulty: 'Medium', url: 'https://www.hackerrank.com/challenges/the-pads/problem' },
    ],
  },
  {
    pattern: /machine learning|ml/i,
    article: { title: 'GeeksforGeeks: Machine Learning', url: 'https://www.geeksforgeeks.org/machine-learning/' },
    newsletter: { title: 'Data Elixir: machine learning and data science reading', url: 'https://dataelixir.com/' },
    videos: [
      { title: 'freeCodeCamp: Machine learning for beginners', url: 'https://www.youtube.com/results?search_query=freeCodeCamp+machine+learning+for+beginners' },
      { title: 'codebasics: Machine learning roadmap', url: 'https://www.youtube.com/results?search_query=codebasics+machine+learning+roadmap' },
    ],
    problems: [
      { label: 'LeetCode: Evaluate Division', difficulty: 'Medium', url: 'https://leetcode.com/problems/evaluate-division/' },
      { label: 'HackerRank: Day 6 - The Central Limit Theorem I', difficulty: 'Medium', url: 'https://www.hackerrank.com/challenges/s10-central-limit-theorem-1/problem' },
      { label: 'HackerRank: Day 8 - Least Square Regression Line', difficulty: 'Medium', url: 'https://www.hackerrank.com/challenges/s10-least-square-regression-line/problem' },
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

const ROLE_PREP_PROFILES = [
  {
    pattern: /backend/i,
    biasTopics: ['DBMS', 'Operating Systems', 'System Design', 'Object-Oriented Programming', 'SQL'],
    practiceTopics: ['Arrays', 'Strings', 'Graphs', 'Dynamic Programming'],
    revisionTopics: ['DBMS', 'Operating Systems', 'System Design', 'Object-Oriented Programming'],
    projectFocus: 'backend APIs and service design',
    projectReference: {
      label: 'roadmap.sh backend projects',
      url: 'https://roadmap.sh/backend/projects',
    },
    outcomeLabel: 'backend interview signal',
  },
  {
    pattern: /frontend/i,
    biasTopics: ['Strings', 'Arrays', 'Object-Oriented Programming'],
    practiceTopics: ['Strings', 'Arrays', 'Greedy Algorithms'],
    revisionTopics: ['Object-Oriented Programming'],
    projectFocus: 'frontend UI delivery and state handling',
    projectReference: {
      label: 'roadmap.sh frontend projects',
      url: 'https://roadmap.sh/frontend/projects',
    },
    outcomeLabel: 'frontend interview signal',
  },
  {
    pattern: /full.?stack/i,
    biasTopics: ['DBMS', 'System Design', 'Object-Oriented Programming', 'SQL'],
    practiceTopics: ['Arrays', 'Strings', 'Graphs'],
    revisionTopics: ['DBMS', 'System Design', 'Object-Oriented Programming'],
    projectFocus: 'full-stack feature delivery',
    projectReference: {
      label: 'roadmap.sh full stack projects',
      url: 'https://roadmap.sh/full-stack',
    },
    outcomeLabel: 'full-stack interview signal',
  },
  {
    pattern: /software engineer/i,
    biasTopics: ['Arrays', 'Strings', 'Binary Trees', 'Graphs', 'Dynamic Programming', 'Object-Oriented Programming'],
    practiceTopics: ['Arrays', 'Strings', 'Binary Trees', 'Graphs', 'Dynamic Programming'],
    revisionTopics: ['Object-Oriented Programming', 'DBMS', 'Operating Systems'],
    projectFocus: 'core engineering implementation',
    projectReference: {
      label: 'roadmap.sh computer science projects',
      url: 'https://roadmap.sh/computer-science',
    },
    outcomeLabel: 'software engineering interview signal',
  },
  {
    pattern: /sde intern/i,
    biasTopics: ['Arrays', 'Strings', 'Binary Trees', 'DBMS', 'Operating Systems'],
    practiceTopics: ['Arrays', 'Strings', 'Binary Trees', 'Graphs'],
    revisionTopics: ['DBMS', 'Operating Systems', 'Object-Oriented Programming'],
    projectFocus: 'intern-level implementation reps',
    projectReference: {
      label: 'roadmap.sh computer science projects',
      url: 'https://roadmap.sh/computer-science',
    },
    outcomeLabel: 'intern interview signal',
  },
  {
    pattern: /data analyst/i,
    biasTopics: ['SQL', 'Statistics', 'Python', 'Pandas', 'Data Visualization', 'Power BI'],
    practiceTopics: ['SQL', 'Statistics', 'Python', 'Pandas'],
    revisionTopics: ['Data Visualization', 'Excel', 'Power BI', 'Tableau'],
    projectFocus: 'analysis storytelling and dashboard delivery',
    projectReference: {
      label: 'Kaggle Learn: analysis portfolio projects',
      url: 'https://www.kaggle.com/learn',
    },
    outcomeLabel: 'data analyst interview signal',
  },
  {
    pattern: /data engineer/i,
    biasTopics: ['SQL', 'Python', 'ETL', 'Data Warehousing', 'Data Modeling', 'Spark', 'Airflow'],
    practiceTopics: ['SQL', 'Python', 'DBMS'],
    revisionTopics: ['ETL', 'Data Warehousing', 'Data Modeling', 'Spark', 'Airflow'],
    projectFocus: 'data pipelines and warehouse design',
    projectReference: {
      label: 'DataTalksClub: data engineering projects',
      url: 'https://github.com/DataTalksClub/data-engineering-zoomcamp',
    },
    outcomeLabel: 'data engineering interview signal',
  },
  {
    pattern: /data scientist/i,
    biasTopics: ['Python', 'Statistics', 'Pandas', 'SQL', 'Machine Learning', 'Data Visualization'],
    practiceTopics: ['Python', 'Statistics', 'SQL', 'Pandas'],
    revisionTopics: ['Machine Learning', 'Data Visualization'],
    projectFocus: 'modeling and experiment storytelling',
    projectReference: {
      label: 'Kaggle Learn: data science portfolio projects',
      url: 'https://www.kaggle.com/learn',
    },
    outcomeLabel: 'data science interview signal',
  },
];

const DEFAULT_ROLE_PREP_PROFILE = {
  biasTopics: ['Arrays', 'Strings', 'Binary Trees', 'Graphs', 'Dynamic Programming'],
  practiceTopics: ['Arrays', 'Strings', 'Binary Trees', 'Graphs'],
  revisionTopics: ['Object-Oriented Programming'],
  projectFocus: 'project-based learning',
  projectReference: {
    label: 'roadmap.sh computer science projects',
    url: 'https://roadmap.sh/computer-science',
  },
  outcomeLabel: 'interview signal',
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

function getRolePrepProfile(targetRole) {
  const normalizedRole = String(targetRole || '').toLowerCase();
  return ROLE_PREP_PROFILES.find((profile) => profile.pattern.test(normalizedRole)) || DEFAULT_ROLE_PREP_PROFILE;
}

function isRevisionTopic(topic) {
  return /dbms|operating systems|system design|object-oriented|data visualization|excel|power bi|tableau|etl|data warehousing|data modeling|spark|airflow|machine learning/i.test(String(topic || ''));
}

function getRoleReferenceFallbackTopic(targetRole) {
  const role = String(targetRole || '').toLowerCase();

  if (/data analyst/.test(role)) {
    return 'SQL';
  }
  if (/data engineer/.test(role)) {
    return 'ETL';
  }
  if (/data scientist/.test(role)) {
    return 'Python';
  }
  if (/backend/.test(role)) {
    return 'DBMS';
  }
  if (/frontend/.test(role)) {
    return 'Strings';
  }
  if (/full.?stack/.test(role)) {
    return 'System Design';
  }

  return 'Arrays';
}

function getTopicAliasFallbackTopic(topic, targetRole) {
  const normalized = String(topic || '').toLowerCase();

  if (/sliding window|two pointer|prefix|hash|sorting|sort|interval|matrix/.test(normalized)) {
    return 'Arrays';
  }
  if (/heap|priority queue/.test(normalized)) {
    return 'Queues';
  }
  if (/trie|substring|pattern matching/.test(normalized)) {
    return 'Strings';
  }
  if (/tree traversal|bst|dfs|bfs/.test(normalized)) {
    return 'Binary Trees';
  }
  if (/shortest path|union find|topological|graph/.test(normalized)) {
    return 'Graphs';
  }
  if (/memoization|tabulation/.test(normalized)) {
    return 'Dynamic Programming';
  }
  if (/rest|api|microservice|distributed|cache/.test(normalized)) {
    return 'System Design';
  }
  if (/sql|query|postgres|mysql/.test(normalized)) {
    return 'SQL';
  }
  if (/python|numpy|pandas|eda|cleaning|wrangling/.test(normalized)) {
    return 'Python';
  }
  if (/dashboard|analytics|reporting|kpi|insight|storytelling|visual/.test(normalized)) {
    return 'Data Visualization';
  }
  if (/stat|probability|experiment|ab test|a\/b/.test(normalized)) {
    return 'Statistics';
  }
  if (/warehouse|lake|etl|elt|pipeline|orchestration|spark|airflow|modeling/.test(normalized)) {
    return 'Data Warehousing';
  }
  if (/machine learning|regression|classification|clustering|ml/.test(normalized)) {
    return 'Machine Learning';
  }

  return getRoleReferenceFallbackTopic(targetRole);
}

function getTopicReferenceProfile(topic, targetRole = '') {
  const normalized = String(topic || '').toLowerCase();
  const match = TOPIC_REFERENCE_BANK.find((item) => item.pattern.test(normalized));

  if (match) {
    return match;
  }

  const fallbackTopic = getTopicAliasFallbackTopic(topic, targetRole);
  return TOPIC_REFERENCE_BANK.find((item) => item.pattern.test(String(fallbackTopic).toLowerCase()))
    || TOPIC_REFERENCE_BANK[0];
}

function buildArticleUrl(topic, targetRole) {
  return getTopicReferenceProfile(topic, targetRole).article.url;
}

function buildProblemSet(topic, targetRole) {
  return getTopicReferenceProfile(topic, targetRole).problems;
}

function buildCuratedResourceItems(topic, targetRole) {
  const profile = getTopicReferenceProfile(topic, targetRole);
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
  return getRolePrepProfile(targetRole).projectReference || DEFAULT_ROLE_PREP_PROFILE.projectReference;
}

function getRoleBiasTopics(targetRole) {
  return getRolePrepProfile(targetRole).biasTopics || [];
}

function buildCoachLine(knownTopics, prioritizedTopics, targetRole) {
  const roleProfile = getRolePrepProfile(targetRole);
  const foundation = knownTopics[0] || 'the basics';
  const primaryFocus = prioritizedTopics[0] || roleProfile.biasTopics[0] || 'core placement topics';
  const secondaryFocus = prioritizedTopics[1] || roleProfile.biasTopics[1] || '';

  if (secondaryFocus) {
    return `You already know ${foundation}. Now turn ${primaryFocus} and ${secondaryFocus} into ${roleProfile.outcomeLabel}.`;
  }

  return `You already know ${foundation}. Now build disciplined pressure on ${primaryFocus} for ${roleProfile.outcomeLabel}.`;
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

function buildDailyTasks(prioritizedTopics, knownTopics, timePerDay, targetRole, targetTopics = []) {
  const roleProfile = getRolePrepProfile(targetRole);
  const practiceTopics = cleanTopics([
    ...prioritizedTopics.filter((topic) => !isRevisionTopic(topic)),
    ...targetTopics.filter((topic) => !isRevisionTopic(topic)),
    ...roleProfile.practiceTopics,
  ], 8);
  const revisionTopics = cleanTopics([
    ...targetTopics.filter((topic) => isRevisionTopic(topic)),
    ...prioritizedTopics.filter((topic) => isRevisionTopic(topic)),
    ...roleProfile.revisionTopics,
  ], 8);
  const projectFocus = cleanTopics([...targetTopics, ...roleProfile.biasTopics], 2).join(' + ')
    || roleProfile.projectFocus
    || targetRole
    || 'Placement project';
  const projectReference = buildProjectReference(targetRole);
  const days = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'];
  const totalMinutes = clamp(timePerDay || 120, 60, 480);
  const practiceType = /data analyst|data engineer|data scientist/i.test(String(targetRole || ''))
    ? 'Practice'
    : 'DSA';
  const chunks = [
    Math.round(totalMinutes * 0.25),
    Math.round(totalMinutes * 0.28),
    Math.round(totalMinutes * 0.2),
    Math.round(totalMinutes * 0.27),
  ];

  return days.map((day, index) => {
    const primaryTopic = practiceTopics[index % Math.max(practiceTopics.length, 1)] || roleProfile.practiceTopics[0] || 'Arrays';
    const secondaryTopic = practiceTopics[(index + 1) % Math.max(practiceTopics.length, 1)] || roleProfile.practiceTopics[1] || 'Binary Trees';
    const revisionTopic = revisionTopics[index % Math.max(revisionTopics.length, 1)]
      || prioritizedTopics[index % Math.max(prioritizedTopics.length, 1)]
      || roleProfile.revisionTopics[0]
      || 'Operating Systems';
    const primaryProblemSet = buildProblemSet(primaryTopic, targetRole);
    const secondaryProblemSet = buildProblemSet(secondaryTopic, targetRole);
    const primaryProblem = primaryProblemSet[0];
    const secondaryProblem = secondaryProblemSet[1] || secondaryProblemSet[0];

    return {
      day,
      theme: `${primaryTopic} into ${revisionTopic}`,
      totalEstimatedMinutes: chunks.reduce((sum, minutes) => sum + minutes, 0),
      items: [
        {
          title: practiceType === 'Practice' ? `${primaryTopic} focused drill` : `${primaryTopic} platform warm-up`,
          type: practiceType,
          estimatedMinutes: chunks[0],
          difficulty: primaryProblem.difficulty,
          referenceLabel: primaryProblem.label,
          referenceUrl: primaryProblem.url,
        },
        {
          title: practiceType === 'Practice' ? `${secondaryTopic} applied checkpoint` : `${secondaryTopic} medium checkpoint`,
          type: practiceType,
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
          referenceUrl: buildArticleUrl(revisionTopic, targetRole),
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
    items: buildCuratedResourceItems(topic, targetRole),
  }));
}

function matchesRelevantTopic(value, relevantTopics = []) {
  const normalizedValue = String(value || '').toLowerCase();
  if (!normalizedValue) {
    return false;
  }

  return relevantTopics.some((topic) => {
    const normalizedTopic = String(topic || '').toLowerCase();
    return normalizedValue.includes(normalizedTopic) || normalizedTopic.includes(normalizedValue);
  });
}

function buildFlashcards(prioritizedTopics, knownTopics, taskDays = [], targetRole = '') {
  const roleProfile = getRolePrepProfile(targetRole);
  const taskTopics = Array.isArray(taskDays)
    ? taskDays.flatMap((day) => splitThemeTopics(day?.theme))
    : [];
  const focusTopics = cleanTopics([
    ...prioritizedTopics,
    ...taskTopics,
    ...roleProfile.biasTopics,
    ...knownTopics,
  ], 8);

  return focusTopics.slice(0, 8).map((topic, index) => {
    const relatedDay = taskDays.find((day) => matchesRelevantTopic(day?.theme, [topic]));
    const relatedTask = relatedDay?.items?.find((item) => (
      matchesRelevantTopic(`${item?.title || ''} ${item?.referenceLabel || ''}`, [topic])
    )) || relatedDay?.items?.[0] || null;
    const roleSuffix = targetRole ? ` for a ${targetRole} interview` : '';
    const taskAnchor = relatedTask?.referenceLabel || relatedTask?.title || relatedDay?.theme || null;

    if (FLASHCARD_BANK[topic] && index % 2 === 0) {
      return {
        topic,
        question: FLASHCARD_BANK[topic].question,
        answer: `${FLASHCARD_BANK[topic].answer}${taskAnchor ? ` Anchor it with ${taskAnchor}.` : ''}`,
      };
    }

    if (relatedTask) {
      return {
        topic,
        question: `How would you explain ${topic}${roleSuffix} while working through ${relatedTask.title}?`,
        answer: `State the core idea in one sentence, call out the tradeoff that matters most, then connect it directly to ${taskAnchor || relatedTask.title}.`,
      };
    }

    return {
      topic,
      question: `What is the interview-safe mental model for ${topic}${roleSuffix}?`,
      answer: `Define ${topic} clearly, name the core pattern, and connect it to one practical use-case that matters for ${targetRole || 'your next role'}.`,
    };
  });
}

function buildFallbackPlan({ knownTopics, targetTopics, timePerDay, targetRole, planId = null, version = 1 }) {
  const prioritizedTopics = prioritizeTopics(knownTopics, targetTopics, targetRole);
  const roadmap = buildRoadmap(prioritizedTopics, timePerDay, targetRole);
  const tasks = buildDailyTasks(prioritizedTopics, knownTopics, timePerDay, targetRole, targetTopics);
  const resources = buildResources(prioritizedTopics, targetRole);
  const flashcards = buildFlashcards(prioritizedTopics, knownTopics, tasks, targetRole);
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
    coachLine: buildCoachLine(knownTopics, prioritizedTopics, targetRole),
    roadmap,
    tasks,
    resources,
    flashcards,
    version,
    usedFallback: true,
  };
}

function normalizePlanResult(rawPlan, fallbackPlan) {
  const relevantTopics = cleanTopics([
    ...fallbackPlan.targetTopics,
    ...getRoleBiasTopics(fallbackPlan.targetRole),
    ...fallbackPlan.knownTopics,
  ], 12);

  const roadmap = Array.isArray(rawPlan.roadmap) && rawPlan.roadmap.length
    ? rawPlan.roadmap.slice(0, 4).map((week, index) => ({
      week: Number(week.week || index + 1),
      title: String(week.title || fallbackPlan.roadmap[index]?.title || `Week ${index + 1}`).trim(),
      focusTopics: (() => {
        const rawFocusTopics = cleanTopics(week.focusTopics || week.topics || [], 3);
        const relevantFocusTopics = rawFocusTopics.filter((topic) => matchesRelevantTopic(topic, relevantTopics));
        return relevantFocusTopics.length
          ? cleanTopics([...relevantFocusTopics, ...(fallbackPlan.roadmap[index]?.focusTopics || [])], 3)
          : (fallbackPlan.roadmap[index]?.focusTopics || []);
      })(),
      estimatedHours: clamp(week.estimatedHours || fallbackPlan.roadmap[index]?.estimatedHours || 12, 4, 30),
      goals: cleanTopics(week.goals || fallbackPlan.roadmap[index]?.goals || [], 4),
    }))
    : fallbackPlan.roadmap;

  const tasks = Array.isArray(rawPlan.tasks) && rawPlan.tasks.length
    ? rawPlan.tasks.slice(0, 5).map((dayPlan, index) => {
      const rawTheme = String(dayPlan.theme || '');
      const hasRelevantTheme = matchesRelevantTopic(rawTheme, relevantTopics);
      const hasRelevantItems = Array.isArray(dayPlan.items) && dayPlan.items.some((item) => (
        matchesRelevantTopic(`${item?.title || ''} ${item?.referenceLabel || ''}`, relevantTopics)
      ));

      if (!hasRelevantTheme && !hasRelevantItems) {
        return fallbackPlan.tasks[index];
      }

      return {
        day: String(dayPlan.day || `Day ${index + 1}`),
        theme: rawTheme || fallbackPlan.tasks[index]?.theme || 'Focused prep',
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
      };
    })
    : fallbackPlan.tasks;

  const resources = fallbackPlan.resources;

  const flashcards = Array.isArray(rawPlan.flashcards) && rawPlan.flashcards.length
    ? rawPlan.flashcards.slice(0, 10).map((card, index) => {
      const topic = String(card.topic || fallbackPlan.flashcards[index]?.topic || 'Prep').trim();
      if (!matchesRelevantTopic(topic, relevantTopics)) {
        return fallbackPlan.flashcards[index] || fallbackPlan.flashcards[0];
      }

      return {
        topic,
        question: String(card.question || fallbackPlan.flashcards[index]?.question || 'Question').trim(),
        answer: String(card.answer || fallbackPlan.flashcards[index]?.answer || 'Answer').trim(),
      };
    })
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
      '   * 5-10 Q&A cards tied to the selected role, the user target topics, and the planned tasks/problems',
      '   * Make them useful for recall under interview pressure, not textbook definitions',
      '',
      'Rules:',
      '* Blend the selected role with the user target topics. The role should shape the plan, but the listed target topics must stay visible in the roadmap, tasks, and resources.',
      '* Make the daily work role-aware: data analyst plans should lean into SQL, analysis, dashboards, and insight delivery; data engineer plans should lean into pipelines, modeling, warehousing, and orchestration; software roles should lean into coding patterns, CS fundamentals, and systems.',
      '* Keep the roadmap and daily tasks tightly relevant to the provided topics. Do not introduce random focus areas outside the chosen role and target topics.',
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
      'Blend the selected role with the target topics so the result feels role-specific instead of generic.',
      'For data analyst and data engineer roles, lean into SQL, analytics, pipelines, warehousing, dashboards, and role-specific project work when relevant.',
      'Keep the plan tightly relevant to the supplied target topics. Avoid drifting into unrelated areas.',
      'Make flashcards specific to the planned work and useful for fast recall under interview pressure.',
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
