const { randomUUID } = require('crypto');

const { withTransaction } = require('../config/database');
const AppError = require('../utils/appError');
const { normalizeDate } = require('../utils/date');
const userRepository = require('../repositories/user.repository');
const taskRepository = require('../repositories/task.repository');
const imageRepository = require('../repositories/image.repository');
const progressRepository = require('../repositories/progress.repository');

function buildTaskSummaryMap(rows) {
  return new Map(rows.map((row) => [row.userId, row]));
}

function groupRowsByUser(rows) {
  return rows.reduce((map, row) => {
    const existing = map.get(row.userId) || [];
    existing.push(row);
    map.set(row.userId, existing);
    return map;
  }, new Map());
}

function toSafeString(value) {
  return String(value || '').trim();
}

function buildCapsuleTaskMetadata(adminUser, student, bundleId, payload, capsuleType) {
  return {
    shareKind: 'admin-practice-link',
    bundleId,
    bundleTitle: toSafeString(payload.title) || 'Admin practice capsule',
    bundleNote: toSafeString(payload.note) || null,
    capsuleType,
    assignedByAdminId: adminUser.id,
    assignedByAdminName: adminUser.name,
    studentUserId: student.id,
    createdFrom: 'coach-practice-capsule',
  };
}

function groupPracticeCapsules(tasks) {
  const grouped = new Map();

  for (const task of tasks) {
    const metadata = task.metadata || {};
    const bundleId = metadata.bundleId || task.id;
    const existing = grouped.get(bundleId) || {
      bundleId,
      title: metadata.bundleTitle || 'Admin practice capsule',
      note: metadata.bundleNote || null,
      studentUserId: task.userId,
      assignedById: metadata.assignedByAdminId || null,
      assignedByName: metadata.assignedByAdminName || null,
      scheduledFor: task.scheduledFor,
      createdAt: task.createdAt,
      items: [],
    };

    existing.items.push({
      taskId: task.id,
      title: task.title,
      category: task.category,
      status: task.status,
      referenceLabel: task.referenceLabel || null,
      referenceUrl: task.referenceUrl || null,
      capsuleType: metadata.capsuleType || 'resource',
      scheduledFor: task.scheduledFor,
      createdAt: task.createdAt,
    });

    grouped.set(bundleId, existing);
  }

  return Array.from(grouped.values())
    .map((bundle) => ({
      ...bundle,
      items: bundle.items.sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function listStudentsForAdmin() {
  const students = await userRepository.listStudentsForOversight();
  if (!students.length) {
    return [];
  }

  const userIds = students.map((student) => student.id);
  const [latestStats, taskSummaries, recentProofs, recentPracticeTasks] = await Promise.all([
    progressRepository.listLatestByUsers(userIds),
    taskRepository.listSummaryByUsers(userIds),
    imageRepository.listRecentByUsers(userIds, 4),
    taskRepository.listRecentAdminPracticeTasksByUsers(userIds, 12),
  ]);

  const latestStatMap = new Map(latestStats.map((stat) => [stat.userId, stat]));
  const taskSummaryMap = buildTaskSummaryMap(taskSummaries);
  const proofsByUser = groupRowsByUser(recentProofs);
  const practiceTasksByUser = groupRowsByUser(recentPracticeTasks);

  return students.map((student) => {
    const latestStat = latestStatMap.get(student.id) || null;
    const summary = taskSummaryMap.get(student.id) || {
      userId: student.id,
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      skipped: 0,
      overdue: 0,
    };

    return {
      student,
      invitedBy: {
        id: student.inviterId || null,
        name: student.inviterName || null,
        username: student.inviterUsername || null,
        inviteCode: student.inviteCode || null,
        invitedAt: student.inviteAcceptedAt || student.createdAt,
      },
      progress: {
        streak: student.currentStreak || 0,
        consistencyScore: student.consistencyScore || 0,
        readinessScore: student.readinessScore || 0,
        solvedProblems: student.solvedProblems || 0,
        averageTimePerProblem: student.averageTimePerProblem || 0,
        failedAttempts: student.failedAttempts || 0,
        totalHours: latestStat?.totalHours || 0,
        tasksCompleted: latestStat?.tasksCompleted || 0,
        statDate: latestStat?.statDate || null,
        weeklyProgress: latestStat?.metadata?.weeklyProgress || [],
        topicStrength: latestStat?.metadata?.topicStrength || [],
      },
      taskSummary: summary,
      recentProofs: proofsByUser.get(student.id) || [],
      practiceCapsules: groupPracticeCapsules(practiceTasksByUser.get(student.id) || []).slice(0, 3),
    };
  });
}

async function createPracticeCapsule(adminUser, payload) {
  const student = await userRepository.findById(payload.studentUserId);

  if (!student || student.role !== 'user') {
    throw new AppError('Student account not found.', 404);
  }

  const bundleId = randomUUID();
  const scheduledFor = normalizeDate(payload.scheduledFor, student.timezone || adminUser.timezone);
  const bundleTitle = toSafeString(payload.title) || 'Admin practice capsule';
  const bundleNote = toSafeString(payload.note) || null;

  const capsuleTasks = [
    {
      title: toSafeString(payload.leetcodeOneLabel) || 'LeetCode Drill 1',
      category: 'DSA',
      subcategory: 'Admin capsule',
      referenceLabel: toSafeString(payload.leetcodeOneLabel) || 'LeetCode question 1',
      referenceUrl: payload.leetcodeOneUrl,
      estimatedMinutes: 45,
      weakArea: 'DSA',
      difficulty: 3,
      capsuleType: 'leetcode_one',
    },
    {
      title: toSafeString(payload.leetcodeTwoLabel) || 'LeetCode Drill 2',
      category: 'DSA',
      subcategory: 'Admin capsule',
      referenceLabel: toSafeString(payload.leetcodeTwoLabel) || 'LeetCode question 2',
      referenceUrl: payload.leetcodeTwoUrl,
      estimatedMinutes: 45,
      weakArea: 'DSA',
      difficulty: 3,
      capsuleType: 'leetcode_two',
    },
    {
      title: toSafeString(payload.verbalLabel) || 'Verbal Reasoning Drill',
      category: 'Other',
      subcategory: 'Verbal',
      referenceLabel: toSafeString(payload.verbalLabel) || 'Verbal practice',
      referenceUrl: payload.verbalUrl,
      estimatedMinutes: 30,
      weakArea: 'Verbal',
      difficulty: 2,
      capsuleType: 'verbal',
    },
    {
      title: toSafeString(payload.aptitudeLabel) || 'Aptitude Drill',
      category: 'Aptitude',
      subcategory: 'Admin capsule',
      referenceLabel: toSafeString(payload.aptitudeLabel) || 'Aptitude practice',
      referenceUrl: payload.aptitudeUrl,
      estimatedMinutes: 30,
      weakArea: 'Aptitude',
      difficulty: 2,
      capsuleType: 'aptitude',
    },
  ];

  const tasks = await withTransaction(async (client) => Promise.all(
    capsuleTasks.map((task) => taskRepository.createTask({
      userId: student.id,
      title: task.title,
      category: task.category,
      subcategory: task.subcategory,
      status: 'pending',
      priority: 'high',
      intensity: 'focused',
      referenceLabel: task.referenceLabel,
      referenceUrl: task.referenceUrl,
      scheduledFor,
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes: 0,
      difficulty: task.difficulty,
      weakArea: task.weakArea,
      aiGenerated: false,
      metadata: {
        ...buildCapsuleTaskMetadata(adminUser, student, bundleId, {
          title: bundleTitle,
          note: bundleNote,
        }, task.capsuleType),
      },
      completedAt: null,
    }, client))
  ));

  const progressService = require('./progress.service');
  await progressService.refreshProgressStats(student.id, student.timezone);

  return groupPracticeCapsules(tasks)[0] || null;
}

module.exports = {
  listStudentsForAdmin,
  createPracticeCapsule,
  groupPracticeCapsules,
};
