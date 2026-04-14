const { randomUUID } = require('crypto');

const { withTransaction } = require('../config/database');
const AppError = require('../utils/appError');
const { formatDateInTimezone, formatDateTimeInTimezone, getNextDayMorningDateTime, normalizeDateTime } = require('../utils/date');
const coachGroupRepository = require('../repositories/coachGroup.repository');
const imageRepository = require('../repositories/image.repository');
const notificationRepository = require('../repositories/notification.repository');
const progressRepository = require('../repositories/progress.repository');
const taskRepository = require('../repositories/task.repository');
const userRepository = require('../repositories/user.repository');
const { enqueueAdminAssignmentEmail, enqueueNotificationPush } = require('./deliveryJob.service');
const progressService = require('./progress.service');
const userProfileService = require('./userProfile.service');

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

function formatScheduledDate(value, timezone) {
  if (!value) {
    return 'today';
  }

  try {
    if (String(value).includes('T')) {
      return formatDateTimeInTimezone(value, timezone || 'Asia/Calcutta');
    }

    return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(value);
  }
}

function sortByCreatedAtAscending(left, right) {
  return toComparableTime(left.createdAt) - toComparableTime(right.createdAt);
}

function sortByCreatedAtDescending(left, right) {
  return toComparableTime(right.createdAt) - toComparableTime(left.createdAt);
}

function buildBundleTitle(payload) {
  return toSafeString(payload.title) || 'Admin assignment bundle';
}

function buildCapsuleTaskMetadata(adminUser, student, bundleId, payload, assignmentItem, deadlineAt) {
  return {
    shareKind: 'admin-assignment',
    bundleId,
    bundleTitle: buildBundleTitle(payload),
    bundleNote: toSafeString(payload.note) || null,
    capsuleType: assignmentItem.type || 'custom',
    itemDescription: toSafeString(assignmentItem.description) || null,
    deadlineAt,
    assignedByAdminId: adminUser.id,
    assignedByAdminName: adminUser.name,
    studentUserId: student.id,
    targetKind: payload.targetKind || 'student',
    targetId: payload.targetId || student.id,
    targetLabel: payload.targetLabel || student.name,
    groupId: payload.groupId || null,
    groupName: payload.groupName || null,
    assignmentId: payload.assignmentId || null,
    createdFrom: 'coach-admin-assignment',
  };
}

function buildPracticeCapsuleTemplates(payload) {
  return [
    {
      title: toSafeString(payload.leetcodeOneLabel) || 'LeetCode Drill 1',
      description: null,
      category: 'DSA',
      subcategory: 'Admin capsule',
      referenceLabel: toSafeString(payload.leetcodeOneLabel) || 'LeetCode question 1',
      referenceUrl: payload.leetcodeOneUrl,
      estimatedMinutes: 45,
      weakArea: 'DSA',
      difficulty: 3,
      type: 'leetcode_one',
    },
    {
      title: toSafeString(payload.leetcodeTwoLabel) || 'LeetCode Drill 2',
      description: null,
      category: 'DSA',
      subcategory: 'Admin capsule',
      referenceLabel: toSafeString(payload.leetcodeTwoLabel) || 'LeetCode question 2',
      referenceUrl: payload.leetcodeTwoUrl,
      estimatedMinutes: 45,
      weakArea: 'DSA',
      difficulty: 3,
      type: 'leetcode_two',
    },
    {
      title: toSafeString(payload.verbalLabel) || 'Verbal Reasoning Drill',
      description: null,
      category: 'Other',
      subcategory: 'Verbal',
      referenceLabel: toSafeString(payload.verbalLabel) || 'Verbal practice',
      referenceUrl: payload.verbalUrl,
      estimatedMinutes: 30,
      weakArea: 'Verbal',
      difficulty: 2,
      type: 'verbal',
    },
    {
      title: toSafeString(payload.aptitudeLabel) || 'Aptitude Drill',
      description: null,
      category: 'Aptitude',
      subcategory: 'Admin capsule',
      referenceLabel: toSafeString(payload.aptitudeLabel) || 'Aptitude practice',
      referenceUrl: payload.aptitudeUrl,
      estimatedMinutes: 30,
      weakArea: 'Aptitude',
      difficulty: 2,
      type: 'aptitude',
    },
  ].filter((item) => item.title || item.referenceUrl);
}

function sanitizeAssignmentItem(item, index) {
  return {
    title: toSafeString(item?.title) || `Admin task ${index + 1}`,
    description: toSafeString(item?.description) || null,
    category: toSafeString(item?.category) || 'Other',
    subcategory: toSafeString(item?.subcategory) || 'Admin assignment',
    referenceLabel: toSafeString(item?.referenceLabel) || null,
    referenceUrl: toSafeString(item?.referenceUrl) || null,
    estimatedMinutes: Number(item?.estimatedMinutes || 30),
    weakArea: toSafeString(item?.weakArea) || null,
    difficulty: Number(item?.difficulty || 3),
    type: toSafeString(item?.type) || 'custom',
  };
}

