const aiGateway = require('./aiGateway.service');
const { withTransaction } = require('../config/database');
const prepPlanRepository = require('../repositories/prepPlan.repository');
const taskRepository = require('../repositories/task.repository');
const userRepository = require('../repositories/user.repository');
const progressService = require('./progress.service');
const tierService = require('./tier.service');
const { sendPlanReadyEmail } = require('./email.service');
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

const COMPANY_PREP_PROFILES = {
  google: {
    key: 'google',
    label: 'Google',
    hiringStyle: 'structured problem solving, clean communication, and scalable engineering judgment',
    interviewLoop: ['DSA rounds', 'role deep-dive', 'Googliness and behavioral signals'],
    focusTopics: ['Arrays', 'Strings', 'Graphs', 'Dynamic Programming', 'System Design'],
    practiceSignals: ['edge-case narration', 'complexity tradeoffs', 'follow-up optimization'],
  },
  meta: {
    key: 'meta',
    label: 'Meta',
    hiringStyle: 'speed, coding accuracy, product impact, and crisp tradeoff discussion',
    interviewLoop: ['coding rounds', 'system/product design', 'behavioral ownership'],
    focusTopics: ['Arrays', 'Strings', 'Binary Trees', 'Graphs', 'System Design'],
    practiceSignals: ['fast pattern recognition', 'product-scale reasoning', 'impact storytelling'],
  },
  amazon: {
    key: 'amazon',
    label: 'Amazon',
    hiringStyle: 'coding depth plus leadership-principle-backed ownership stories',
    interviewLoop: ['online assessment', 'DSA rounds', 'bar raiser behavioral round'],
    focusTopics: ['Arrays', 'Binary Trees', 'Graphs', 'Dynamic Programming', 'Object-Oriented Programming'],
    practiceSignals: ['STAR answers', 'ownership examples', 'operational tradeoffs'],
  },
  microsoft: {
    key: 'microsoft',
    label: 'Microsoft',
    hiringStyle: 'balanced problem solving, design clarity, collaboration, and fundamentals',
    interviewLoop: ['coding rounds', 'design discussion', 'managerial/behavioral round'],
    focusTopics: ['Arrays', 'Strings', 'Binary Trees', 'Object-Oriented Programming', 'System Design'],
    practiceSignals: ['clear abstractions', 'testing mindset', 'collaborative explanation'],
  },
  zoho: {
    key: 'zoho',
    label: 'Zoho',
    hiringStyle: 'implementation strength, fundamentals, debugging, and practical coding rounds',
    interviewLoop: ['aptitude/coding screen', 'advanced programming', 'technical HR'],
    focusTopics: ['Arrays', 'Strings', 'Recursion', 'Object-Oriented Programming', 'DBMS'],
    practiceSignals: ['working code', 'manual dry runs', 'debug-ready reasoning'],
  },
  tcs: {
    key: 'tcs',
    label: 'TCS',
    hiringStyle: 'aptitude readiness, programming basics, communication, and role fit',
    interviewLoop: ['aptitude screen', 'coding round', 'technical/managerial/HR round'],
    focusTopics: ['Arrays', 'Strings', 'SQL', 'DBMS', 'Operating Systems'],
    practiceSignals: ['foundation accuracy', 'clear spoken answers', 'campus interview confidence'],
  },
  infosys: {
    key: 'infosys',
    label: 'Infosys',
    hiringStyle: 'aptitude, programming fundamentals, DBMS/OS basics, and communication',
    interviewLoop: ['aptitude and puzzle screen', 'coding round', 'technical HR'],
    focusTopics: ['Arrays', 'Strings', 'SQL', 'DBMS', 'Object-Oriented Programming'],
    practiceSignals: ['basic-to-medium coding', 'fundamentals recall', 'project explanation'],
  },
  accenture: {
    key: 'accenture',
    label: 'Accenture',
    hiringStyle: 'aptitude, communication, coding basics, and project/application thinking',
    interviewLoop: ['cognitive/technical assessment', 'coding', 'communication and HR'],
    focusTopics: ['Arrays', 'Strings', 'SQL', 'Object-Oriented Programming', 'Aptitude'],
    practiceSignals: ['communication polish', 'scenario answers', 'baseline coding accuracy'],
  },
  custom: {
    key: 'custom',
    label: 'Custom',
    hiringStyle: 'company-specific role expectations and interview readiness',
    interviewLoop: ['role-specific technical rounds', 'project discussion', 'behavioral round'],
    focusTopics: ['Arrays', 'Strings', 'DBMS', 'System Design', 'Object-Oriented Programming'],
    practiceSignals: ['role alignment', 'project evidence', 'interview explanation'],
  },
};

const PREP_LANGUAGE_PROFILES = {
  english: {
    label: 'English',
    translationCode: 'en',
    creators: ['freeCodeCamp', 'Bro Code', 'CodeWithMosh'],
    promptLine: 'Prefer English creator resources such as freeCodeCamp, Bro Code, and CodeWithMosh when they fit the topic.',
  },
  tamil: {
    label: 'Tamil',
    translationCode: 'ta',
    creators: ['Error Makes Clever', 'GUVI Tamil', 'Tamil Tech Programming'],
    promptLine: 'Prefer Tamil creator resources such as Error Makes Clever, GUVI Tamil, and other Tamil-first explainers when they fit the topic.',
  },
  hindi: {
    label: 'Hindi',
    translationCode: 'hi',
    creators: ['Apna College', 'CodeHelp', 'CodeWithHarry'],
    promptLine: 'Prefer Hindi creator resources such as Apna College, CodeHelp, and CodeWithHarry when they fit the topic.',
  },
};

const PLAN_REQUEST_TIMEOUT_MS = 12000;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || min)));
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
      // Fall through to simple comma-separated parsing.
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

