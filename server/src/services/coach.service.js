const { randomUUID } = require('crypto');

const { withTransaction } = require('../config/database');
const AppError = require('../utils/appError');
const { normalizeDate } = require('../utils/date');
const coachGroupRepository = require('../repositories/coachGroup.repository');
const imageRepository = require('../repositories/image.repository');
const notificationRepository = require('../repositories/notification.repository');
const progressRepository = require('../repositories/progress.repository');
const taskRepository = require('../repositories/task.repository');
const userRepository = require('../repositories/user.repository');

function buildTaskSummaryMap(rows) {
  return new Map(rows.map((row) => [row.userId, row]));
}

function groupRowsBy(rows, key) {
  return rows.reduce((map, row) => {
    const value = row[key];
    const existing = map.get(value) || [];
    existing.push(row);
    map.set(value, existing);
    return map;
  }, new Map());
}

function toSafeString(value) {
  return String(value || '').trim();
}

function toComparableTime(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortByCreatedAtAscending(left, right) {
  return toComparableTime(left.createdAt) - toComparableTime(right.createdAt);
}

function sortByCreatedAtDescending(left, right) {
  return toComparableTime(right.createdAt) - toComparableTime(left.createdAt);
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
    targetKind: payload.targetKind || 'student',
    targetId: payload.targetId || student.id,
    targetLabel: payload.targetLabel || student.name,
    groupId: payload.groupId || null,
    groupName: payload.groupName || null,
    assignmentId: payload.assignmentId || null,
    createdFrom: 'coach-practice-capsule',
  };
}

function buildPracticeCapsuleTemplates(payload) {
  return [
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
      targetKind: metadata.targetKind || 'student',
      targetId: metadata.targetId || task.userId,
      targetLabel: metadata.targetLabel || null,
      groupId: metadata.groupId || null,
      groupName: metadata.groupName || null,
      assignmentId: metadata.assignmentId || null,
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
      items: bundle.items.sort(sortByCreatedAtAscending),
    }))
    .sort(sortByCreatedAtDescending);
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
  const proofsByUser = groupRowsBy(recentProofs, 'userId');
  const practiceTasksByUser = groupRowsBy(recentPracticeTasks, 'userId');

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

async function listGroupsForAdmin() {
  const groups = await coachGroupRepository.listGroups();
  if (!groups.length) {
    return [];
  }

  const members = await coachGroupRepository.listMembers(groups.map((group) => group.id));
  const membersByGroup = groupRowsBy(members, 'groupId');

  return groups.map((group) => {
    const groupMembers = (membersByGroup.get(group.id) || []).sort((left, right) =>
      toSafeString(left.name).localeCompare(toSafeString(right.name))
    );

    return {
      ...group,
      memberCount: groupMembers.length,
      members: groupMembers,
    };
  });
}

async function resolveStudentTargets(studentUserIds = []) {
  const uniqueIds = Array.from(new Set((studentUserIds || []).filter(Boolean)));
  if (!uniqueIds.length) {
    return [];
  }

  const students = await Promise.all(uniqueIds.map((studentUserId) => userRepository.findById(studentUserId)));
  const missingStudent = students.find((student) => !student);
  if (missingStudent === undefined) {
    const invalidStudent = students.find(
      (student) => student.role !== 'user' || student.accessTier === 'observer'
    );

    if (invalidStudent) {
      throw new AppError('Only student accounts can be added to coach groups or practice capsules.', 400);
    }

    return students;
  }

  throw new AppError('One or more student accounts could not be found.', 404);
}

async function hydrateGroup(groupId) {
  const group = await coachGroupRepository.findGroupById(groupId);
  if (!group) {
    throw new AppError('Coach group not found.', 404);
  }

  const members = await coachGroupRepository.listMembers([groupId]);

  return {
    ...group,
    memberCount: members.length,
    members: members.sort((left, right) => toSafeString(left.name).localeCompare(toSafeString(right.name))),
  };
}

async function createGroup(adminUser, payload) {
  const name = toSafeString(payload.name);
  if (name.length < 2) {
    throw new AppError('Group name must be at least 2 characters.', 400);
  }

  const students = await resolveStudentTargets(payload.studentUserIds || []);
  const group = await withTransaction(async (client) => {
    const createdGroup = await coachGroupRepository.createGroup(
      {
        name,
        description: toSafeString(payload.description) || null,
        createdBy: adminUser.id,
      },
      client
    );

    if (students.length) {
      await coachGroupRepository.addMembers(
        createdGroup.id,
        students.map((student) => student.id),
        adminUser.id,
        client
      );
    }

    return createdGroup;
  });

  return hydrateGroup(group.id);
}

async function addGroupMembers(adminUser, groupId, studentUserIds = []) {
  const group = await coachGroupRepository.findGroupById(groupId);
  if (!group) {
    throw new AppError('Coach group not found.', 404);
  }

  const students = await resolveStudentTargets(studentUserIds);
  if (!students.length) {
    throw new AppError('Choose at least one student to add.', 400);
  }

  await coachGroupRepository.addMembers(
    groupId,
    students.map((student) => student.id),
    adminUser.id
  );

  return hydrateGroup(groupId);
}

