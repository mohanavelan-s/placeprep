export const PLACEMENT_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

export const USER_STATS = {
  focusScore: 78,
  disciplineIndex: 82,
  executionRate: 64,
  totalHoursLogged: 84,
  missionsCompleted: 67,
  streak: 7,
  bonusStreak: 3,
};

export const TODAY_MISSIONS = [
  { id: "1", title: "Two Sum", ref: "LC #1", category: "DSA", intensity: "Low", timeEstimate: 15, completed: true },
  { id: "2", title: "Reverse Linked List", ref: "LC #206", category: "DSA", intensity: "Low", timeEstimate: 20, completed: true },
  { id: "3", title: "Binary Tree Level Order", ref: "LC #102", category: "DSA", intensity: "Mid", timeEstimate: 30, completed: false },
  { id: "4", title: "Polymorphism & Abstraction", ref: "Core", category: "OOPS", intensity: "Theory", timeEstimate: 25, completed: false },
  { id: "5", title: "Normalization 1NF–3NF", ref: "Core", category: "DBMS", intensity: "Theory", timeEstimate: 20, completed: false },
  { id: "6", title: "REST API Endpoints", ref: "Build", category: "Project", intensity: "Execution", timeEstimate: 45, completed: false },
];

export const WEEKLY_PROGRESS = [
  { day: "M", missions: 5, hours: 4.5 },
  { day: "T", missions: 7, hours: 5.2 },
  { day: "W", missions: 4, hours: 3.8 },
  { day: "T", missions: 8, hours: 6.0 },
  { day: "F", missions: 6, hours: 5.5 },
  { day: "S", missions: 10, hours: 7.0 },
  { day: "S", missions: 3, hours: 4.0 },
];

export const TOPIC_STRENGTH = [
  { topic: "Arrays", strength: 85 },
  { topic: "Strings", strength: 72 },
  { topic: "Linked Lists", strength: 60 },
  { topic: "Trees", strength: 45 },
  { topic: "Graphs", strength: 30 },
  { topic: "DP", strength: 20 },
  { topic: "SQL", strength: 68 },
  { topic: "OOPS", strength: 55 },
  { topic: "OS", strength: 40 },
  { topic: "DBMS", strength: 50 },
];