function cleanTopics(topics, limit = 8) {
  return Array.from(
    new Set(
      toArray(topics)
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

function normalizePreferredLanguage(value, fallback = 'english') {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase();

  return PREP_LANGUAGE_PROFILES[normalized] ? normalized : fallback;
}

function getPreferredLanguageProfile(value) {
  return PREP_LANGUAGE_PROFILES[normalizePreferredLanguage(value)];
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

function buildSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function buildTranslatedExternalUrl(url, preferredLanguage) {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) {
    return normalizedUrl;
  }

  const language = normalizePreferredLanguage(preferredLanguage);
  if (language === 'english') {
    return normalizedUrl;
  }

  const profile = getPreferredLanguageProfile(language);
  return `https://translate.google.com/translate?sl=auto&tl=${profile.translationCode}&u=${encodeURIComponent(normalizedUrl)}`;
}

function translateReadableResource(item, preferredLanguage) {
  if (!item?.url) {
    return item;
  }

  const language = normalizePreferredLanguage(preferredLanguage);
  if (language === 'english') {
    return item;
  }

  const profile = getPreferredLanguageProfile(language);
  return {
    ...item,
    title: `${item.title} (${profile.label} translation)`,
    url: buildTranslatedExternalUrl(item.url, language),
  };
}

function buildLocalizedCreatorItems(topic, targetRole, preferredLanguage) {
  const profile = getPreferredLanguageProfile(preferredLanguage);
  const roleHint = String(targetRole || '').trim();

  return profile.creators.slice(0, 2).map((creator) => ({
    title: `${creator}: ${topic}${roleHint ? ` for ${roleHint}` : ''}`,
    type: 'youtube',
    url: buildSearchUrl(`${creator} ${topic} ${roleHint}`.trim()),
  }));
}

function titleCaseSlug(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
    .trim();
}

function extractReferenceLabelFromUrl(url, fallbackLabel = 'Reference') {
  const normalizedUrl = String(url || '').trim().replace(/\/$/, '');
  if (!normalizedUrl) {
    return normalizePlanTitle(fallbackLabel, 'Reference');
  }

  for (const profile of TOPIC_REFERENCE_BANK) {
    const directMatch = [
      ...profile.problems.map((problem) => ({ label: problem.label, url: problem.url })),
      { label: profile.article.title, url: profile.article.url },
      { label: profile.newsletter.title, url: profile.newsletter.url },
      ...profile.videos.map((video) => ({ label: video.title, url: video.url })),
    ].find((entry) => String(entry.url || '').replace(/\/$/, '') === normalizedUrl);

    if (directMatch) {
      return directMatch.label;
    }
  }

  try {
    const parsed = new URL(normalizedUrl);
    const host = parsed.hostname.toLowerCase();
    const segments = parsed.pathname.split('/').filter(Boolean);

    if (host.includes('leetcode.com')) {
      const problemIndex = segments.indexOf('problems');
      if (problemIndex >= 0 && segments[problemIndex + 1]) {
        return `LeetCode: ${titleCaseSlug(segments[problemIndex + 1])}`;
      }
    }

    if (host.includes('hackerrank.com')) {
      const challengeIndex = segments.indexOf('challenges');
      if (challengeIndex >= 0 && segments[challengeIndex + 1]) {
        return `HackerRank: ${titleCaseSlug(segments[challengeIndex + 1])}`;
      }
    }

    if (host.includes('codechef.com') && segments[1]) {
      return `CodeChef: ${segments[1].toUpperCase()}`;
    }

    if (host.includes('geeksforgeeks.org') && segments[0]) {
      return `GeeksforGeeks: ${titleCaseSlug(segments[0])}`;
    }

    if (host.includes('youtube.com') && parsed.searchParams.get('search_query')) {
      return `YouTube: ${parsed.searchParams.get('search_query')}`;
    }
  } catch {
    // Fall back to provided label.
  }

  return normalizePlanTitle(fallbackLabel, 'Reference');
}

function getRolePrepProfile(targetRole) {
  const normalizedRole = String(targetRole || '').toLowerCase();
  return ROLE_PREP_PROFILES.find((profile) => profile.pattern.test(normalizedRole)) || DEFAULT_ROLE_PREP_PROFILE;
}

function normalizeCompanyKey(value) {
  const key = String(value || 'custom')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return COMPANY_PREP_PROFILES[key] ? key : 'custom';
}

function getCompanyProfile(companyKey, customCompanyName = '') {
  const key = normalizeCompanyKey(companyKey);
  const baseProfile = COMPANY_PREP_PROFILES[key] || COMPANY_PREP_PROFILES.custom;
  const customName = normalizePlanTitle(customCompanyName, '');

  if (key !== 'custom') {
    return baseProfile;
  }

  return {
    ...baseProfile,
    label: customName || 'Custom company',
  };
}

function deriveTopicsForCompanyRole(companyProfile, targetRole, currentKnownTopics = [], currentTargetTopics = []) {
  const roleProfile = getRolePrepProfile(targetRole);
  const companyTopics = cleanTopics(companyProfile?.focusTopics || [], 6);
  const roleTopics = cleanTopics([
    ...roleProfile.biasTopics,
    ...roleProfile.practiceTopics,
    ...roleProfile.revisionTopics,
  ], 8);
  const targetTopics = cleanTopics([
    ...currentTargetTopics,
    ...companyTopics,
    ...roleTopics,
  ], 8);
  const knownTopics = cleanTopics(currentKnownTopics, 8);

  return {
    knownTopics,
    targetTopics: targetTopics.length ? targetTopics : cleanTopics(roleProfile.biasTopics, 8),
  };
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

function buildArticleUrl(topic, targetRole, preferredLanguage = 'english') {
  const article = getTopicReferenceProfile(topic, targetRole).article;
  return buildTranslatedExternalUrl(article.url, preferredLanguage);
}

function buildProblemSet(topic, targetRole) {
  return getTopicReferenceProfile(topic, targetRole).problems;
}

function buildCuratedResourceItems(topic, targetRole, preferredLanguage = 'english') {
  const profile = getTopicReferenceProfile(topic, targetRole);
  const localizedVideos = buildLocalizedCreatorItems(topic, targetRole, preferredLanguage);
  return [
    {
      title: localizedVideos[0]?.title || profile.videos[0].title,
      type: 'youtube',
      url: localizedVideos[0]?.url || profile.videos[0].url,
    },
    translateReadableResource({
      title: profile.article.title,
      type: 'article',
      url: profile.article.url,
    }, preferredLanguage),
    translateReadableResource({
      title: profile.newsletter.title,
      type: 'newsletter',
      url: profile.newsletter.url,
    }, preferredLanguage),
    {
      title: localizedVideos[1]?.title || profile.videos[1].title,
      type: 'youtube',
      url: localizedVideos[1]?.url || profile.videos[1].url,
    },
  ].filter((item) => item.url);
}

function buildProjectReference(targetRole, preferredLanguage = 'english') {
  return translateReadableResource(
    getRolePrepProfile(targetRole).projectReference || DEFAULT_ROLE_PREP_PROFILE.projectReference,
    preferredLanguage,
  );
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

function buildCompanyCoachLine(companyProfile, targetRole, prioritizedTopics) {
  const companyName = companyProfile?.label || 'your target company';
  const primaryFocus = prioritizedTopics[0] || companyProfile?.focusTopics?.[0] || 'core interview execution';
  const hiringStyle = companyProfile?.hiringStyle || 'role-specific interview readiness';

  return `${companyName} ${targetRole || 'placement'} prep starts with ${primaryFocus}. Train for ${hiringStyle}.`;
}

function buildTaskSummary({
  topic,
  revisionTopic,
  taskType,
  referenceLabel,
  targetRole,
  preferredLanguage = 'english',
  companyName = '',
  day = '',
}) {
  const languageLabel = getPreferredLanguageProfile(preferredLanguage).label;
  const normalizedTaskType = String(taskType || '').toLowerCase();
  const companyHint = companyName ? ` for ${companyName}` : '';
  const dayHint = day ? `${day}: ` : '';

  if (normalizedTaskType.includes('project')) {
    return `${dayHint}Use ${referenceLabel || 'the linked resource'} to build one small artifact around ${topic}. Define the input, the output, and one measurable improvement you can explain${companyHint} for ${targetRole || 'your target role'}. ${preferredLanguage === 'english' ? '' : `${languageLabel} reading links will open in translation where possible.`}`.trim();
  }

  if (normalizedTaskType.includes('revision')) {
    return `${dayHint}Review ${topic} with the linked reading, then explain the concept in one minute and connect it to ${revisionTopic || targetRole || 'the interview context'}${companyHint}. ${preferredLanguage === 'english' ? '' : `${languageLabel} reading links will open in translation where possible.`}`.trim();
  }

  return `${dayHint}Solve ${referenceLabel || topic} to rehearse ${topic}. Focus on naming the pattern early, choosing the right data structure, and explaining the time-space tradeoff out loud${companyHint} for ${targetRole || 'your interviews'}.`;
}

function normalizeDurationMonths(value, fallback = 1) {
  return clamp(value || fallback, 1, 12);
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

function buildRoadmap(prioritizedTopics, timePerDay, targetRole, durationMonths = 1) {
  const topics = prioritizedTopics.length
    ? prioritizedTopics
    : ['Arrays', 'Strings', 'Binary Trees', 'Graphs', 'Dynamic Programming'];
  const totalWeeks = normalizeDurationMonths(durationMonths, 1) * 4;
  const weeklyHours = Math.max(4, Math.round((timePerDay * 6) / 60));

  return Array.from({ length: totalWeeks }, (_, index) => {
    const primaryTopic = topics[index % topics.length];
    const secondaryTopic = topics[(index + 1) % topics.length] || primaryTopic;
    const isFirstPhase = index < Math.max(2, Math.ceil(totalWeeks * 0.25));
    const isFinalPhase = index >= Math.max(0, totalWeeks - 2);
    const isProjectPhase = !isFirstPhase && !isFinalPhase && index % 3 === 2;

    return {
      week: index + 1,
      title: isFirstPhase
        ? 'Foundation and pattern setup'
        : isFinalPhase
          ? 'Interview-pressure finishing pass'
          : isProjectPhase
            ? 'Applied project and review week'
            : 'Focused build week',
      focusTopics: cleanTopics([primaryTopic, secondaryTopic], 2),
      estimatedHours: weeklyHours,
      goals: [
        `Lock the core patterns for ${cleanTopics([primaryTopic, secondaryTopic], 2).join(' and ')}.`,
        `Finish one revision loop and one timed practice block for ${primaryTopic}.`,
        targetRole
          ? `Tie the learning back to ${targetRole} interview expectations.`
          : 'Tie the learning back to interview delivery.',
      ],
    };
  });
}

function buildDailyTasks(prioritizedTopics, knownTopics, timePerDay, targetRole, targetTopics = [], preferredLanguage = 'english', companyProfile = null) {
  const roleProfile = getRolePrepProfile(targetRole);
  const companyTopics = cleanTopics(companyProfile?.focusTopics || [], 5);
  const practiceTopics = cleanTopics([
    ...companyTopics.filter((topic) => !isRevisionTopic(topic)),
    ...prioritizedTopics.filter((topic) => !isRevisionTopic(topic)),
    ...targetTopics.filter((topic) => !isRevisionTopic(topic)),
    ...roleProfile.practiceTopics,
  ], 8);
  const revisionTopics = cleanTopics([
    ...companyTopics.filter((topic) => isRevisionTopic(topic)),
    ...targetTopics.filter((topic) => isRevisionTopic(topic)),
    ...prioritizedTopics.filter((topic) => isRevisionTopic(topic)),
    ...roleProfile.revisionTopics,
  ], 8);
  const projectFocus = cleanTopics([...targetTopics, ...roleProfile.biasTopics], 2).join(' + ')
    || roleProfile.projectFocus
    || targetRole
    || 'Placement project';
  const projectReference = buildProjectReference(targetRole, preferredLanguage);
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
      theme: `${companyProfile?.label ? `${companyProfile.label}: ` : ''}${primaryTopic} into ${revisionTopic}`,
      totalEstimatedMinutes: chunks.reduce((sum, minutes) => sum + minutes, 0),
      items: [
        {
          title: primaryProblem.label,
          type: practiceType,
          estimatedMinutes: chunks[0],
          difficulty: primaryProblem.difficulty,
          referenceLabel: primaryProblem.label,
          referenceUrl: primaryProblem.url,
          summary: buildTaskSummary({
            topic: primaryTopic,
            revisionTopic,
            taskType: practiceType,
            referenceLabel: primaryProblem.label,
            targetRole,
            preferredLanguage,
            companyName: companyProfile?.label,
            day,
          }),
        },
        {
          title: secondaryProblem.label,
          type: practiceType,
          estimatedMinutes: chunks[1],
          difficulty: secondaryProblem.difficulty,
          referenceLabel: secondaryProblem.label,
          referenceUrl: secondaryProblem.url,
          summary: buildTaskSummary({
            topic: secondaryTopic,
            revisionTopic,
            taskType: practiceType,
            referenceLabel: secondaryProblem.label,
            targetRole,
            preferredLanguage,
            companyName: companyProfile?.label,
            day,
          }),
        },
        {
          title: `Revision: ${revisionTopic}`,
          type: 'Revision',
          estimatedMinutes: chunks[2],
          difficulty: 'Medium',
          referenceLabel: revisionTopic,
          referenceUrl: buildArticleUrl(revisionTopic, targetRole, preferredLanguage),
          summary: buildTaskSummary({
            topic: revisionTopic,
            revisionTopic,
            taskType: 'Revision',
            referenceLabel: revisionTopic,
            targetRole,
            preferredLanguage,
            companyName: companyProfile?.label,
            day,
          }),
        },
        {
          title: `Project task: apply ${projectFocus}`,
          type: 'Project',
          estimatedMinutes: chunks[3],
          difficulty: knownTopics.length >= 3 ? 'Medium' : 'Easy',
          referenceLabel: projectReference.label,
          referenceUrl: projectReference.url,
          summary: buildTaskSummary({
            topic: projectFocus,
            revisionTopic,
            taskType: 'Project',
            referenceLabel: projectReference.label,
            targetRole,
            preferredLanguage,
            companyName: companyProfile?.label,
            day,
          }),
        },
      ],
    };
  });
}

function buildResources(prioritizedTopics, targetRole, preferredLanguage = 'english') {
  const topics = cleanTopics([...prioritizedTopics, ...getRoleBiasTopics(targetRole)], 5);

  return topics.map((topic) => ({
    topic,
    items: buildCuratedResourceItems(topic, targetRole, preferredLanguage),
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

function buildFallbackPlan({
  knownTopics,
  targetTopics,
  timePerDay,
  durationMonths = 1,
  targetRole,
  preferredLanguage = 'english',
  companyProfile = null,
  companyKey = 'custom',
  customCompanyName = '',
  planId = null,
  version = 1,
}) {
  const companyTopics = cleanTopics(companyProfile?.focusTopics || [], 5);
  const prioritizedTopics = prioritizeTopics(knownTopics, cleanTopics([...companyTopics, ...targetTopics], 8), targetRole);
  const roadmap = buildRoadmap(prioritizedTopics, timePerDay, targetRole, durationMonths);
  const tasks = buildDailyTasks(prioritizedTopics, knownTopics, timePerDay, targetRole, targetTopics, preferredLanguage, companyProfile);
  const resources = buildResources(prioritizedTopics, targetRole, preferredLanguage);
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
    durationMonths,
    targetRole,
    preferredLanguage,
    companyKey,
    customCompanyName,
    companyProfile,
    title: titles.title,
    autoTitle: titles.autoTitle,
    titleSource: titles.titleSource,
    coachLine: companyProfile
      ? buildCompanyCoachLine(companyProfile, targetRole, prioritizedTopics)
      : buildCoachLine(knownTopics, prioritizedTopics, targetRole),
    roadmap,
    tasks,
    resources,
    flashcards,
    version,
    usedFallback: true,
  };
}

function hasValidReferenceUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function resolveTaskReferencePair(item = {}, fallbackItem = {}) {
  const rawItemLabel = String(item.referenceLabel || item.title || '').trim();
  const rawFallbackLabel = String(fallbackItem.referenceLabel || fallbackItem.title || '').trim();
  const itemUrl = hasValidReferenceUrl(item.referenceUrl) ? String(item.referenceUrl).trim() : '';
  const fallbackUrl = hasValidReferenceUrl(fallbackItem.referenceUrl) ? String(fallbackItem.referenceUrl).trim() : '';

  if (itemUrl) {
    return {
      referenceLabel: extractReferenceLabelFromUrl(itemUrl, rawItemLabel || rawFallbackLabel || 'Reference'),
      referenceUrl: itemUrl,
    };
  }

  return {
    referenceLabel: extractReferenceLabelFromUrl(fallbackUrl, rawFallbackLabel || rawItemLabel || 'Reference'),
    referenceUrl: fallbackUrl || null,
  };
}

function buildTaskDisplayTitle(item = {}, fallbackItem = {}, reference = { referenceLabel: null }) {
  const normalizedType = String(item.type || fallbackItem.type || '').trim().toLowerCase();
  const fallbackTitle = String(fallbackItem.title || '').trim();
  const itemTitle = String(item.title || '').trim();
  const referenceLabel = String(reference.referenceLabel || '').trim();

  if ((normalizedType === 'dsa' || normalizedType === 'practice') && referenceLabel) {
    return referenceLabel;
  }

  if (normalizedType === 'revision' && referenceLabel) {
    return `Revision: ${referenceLabel}`;
  }

  if (normalizedType === 'project' && referenceLabel && !itemTitle) {
    return `Project task: ${referenceLabel}`;
  }

  return itemTitle || fallbackTitle || referenceLabel || 'Focused task';
}

function normalizeLabelForComparison(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^(leetcode|hackerrank|codechef|geeksforgeeks|youtube)\s*:\s*/i, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(problem|task|practice|revision|project)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function labelsLookRelated(left, right) {
  const normalizedLeft = normalizeLabelForComparison(left);
  const normalizedRight = normalizeLabelForComparison(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (
    normalizedLeft === normalizedRight
    || normalizedLeft.includes(normalizedRight)
    || normalizedRight.includes(normalizedLeft)
  ) {
    return true;
  }

  const leftTokens = Array.from(new Set(normalizedLeft.split(' ').filter((token) => token.length > 2)));
  const rightTokens = Array.from(new Set(normalizedRight.split(' ').filter((token) => token.length > 2)));

  if (!leftTokens.length || !rightTokens.length) {
    return false;
  }

  const overlap = rightTokens.filter((token) => leftTokens.includes(token)).length;
  return overlap >= Math.min(2, Math.min(leftTokens.length, rightTokens.length));
}

function isDirectPracticeUrl(url) {
  if (!hasValidReferenceUrl(url)) {
    return false;
  }

  try {
    const parsed = new URL(String(url).trim());
    const host = parsed.hostname.toLowerCase();
    const segments = parsed.pathname.split('/').filter(Boolean);

    if (host.includes('leetcode.com')) {
      const problemIndex = segments.indexOf('problems');
      return problemIndex >= 0 && Boolean(segments[problemIndex + 1]);
    }

    if (host.includes('hackerrank.com')) {
      const challengeIndex = segments.indexOf('challenges');
      return challengeIndex >= 0 && Boolean(segments[challengeIndex + 1]);
    }

    if (host.includes('codechef.com')) {
      const problemsIndex = segments.indexOf('problems');
      return problemsIndex >= 0 && Boolean(segments[problemsIndex + 1]);
    }
  } catch {
    return false;
  }

  return false;
}

function resolveBestTaskReferencePair(item = {}, fallbackItem = {}) {
  const normalizedType = String(item.type || fallbackItem.type || '').trim().toLowerCase();
  const itemReference = resolveTaskReferencePair(item, fallbackItem);
  const fallbackReference = resolveTaskReferencePair(fallbackItem, fallbackItem);

  if (normalizedType === 'dsa' || normalizedType === 'practice') {
    const itemSignal = String(item.referenceLabel || item.title || '').trim();
    const itemLooksRelated = labelsLookRelated(itemSignal, itemReference.referenceLabel);

    if (isDirectPracticeUrl(itemReference.referenceUrl) && itemLooksRelated) {
      return itemReference;
    }

    return fallbackReference.referenceUrl ? fallbackReference : itemReference;
  }

  return itemReference.referenceUrl ? itemReference : fallbackReference;
}

function normalizeStoredPlanShape(plan) {
  if (!plan) {
    return null;
  }

  return {
    ...plan,
    knownTopics: cleanTopics(plan.knownTopics, 8),
    targetTopics: cleanTopics(plan.targetTopics, 8),
    roadmap: toArray(plan.roadmap).map((week, index) => ({
      week: Number(week?.week || index + 1),
      title: String(week?.title || `Week ${index + 1}`).trim(),
      focusTopics: cleanTopics(week?.focusTopics || week?.topics || [], 3),
      estimatedHours: clamp(week?.estimatedHours || 12, 4, 30),
      goals: cleanTopics(week?.goals || [], 4),
    })),
    tasks: toArray(plan.tasks).map((dayPlan, dayIndex) => ({
      day: String(dayPlan?.day || `Day ${dayIndex + 1}`).trim(),
      theme: String(dayPlan?.theme || 'Focused prep').trim(),
      totalEstimatedMinutes: clamp(dayPlan?.totalEstimatedMinutes || 120, 60, 480),
      items: toArray(dayPlan?.items).map((item, itemIndex) => {
        const reference = resolveBestTaskReferencePair(item, item);
        return {
          title: buildTaskDisplayTitle(item, item, reference) || `Task ${itemIndex + 1}`,
          type: String(item?.type || 'DSA').trim(),
          estimatedMinutes: clamp(item?.estimatedMinutes || 30, 10, 240),
          difficulty: String(item?.difficulty || 'Medium').trim(),
          referenceLabel: reference.referenceLabel,
          referenceUrl: reference.referenceUrl,
          summary: String(item?.summary || '').trim() || null,
        };
      }),
    })),
    resources: toArray(plan.resources).map((group) => ({
      topic: String(group?.topic || '').trim(),
      items: toArray(group?.items).map((item) => ({
        title: String(item?.title || '').trim(),
        type: String(item?.type || 'article').trim(),
        url: String(item?.url || '').trim(),
      })).filter((item) => item.title && hasValidReferenceUrl(item.url)),
    })).filter((group) => group.topic),
    flashcards: toArray(plan.flashcards).map((card) => ({
      topic: String(card?.topic || '').trim(),
      question: String(card?.question || '').trim(),
      answer: String(card?.answer || '').trim(),
    })).filter((card) => card.topic && card.question && card.answer),
  };
}

function normalizeForDedupe(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function repairTaskSummaries(tasks, fallbackPlan) {
  const seen = new Set();
  const companyName = fallbackPlan.companyProfile?.label || '';

  return tasks.map((dayPlan, dayIndex) => ({
    ...dayPlan,
    items: toArray(dayPlan.items).map((item, itemIndex) => {
      const fallbackItem = fallbackPlan.tasks[dayIndex]?.items?.[itemIndex] || {};
      const rawSummary = String(item.summary || fallbackItem.summary || '').trim();
      const key = normalizeForDedupe(rawSummary);
      const shouldRepair = !rawSummary || seen.has(key);
      const repairedSummary = shouldRepair
        ? buildTaskSummary({
            topic: item.referenceLabel || item.title || dayPlan.theme,
            revisionTopic: dayPlan.theme,
            taskType: item.type,
            referenceLabel: item.referenceLabel || item.title,
            targetRole: fallbackPlan.targetRole,
            preferredLanguage: fallbackPlan.preferredLanguage,
            companyName,
            day: dayPlan.day || `Day ${dayIndex + 1}`,
          })
        : rawSummary;

      seen.add(normalizeForDedupe(repairedSummary));
      return {
        ...item,
        summary: repairedSummary,
      };
    }),
  }));
}

function repairFlashcards(flashcards, fallbackPlan) {
  const seenAnswers = new Set();
  const companyName = fallbackPlan.companyProfile?.label || '';

  return toArray(flashcards).map((card, index) => {
    const topic = String(card.topic || fallbackPlan.flashcards[index]?.topic || 'Prep').trim();
    const answer = String(card.answer || '').trim();
    const answerKey = normalizeForDedupe(answer);

    if (answer && !seenAnswers.has(answerKey)) {
      seenAnswers.add(answerKey);
      return card;
    }

    const repaired = {
      topic,
      question: String(card.question || `How should you explain ${topic} under interview pressure?`).trim(),
      answer: `${companyName ? `${companyName} focus: ` : ''}Define ${topic}, name the tradeoff, then connect it to ${fallbackPlan.targetRole || 'the role'} using one concrete task from the plan.`,
    };
    seenAnswers.add(normalizeForDedupe(repaired.answer));
    return repaired;
  });
}

function normalizePlanResult(rawPlan, fallbackPlan) {
  const rawRoadmap = toArray(rawPlan?.roadmap);
  const rawTaskDays = toArray(rawPlan?.tasks);
  const rawFlashcards = toArray(rawPlan?.flashcards);
  const relevantTopics = cleanTopics([
    ...fallbackPlan.targetTopics,
    ...(fallbackPlan.companyProfile?.focusTopics || []),
    ...getRoleBiasTopics(fallbackPlan.targetRole),
    ...fallbackPlan.knownTopics,
  ], 12);

  const roadmap = rawRoadmap.length
    ? rawRoadmap.slice(0, fallbackPlan.roadmap.length).map((week, index) => ({
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

  const tasks = rawTaskDays.length
    ? rawTaskDays.slice(0, 5).map((dayPlan, index) => {
      const rawTheme = String(dayPlan.theme || '');
      const hasRelevantTheme = matchesRelevantTopic(rawTheme, relevantTopics);
      const dayItems = toArray(dayPlan.items);
      const hasRelevantItems = dayItems.length && dayItems.some((item) => (
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
            || dayItems.reduce((sum, item) => sum + Number(item?.estimatedMinutes || 0), 0)
            || fallbackPlan.tasks[index]?.totalEstimatedMinutes
            || 120,
          60,
          480
        ),
        items: dayItems.length
          ? dayItems.slice(0, 4).map((item, itemIndex) => {
            const fallbackItem = fallbackPlan.tasks[index]?.items[itemIndex] || {};
            const reference = resolveBestTaskReferencePair(item, fallbackItem);
            const normalizedType = String(item.type || fallbackItem.type || 'DSA').trim();

            return {
              title: buildTaskDisplayTitle(item, fallbackItem, reference),
              type: normalizedType,
              estimatedMinutes: clamp(item.estimatedMinutes || fallbackItem.estimatedMinutes || 30, 10, 240),
              difficulty: String(item.difficulty || fallbackItem.difficulty || 'Medium').trim(),
              referenceLabel: reference.referenceLabel,
              referenceUrl: reference.referenceUrl,
              summary: String(item.summary || fallbackItem.summary || '').trim() || null,
            };
          })
          : fallbackPlan.tasks[index]?.items || [],
      };
    })
    : fallbackPlan.tasks;

  const resources = fallbackPlan.resources;

  const flashcards = rawFlashcards.length
    ? rawFlashcards.slice(0, 10).map((card, index) => {
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
    tasks: repairTaskSummaries(tasks, fallbackPlan),
    resources,
    flashcards: repairFlashcards(flashcards, fallbackPlan),
  };
}

function requestPlanJson(systemPrompt, userPrompt, fallbackFactory) {
  return aiGateway.requestJson(systemPrompt, userPrompt, fallbackFactory, {
    label: 'prep-architect-plan',
    timeoutMs: PLAN_REQUEST_TIMEOUT_MS,
  });
}

function hydrateStoredPlan(plan) {
  if (!plan) {
    return null;
  }

  const normalizedPlan = normalizeStoredPlanShape(plan);
  const titles = resolvePlanTitles({
    targetRole: normalizedPlan.targetRole,
    targetTopics: normalizedPlan.targetTopics,
    roadmap: normalizedPlan.roadmap,
    tasks: normalizedPlan.tasks,
  }, typeof normalizedPlan.metadata?.title === 'string' ? normalizedPlan.metadata.title : '', normalizedPlan.metadata?.titleSource === 'custom' ? 'custom' : 'generated');

  return {
    ...normalizedPlan,
    durationMonths: normalizeDurationMonths(normalizedPlan.durationMonths || normalizedPlan.metadata?.durationMonths || 1, 1),
    preferredLanguage: normalizePreferredLanguage(normalizedPlan.preferredLanguage || normalizedPlan.metadata?.preferredLanguage || 'english'),
    companyKey: normalizedPlan.metadata?.company?.key || 'custom',
    companyName: normalizedPlan.metadata?.company?.label || normalizedPlan.metadata?.company?.customCompanyName || null,
    customCompanyName: normalizedPlan.metadata?.company?.customCompanyName || '',
    title: titles.title,
    autoTitle: titles.autoTitle,
    titleSource: titles.titleSource,
    coachLine: typeof normalizedPlan.metadata?.coachLine === 'string' ? normalizedPlan.metadata.coachLine : null,
    usedFallback: Boolean(normalizedPlan.metadata?.usedFallback),
  };
}

function buildPriorPlanTaskLookup(previousTasks = []) {
  const byDayIndex = new Map();
  const byDayTitle = new Map();

  previousTasks.forEach((task) => {
    const rawIndex = task?.metadata?.itemIndex;
    const rawDayIndex = task?.metadata?.planDayIndex;
    const itemIndex = Number.isInteger(Number(rawIndex)) ? Number(rawIndex) : null;
    const dayIndex = Number.isInteger(Number(rawDayIndex)) ? Number(rawDayIndex) : null;
    if (itemIndex !== null && dayIndex !== null) {
      byDayIndex.set(`${dayIndex}:${itemIndex}`, task);
    }

    const normalizedTitle = String(task?.title || '').trim().toLowerCase();
    if (normalizedTitle && dayIndex !== null) {
      byDayTitle.set(`${dayIndex}:${normalizedTitle}`, task);
    }
  });

  return { byDayIndex, byDayTitle };
}

function dateDiffDays(left, right) {
  const leftDate = String(left || '').slice(0, 10);
  const rightDate = String(right || '').slice(0, 10);
  const [leftYear, leftMonth, leftDay] = leftDate.split('-').map(Number);
  const [rightYear, rightMonth, rightDay] = rightDate.split('-').map(Number);
  const leftTime = Date.UTC(leftYear || 1970, (leftMonth || 1) - 1, leftDay || 1);
  const rightTime = Date.UTC(rightYear || 1970, (rightMonth || 1) - 1, rightDay || 1);

  return Math.max(0, Math.floor((leftTime - rightTime) / 86400000));
}

function getPlanDayIndex(plan, scheduledFor) {
  const taskDays = toArray(plan.tasks);
  if (!taskDays.length) {
    return 0;
  }

  const startDate = String(plan.createdAt || new Date().toISOString()).slice(0, 10);
  return dateDiffDays(scheduledFor, startDate) % taskDays.length;
}

function extractProblemSlug(value) {
  const text = String(value || '').trim();
  const leetCodeMatch = text.match(/leetcode\.com\/problems\/([^/?#]+)/i);
  if (leetCodeMatch?.[1]) {
    return leetCodeMatch[1].trim().toLowerCase();
  }

  if (/^[a-z0-9-]+$/i.test(text) && text.includes('-')) {
    return text.toLowerCase();
  }

  return '';
}

function inferProblemPlatform(item = {}) {
  const combined = [
    item.referenceUrl,
    item.referenceLabel,
    item.title,
  ].join(' ');

  if (/leetcode/i.test(combined)) {
    return 'leetcode';
  }
  if (/hackerrank/i.test(combined)) {
    return 'hackerrank';
  }
  if (/codechef/i.test(combined)) {
    return 'codechef';
  }
  if (/sql|dbms|database/i.test(combined)) {
    return 'sql';
  }

  return 'custom';
}

function isCodingLabCandidate(item = {}) {
  const combined = [
    item.type,
    item.title,
    item.referenceLabel,
    item.referenceUrl,
    item.summary,
  ].join(' ');

  return /dsa|coding|leetcode|hackerrank|codechef|algorithm|sql|dbms|database|array|string|tree|graph|stack|queue|dynamic|recursion|backtracking/i.test(combined);
}

function planTasksForSync(plan, planId, previousTasks = [], scheduledFor = null) {
  const planDayIndex = getPlanDayIndex(plan, scheduledFor || getTodayInTimezone('Asia/Calcutta'));
  const activeDay = plan.tasks[planDayIndex] || plan.tasks[0];
  if (!activeDay?.items?.length) {
    return [];
  }

  const lookup = buildPriorPlanTaskLookup(previousTasks);

  return activeDay.items.slice(0, 4).map((item, index) => {
    const normalizedTitle = String(item.title || '').trim().toLowerCase();
    const matchedTask = lookup.byDayIndex.get(`${planDayIndex}:${index}`)
      || lookup.byDayTitle.get(`${planDayIndex}:${normalizedTitle}`)
      || null;
    const platform = inferProblemPlatform(item);
    const codingLabEnabled = isCodingLabCandidate(item);
    const problemSlug = extractProblemSlug(item.referenceUrl || item.referenceLabel || item.title);
    const description = item.summary || `${activeDay.day}: ${item.title} inside ${activeDay.theme}`;

    return {
      title: item.title,
      description,
      category: item.type === 'Project' ? 'Project' : item.type === 'Revision' ? 'Core' : 'DSA',
      subcategory: activeDay.theme,
      status: matchedTask?.status || 'pending',
      priority: index <= 1 ? 'high' : 'medium',
      intensity: item.type === 'Project' ? 'high' : 'medium',
      referenceLabel: item.referenceLabel || null,
      referenceUrl: item.referenceUrl || null,
      estimatedMinutes: clamp(item.estimatedMinutes, 10, 240),
      actualMinutes: Number(matchedTask?.actualMinutes || 0),
      difficulty: /easy/i.test(item.difficulty) ? 2 : /hard/i.test(item.difficulty) ? 4 : 3,
      weakArea: activeDay.theme,
      aiGenerated: true,
      metadata: {
        source: 'prep-architect',
        planId,
        day: activeDay.day,
        planDay: activeDay.day,
        planDayIndex,
        theme: activeDay.theme,
        itemIndex: index,
        summary: description,
        bundleTitle: `${activeDay.day || `Day ${planDayIndex + 1}`} Tasks`,
        codingLabEnabled,
        problemPlatform: platform,
        problemSlug: problemSlug || null,
        problemTitle: item.referenceLabel || item.title,
        problemUrl: item.referenceUrl || null,
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
  const tasksToCreate = planTasksForSync(plan, plan.id, previousTasks, scheduledFor);

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

async function ensureTodayTasksForActivePlan(user) {
  const activePlan = await prepPlanRepository.findLatestActiveByUser(user.id);
  const hydratedPlan = hydrateStoredPlan(activePlan);

  if (!hydratedPlan) {
    return [];
  }

  const existingTasks = await syncTodayTasks(user, hydratedPlan);
  return existingTasks || taskRepository.listPrepArchitectTasksByPlanAndDate(
    user.id,
    hydratedPlan.id,
    getTodayInTimezone(user.timezone),
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
    nextCoachMetadata.prepArchitectLanguage = plan.preferredLanguage || plan.metadata?.preferredLanguage || 'english';
    nextCoachMetadata.prepArchitectCompany = plan.companyName || plan.metadata?.company?.label || null;
  } else {
    delete nextCoachMetadata.prepArchitectUpdatedAt;
    delete nextCoachMetadata.prepArchitectPlanId;
    delete nextCoachMetadata.prepArchitectPlanTitle;
    delete nextCoachMetadata.prepArchitectCoachLine;
    delete nextCoachMetadata.prepArchitectLanguage;
    delete nextCoachMetadata.prepArchitectCompany;
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
      durationMonths: plan.durationMonths,
      targetRole: plan.targetRole,
      version,
      sourcePlanId,
      metadata: {
        title: titles.title,
        autoTitle: titles.autoTitle,
        titleSource: titles.titleSource,
        coachLine: plan.coachLine,
        usedFallback: plan.usedFallback,
        durationMonths: plan.durationMonths,
        preferredLanguage: normalizePreferredLanguage(plan.preferredLanguage || 'english'),
        company: {
          key: plan.companyKey || plan.companyProfile?.key || 'custom',
          label: plan.companyProfile?.label || plan.customCompanyName || 'Custom company',
          customCompanyName: plan.customCompanyName || '',
          hiringStyle: plan.companyProfile?.hiringStyle || null,
          interviewLoop: plan.companyProfile?.interviewLoop || [],
          focusTopics: plan.companyProfile?.focusTopics || [],
          practiceSignals: plan.companyProfile?.practiceSignals || [],
        },
        ai: plan.aiDiagnostics || null,
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
    durationMonths: plan.durationMonths,
    targetRole: plan.targetRole,
    preferredLanguage: normalizePreferredLanguage(plan.preferredLanguage || 'english'),
    companyKey: plan.companyKey || plan.companyProfile?.key || 'custom',
    companyName: plan.companyProfile?.label || plan.customCompanyName || 'Custom company',
    customCompanyName: plan.customCompanyName || '',
    usedFallback: plan.usedFallback,
  };

  await syncUserWithActivePlan(user, finalPlan);
  await syncTodayTasks(user, finalPlan);
  await progressService.refreshProgressStats(user.id, user.timezone);

  return finalPlan;
}

function triggerPlanReadyEmail(user, plan) {
  const timer = setTimeout(() => {
    void sendPlanReadyEmail({ user, plan })
      .then((result) => {
        if (result?.attempted && !result.sent) {
          console.error('[prep-architect] Plan ready email was not sent.', result.reason);
        }
      })
      .catch((error) => {
        console.error('[prep-architect] Plan ready email dispatch failed.', error);
      });
  }, 0);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

function buildPlanRequestPayload(user, payload = {}, currentPlan = null) {
  const timePerDay = clamp(payload.timePerDay || currentPlan?.timePerDay || 120, 60, 480);
  const durationMonths = normalizeDurationMonths(payload.durationMonths || currentPlan?.durationMonths || currentPlan?.metadata?.durationMonths || 1, 1);
  const targetRole = String(payload.targetRole || currentPlan?.targetRole || user.targetRole || 'Placement Engineer').trim();
  const preferredLanguage = normalizePreferredLanguage(payload.preferredLanguage || currentPlan?.preferredLanguage || currentPlan?.metadata?.preferredLanguage || 'english');
  const currentCompany = currentPlan?.metadata?.company || {};
  const companyKey = normalizeCompanyKey(payload.companyKey || currentCompany.key || 'custom');
  const customCompanyName = normalizePlanTitle(payload.customCompanyName || currentCompany.customCompanyName || currentCompany.label || '');
  const companyProfile = getCompanyProfile(companyKey, customCompanyName);
  const derivedTopics = deriveTopicsForCompanyRole(
    companyProfile,
    targetRole,
    payload.knownTopics || currentPlan?.knownTopics || user.strongTopics,
    payload.targetTopics || currentPlan?.targetTopics || user.weakAreas,
  );

  return {
    knownTopics: derivedTopics.knownTopics,
    targetTopics: derivedTopics.targetTopics,
    timePerDay,
    durationMonths,
    targetRole,
    preferredLanguage,
    companyKey,
    customCompanyName: companyKey === 'custom' ? customCompanyName : '',
    companyProfile,
  };
}

async function generatePlan(user, payload = {}) {
  await tierService.assertCanUse(user, 'plan_generations');

  const input = buildPlanRequestPayload(user, payload);
  const fallbackPlan = buildFallbackPlan(input);

  const aiResult = await requestPlanJson(
    'Act as a placement preparation coach. Return only JSON with title, roadmap, tasks, resources, flashcards, and coachLine.',
    [
      'Act as a placement preparation coach.',
      '',
      `Target company: ${input.companyProfile.label}`,
      `Company hiring style: ${input.companyProfile.hiringStyle}`,
      `Likely interview loop: ${input.companyProfile.interviewLoop.join('; ')}`,
      `Signals to practice: ${input.companyProfile.practiceSignals.join('; ')}`,
      `Server-derived preparation focus: ${input.targetTopics.join(', ')}`,
      `Time per day: ${input.timePerDay} minutes`,
      `Plan duration: ${input.durationMonths} month${input.durationMonths === 1 ? '' : 's'}`,
      `Target role: ${input.targetRole}`,
      `Preferred language: ${getPreferredLanguageProfile(input.preferredLanguage).label}`,
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
      `* ${getPreferredLanguageProfile(input.preferredLanguage).promptLine}`,
      '* Build specifically for the selected company and role. Keep the server-derived focus visible in the roadmap, tasks, and resources.',
      '* Make the daily work role-aware: data analyst plans should lean into SQL, analysis, dashboards, and insight delivery; data engineer plans should lean into pipelines, modeling, warehousing, and orchestration; software roles should lean into coding patterns, CS fundamentals, and systems.',
      '* Keep the roadmap and daily tasks tightly relevant to the provided topics. Do not introduce random focus areas outside the chosen role and target topics.',
      '* Focus on weak areas',
      '* Keep it realistic',
      '* No fluff',
      '* Avoid broad generic search links when a direct problem or targeted creator search is possible',
      '* For readable article or newsletter resources, prefer URLs that can be translated when the preferred language is not English.',
      '* Every task item should include a short actionable summary under the key "summary".',
      '* Generate at least 5 daily task groups. Every day needs a distinct theme and every task needs a distinct summary.',
      '* Do not repeat flashcard answers. Each answer must connect to a different interview signal or planned task.',
      '',
      'Return JSON in this exact shape:',
      '{',
      '  "title": "string",',
      '  "coachLine": "string",',
      '  "roadmap": [{ "week": 1, "title": "string", "focusTopics": ["string"], "estimatedHours": 12, "goals": ["string"] }],',
      '  "tasks": [{ "day": "Day 1", "theme": "string", "totalEstimatedMinutes": 120, "items": [{ "title": "string", "type": "DSA", "estimatedMinutes": 30, "difficulty": "Easy", "referenceLabel": "string", "referenceUrl": "https://...", "summary": "string" }] }],',
      '  "resources": [{ "topic": "string", "items": [{ "title": "string", "type": "youtube", "url": "https://..." }] }],',
      '  "flashcards": [{ "topic": "string", "question": "string", "answer": "string" }]',
      '}',
    ].join('\n'),
    () => fallbackPlan
  );

  const normalizedPlan = normalizePlanResult(aiResult.data, fallbackPlan);

  const plan = await persistPlan(user, {
    ...input,
    ...normalizedPlan,
    preferredLanguage: input.preferredLanguage,
    usedFallback: aiResult.usedFallback,
    aiDiagnostics: {
      provider: aiResult.provider || null,
      model: aiResult.model || null,
      attempts: aiResult.attempts || [],
      usedFallback: aiResult.usedFallback,
      fallbackReason: aiResult.fallbackReason || null,
    },
  });
  await tierService.consumeFeature(user, 'plan_generations');
  triggerPlanReadyEmail(user, plan);
  return plan;
}

async function updatePlan(user, payload = {}) {
  await tierService.assertCanUse(user, 'plan_generations');

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

  const aiResult = await requestPlanJson(
    'Act as a placement preparation coach. Return only JSON with title, roadmap, tasks, resources, flashcards, and coachLine.',
    [
      'Act as a placement preparation coach.',
      '',
      `Current plan id: ${currentPlan.id}`,
      `Target company: ${input.companyProfile.label}`,
      `Company hiring style: ${input.companyProfile.hiringStyle}`,
      `Likely interview loop: ${input.companyProfile.interviewLoop.join('; ')}`,
      `Signals to practice: ${input.companyProfile.practiceSignals.join('; ')}`,
      `Server-derived preparation focus: ${input.targetTopics.join(', ')}`,
      `Time per day: ${input.timePerDay} minutes`,
      `Plan duration: ${input.durationMonths} month${input.durationMonths === 1 ? '' : 's'}`,
      `Target role: ${input.targetRole}`,
      `Preferred language: ${getPreferredLanguageProfile(input.preferredLanguage).label}`,
      '',
      'Regenerate the title, roadmap, tasks, resources, and flashcards while keeping the plan realistic and editable.',
      getPreferredLanguageProfile(input.preferredLanguage).promptLine,
      'Build specifically for the selected company and role, using the server-derived preparation focus.',
      'For data analyst and data engineer roles, lean into SQL, analytics, pipelines, warehousing, dashboards, and role-specific project work when relevant.',
      'Keep the plan tightly relevant to the supplied target topics. Avoid drifting into unrelated areas.',
      'Make flashcards specific to the planned work and useful for fast recall under interview pressure.',
      'Use direct, specific practice problems instead of broad problem-set searches whenever possible.',
      'Prefer creator-specific YouTube resources and direct articles/newsletters over generic searches.',
      'For readable article or newsletter resources, prefer URLs that can be translated when the preferred language is not English.',
      'Every task item must include a short actionable summary under the key "summary".',
      'Generate at least 5 daily task groups with distinct themes and unique task summaries.',
      'Do not repeat flashcard answers; connect each one to a different interview signal or planned task.',
      'Return the same JSON structure as the original plan generation request.',
    ].join('\n'),
    () => fallbackPlan
  );

  const normalizedPlan = normalizePlanResult(aiResult.data, fallbackPlan);

  const plan = await persistPlan(user, {
    ...input,
    ...normalizedPlan,
    preferredLanguage: input.preferredLanguage,
    usedFallback: aiResult.usedFallback,
    aiDiagnostics: {
      provider: aiResult.provider || null,
      model: aiResult.model || null,
      attempts: aiResult.attempts || [],
      usedFallback: aiResult.usedFallback,
      fallbackReason: aiResult.fallbackReason || null,
    },
  }, currentPlan.id);
  await tierService.consumeFeature(user, 'plan_generations');
  triggerPlanReadyEmail(user, plan);
  return plan;
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
  ensureTodayTasksForActivePlan,
};