async function removeGroupMember(groupId, studentUserId) {
  const group = await coachGroupRepository.findGroupById(groupId);
  if (!group) {
    throw new AppError('Coach group not found.', 404);
  }

  const removed = await coachGroupRepository.removeMember(groupId, studentUserId);
  if (!removed) {
    throw new AppError('Student is not part of this group.', 404);
  }

  return hydrateGroup(groupId);
}

async function resolvePracticeTargets(payload) {
  const hasStudent = Boolean(payload.studentUserId);
  const hasGroup = Boolean(payload.groupId);

  if (hasStudent === hasGroup) {
    throw new AppError('Choose either one student or one group before sharing a practice capsule.', 400);
  }

  if (hasStudent) {
    const [student] = await resolveStudentTargets([payload.studentUserId]);
    return {
      assignmentId: randomUUID(),
      targetKind: 'student',
      targetId: student.id,
      targetLabel: student.name,
      recipients: [student],
      groupId: null,
      groupName: null,
    };
  }

  const group = await hydrateGroup(payload.groupId);
  if (!group.members.length) {
    throw new AppError('This group has no students yet. Add students before sharing links.', 400);
  }

  const recipients = await resolveStudentTargets(group.members.map((member) => member.userId));

  return {
    assignmentId: randomUUID(),
    targetKind: 'group',
    targetId: group.id,
    targetLabel: group.name,
    recipients,
    groupId: group.id,
    groupName: group.name,
  };
}

function buildCoachCapsuleNotification(adminUser, assignmentContext, payload, student) {
  const bundleTitle = toSafeString(payload.title) || 'Admin practice capsule';
  const scopeLabel =
    assignmentContext.targetKind === 'group' && assignmentContext.groupName
      ? ` for ${assignmentContext.groupName}`
      : '';

  return {
    userId: student.id,
    type: 'coach_capsule',
    message: `${adminUser.name} shared ${bundleTitle}${scopeLabel}. Open the two LeetCode drills plus verbal and aptitude now.`,
    deliveryChannels: ['browser'],
    metadata: {
      title: 'New practice capsule',
      assignedByAdminId: adminUser.id,
      assignedByAdminName: adminUser.name,
      targetKind: assignmentContext.targetKind,
      targetId: assignmentContext.targetId,
      targetLabel: assignmentContext.targetLabel,
      groupId: assignmentContext.groupId,
      groupName: assignmentContext.groupName,
      bundleTitle,
      bundleNote: toSafeString(payload.note) || null,
      route: '/tasks',
      studentUserId: student.id,
    },
    dedupeKey: `coach-capsule:${assignmentContext.assignmentId}:${student.id}`,
  };
}

async function createPracticeCapsule(adminUser, payload) {
  const assignmentContext = await resolvePracticeTargets(payload);
  const bundleTemplates = buildPracticeCapsuleTemplates(payload);
  const createdTasks = [];
  const touchedUserIds = new Set();
  let notificationsCreated = 0;

  await withTransaction(async (client) => {
    for (const student of assignmentContext.recipients) {
      const bundleId = randomUUID();
      const scheduledFor = normalizeDate(payload.scheduledFor, student.timezone || adminUser.timezone);

      const studentTasks = await Promise.all(
        bundleTemplates.map((task) =>
          taskRepository.createTask(
            {
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
              metadata: buildCapsuleTaskMetadata(
                adminUser,
                student,
                bundleId,
                {
                  title: payload.title,
                  note: payload.note,
                  targetKind: assignmentContext.targetKind,
                  targetId: assignmentContext.targetId,
                  targetLabel: assignmentContext.targetLabel,
                  groupId: assignmentContext.groupId,
                  groupName: assignmentContext.groupName,
                  assignmentId: assignmentContext.assignmentId,
                },
                task.capsuleType
              ),
              completedAt: null,
            },
            client
          )
        )
      );

      createdTasks.push(...studentTasks);
      touchedUserIds.add(student.id);

      const notification = await notificationRepository.createNotification(
        buildCoachCapsuleNotification(adminUser, assignmentContext, payload, student),
        client
      );

      if (notification) {
        notificationsCreated += 1;
      }
    }
  });

  const progressService = require('./progress.service');
  await Promise.allSettled(
    Array.from(touchedUserIds).map(async (userId) => {
      const student = assignmentContext.recipients.find((entry) => entry.id === userId);
      if (student) {
        await progressService.refreshProgressStats(student.id, student.timezone);
      }
    })
  );

  return {
    dispatchId: assignmentContext.assignmentId,
    targetKind: assignmentContext.targetKind,
    targetId: assignmentContext.targetId,
    targetLabel: assignmentContext.targetLabel,
    recipientsCount: assignmentContext.recipients.length,
    notificationsCreated,
    capsules: groupPracticeCapsules(createdTasks),
  };
}

module.exports = {
  listStudentsForAdmin,
  listGroupsForAdmin,
  createGroup,
  addGroupMembers,
  removeGroupMember,
  createPracticeCapsule,
  groupPracticeCapsules,
};