function resolveAssignmentItems(payload) {
  if (Array.isArray(payload.items) && payload.items.length) {
    const items = payload.items
      .map((item, index) => sanitizeAssignmentItem(item, index))
      .filter((item) => item.title || item.referenceUrl);

    if (items.length) {
      return items;
    }
  }

  return buildPracticeCapsuleTemplates(payload);
}

function resolveAssignmentDeadlineAt(adminUser, payload) {
  const timezone = adminUser.timezone || 'Asia/Calcutta';
  const rawDeadline = payload.deadlineAt || payload.scheduledFor || null;
  const deadlineAt = rawDeadline
    ? normalizeDateTime(rawDeadline, timezone, '09:00')
    : getNextDayMorningDateTime(timezone);

  if (!deadlineAt) {
    throw new AppError('Choose a valid assignment deadline.', 400);
  }

  if (new Date(deadlineAt).getTime() <= Date.now()) {
    throw new AppError('Assignment deadline must be in the future.', 400);
  }

  return deadlineAt;
}

function buildCoachCapsuleDeliveryChannels(profile = {}) {
  if (!profile.notificationsEnabled) {
    return [];
  }

  const channels = [];

  if (profile.notificationEmailEnabled) {
    channels.push('email');
  }

  if (profile.notificationBrowserEnabled && profile.notificationBrowserPermission === 'granted') {
    channels.push('browser');
    channels.push('push');
  }

  return channels;
}

function groupPracticeCapsules(tasks) {
  const grouped = new Map();

  for (const task of tasks) {
    const metadata = task.metadata || {};
    const shareKind = metadata.shareKind;
    if (shareKind !== 'admin-practice-link' && shareKind !== 'admin-assignment') {
      continue;
    }

    const bundleId = metadata.bundleId || task.id;
    const existing = grouped.get(bundleId) || {
      bundleId,
      title: metadata.bundleTitle || 'Admin assignment bundle',
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
      dueAt: task.dueAt || metadata.deadlineAt || null,
      scheduledFor: task.scheduledFor,
      createdAt: task.createdAt,
      items: [],
    };

    existing.items.push({
      taskId: task.id,
      title: task.title,
      description: task.description || metadata.itemDescription || null,
      category: task.category,
      status: task.status,
      referenceLabel: task.referenceLabel || null,
      referenceUrl: task.referenceUrl || null,
      capsuleType: metadata.capsuleType || 'resource',
      dueAt: task.dueAt || metadata.deadlineAt || null,
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
      throw new AppError('Only student accounts can be added to coach groups or admin assignments.', 400);
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
    throw new AppError('Choose either one student or one group before sharing an assignment bundle.', 400);
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
    throw new AppError('This group has no students yet. Add students before sharing a bundle.', 400);
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

function buildCoachCapsuleNotification(adminUser, assignmentContext, payload, student, bundleTasks, deadlineAt, profile) {
  const bundleTitle = buildBundleTitle(payload);
  const firstTask = bundleTasks[0] || null;
  const focusArea = toSafeString(
    firstTask?.weakArea
    || firstTask?.category
    || student.weakAreas?.[0]
    || 'placement prep'
  );
  const taskCount = bundleTasks.length || 1;
  const scopeLabel =
    assignmentContext.targetKind === 'group' && assignmentContext.groupName
      ? ` for ${assignmentContext.groupName}`
      : '';
  const deadlineLabel = formatScheduledDate(deadlineAt, student.timezone || adminUser.timezone);
  const summaryLine = taskCount === 1
    ? `A new admin task is live. It is due by ${deadlineLabel}.`
    : `${taskCount} admin-assigned tasks are live. They are due by ${deadlineLabel}.`;

  return {
    userId: student.id,
    type: 'coach_capsule',
    message: `${adminUser.name} assigned ${bundleTitle}${scopeLabel}. Start with ${firstTask?.title || 'the first task'} and finish it by ${deadlineLabel}.`,
    deliveryChannels: buildCoachCapsuleDeliveryChannels(profile),
    metadata: {
      title: 'New admin assignment',
      subject: `PlacePrep | ${bundleTitle} assigned`,
      headline: `${bundleTitle} is in your queue`,
      preview: `${taskCount} admin-assigned task${taskCount === 1 ? '' : 's'} due by ${deadlineLabel}.`,
      actionLabel: 'Open tasks',
      actionText: firstTask?.title
        ? `Start ${toSafeString(firstTask.title)}.`
        : 'Open tasks and begin.',
      whyNow: assignmentContext.targetKind === 'group' && assignmentContext.groupName
        ? `${adminUser.name} shared this bundle with ${assignmentContext.groupName}.`
        : `${adminUser.name} shared this bundle directly with you.`,
      summaryLine,
      assignedByAdminId: adminUser.id,
      assignedByAdminName: adminUser.name,
      targetKind: assignmentContext.targetKind,
      targetId: assignmentContext.targetId,
      targetLabel: assignmentContext.targetLabel,
      groupId: assignmentContext.groupId,
      groupName: assignmentContext.groupName,
      bundleTitle,
      bundleNote: toSafeString(payload.note) || null,
      taskCount,
      deadlineAt,
      scheduledFor: firstTask?.scheduledFor || null,
      focusArea,
      primaryTaskTitle: firstTask?.title || null,
      primaryTaskCategory: firstTask?.category || null,
      route: '/tasks',
      studentUserId: student.id,
    },
    dedupeKey: `coach-capsule:${assignmentContext.assignmentId}:${student.id}`,
  };
}

function buildAdminAssignmentEmailPayload(adminUser, assignmentContext, payload, student, bundleTasks, deadlineAt) {
  return {
    bundleTitle: buildBundleTitle(payload),
    note: toSafeString(payload.note) || null,
    assignedByName: adminUser.name,
    targetKind: assignmentContext.targetKind,
    targetLabel: assignmentContext.targetLabel,
    groupName: assignmentContext.groupName,
    deadlineAt,
    tasks: bundleTasks.map((task) => ({
      title: task.title,
      description: task.description || task.metadata?.itemDescription || null,
      category: task.category,
      referenceLabel: task.referenceLabel || null,
      referenceUrl: task.referenceUrl || null,
      dueAt: task.dueAt || deadlineAt,
    })),
  };
}

async function createPracticeCapsule(adminUser, payload) {
  const assignmentContext = await resolvePracticeTargets(payload);
  const bundleTemplates = resolveAssignmentItems(payload);
  const deadlineAt = resolveAssignmentDeadlineAt(adminUser, payload);
  if (!bundleTemplates.length) {
    throw new AppError('Add at least one task to assign before sharing.', 400);
  }

  const recipientProfiles = await Promise.all(
    assignmentContext.recipients.map(async (student) => ([
      student.id,
      await userProfileService.getProfile(student),
    ]))
  );
  const profileByStudentId = new Map(recipientProfiles);
  const createdTasks = [];
  const createdNotifications = [];
  const touchedUserIds = new Set();
  let notificationsCreated = 0;

  await withTransaction(async (client) => {
    for (const student of assignmentContext.recipients) {
      const bundleId = randomUUID();
      const scheduledFor = formatDateInTimezone(new Date(deadlineAt), student.timezone || adminUser.timezone);

      const studentTasks = await Promise.all(
        bundleTemplates.map((task) =>
          taskRepository.createTask(
            {
              userId: student.id,
              title: task.title,
              description: task.description,
              category: task.category,
              subcategory: task.subcategory,
              status: 'pending',
              priority: 'high',
              intensity: 'focused',
              referenceLabel: task.referenceLabel,
              referenceUrl: task.referenceUrl,
              dueDate: scheduledFor,
              dueAt: deadlineAt,
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
                task,
                deadlineAt,
              ),
              completedAt: null,
            },
            client
          )
        )
        );

        createdTasks.push(...studentTasks);
        touchedUserIds.add(student.id);

        const studentProfile = profileByStudentId.get(student.id);
        const notification = await notificationRepository.createNotification(
          buildCoachCapsuleNotification(
            adminUser,
            assignmentContext,
            payload,
            student,
            studentTasks,
            deadlineAt,
            studentProfile,
          ),
          client
        );

        if (notification) {
          notificationsCreated += 1;
          createdNotifications.push({
            student,
            studentProfile,
            notification,
            bundleTasks: studentTasks,
            assignment: buildAdminAssignmentEmailPayload(
              adminUser,
              assignmentContext,
              payload,
              student,
              studentTasks,
              deadlineAt,
            ),
          });
        }
      }
    });

  await Promise.allSettled(
    Array.from(touchedUserIds).map(async (userId) => {
      const student = assignmentContext.recipients.find((entry) => entry.id === userId);
      if (!student) {
        return null;
      }

      return progressService.refreshProgressStats(student.id, student.timezone);
    })
  );

  await Promise.allSettled(
    createdNotifications.map(async ({ student, studentProfile, notification, assignment }) => {
      if (studentProfile?.notificationsEnabled
        && studentProfile.notificationBrowserEnabled
        && studentProfile.notificationBrowserPermission === 'granted') {
        await enqueueNotificationPush({
          userId: student.id,
          notification,
          dedupeKey: `coach-assignment-push:${notification.id}`,
        });
      }

      if (!studentProfile?.notificationsEnabled || !studentProfile.notificationEmailEnabled) {
        return {
          studentId: student.id,
          skipped: 'email_disabled',
        };
      }

      const queuedJob = await enqueueAdminAssignmentEmail({
        user: student,
        assignment,
        notificationId: notification.id,
        dedupeKey: `coach-assignment-email:${assignmentContext.assignmentId}:${student.id}`,
      });

      if (!queuedJob) {
        console.error(`[coach] Assignment email job was already queued for ${student.id}.`);
      }

      return queuedJob;
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
