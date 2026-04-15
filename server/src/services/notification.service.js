const { query } = require('../config/database');
const env = require('../config/env');
const {
  getAIStatus,
  getOpenAIClient,
  markAIUnavailable,
  markAIWorking,
  normalizeErrorReason,
} = require('../config/openai');
const progressRepository = require('../repositories/progress.repository');
const notificationRepository = require('../repositories/notification.repository');
const prepPlanRepository = require('../repositories/prepPlan.repository');
const userRepository = require('../repositories/user.repository');
const { sendNotificationDigestEmail, isEmailDeliveryReady } = require('./email.service');
const { enqueueNotificationDigestEmail, enqueueNotificationPush } = require('./deliveryJob.service');
const progressService = require('./progress.service');
const userProfileService = require('./userProfile.service');
const AppError = require('../utils/appError');
const { buildPrepArchitectTaskVisibilityClause } = require('../utils/taskVisibility');
const { formatDateInTimezone, getTodayInTimezone } = require('../utils/date');

const priorityMap = {
  countdown_urgency: 5,
  missed_streak: 4,
  pending_tasks: 3,
  daily_inactivity: 2,
  motivation: 1,
};

const titleMap = {
  countdown_urgency: 'Deadline pressure',
  missed_streak: 'Streak warning',
  pending_tasks: 'Pending tasks',
  daily_inactivity: 'Return to command',
  motivation: 'Nocturne push',
};

function cleanList(values, limit = 6) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  ).slice(0, limit);
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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

function pickText(value, fallback, maxLength) {
  const fallbackText = compactText(fallback);
  const text = compactText(value || fallbackText);
  if (!text) {
    return fallbackText;
  }

  if (!maxLength || text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength).trim().replace(/[,:;\-]+$/, '');
}

function formatHoursLabel(minutes) {
  const safeMinutes = Number(minutes || 0);
  if (!safeMinutes) {
    return '1 hr';
  }

  const hours = Math.round((safeMinutes / 60) * 10) / 10;
  if (Number.isInteger(hours)) {
    return `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
  }

  return `${hours.toFixed(1)} hrs`;
}

function getPrimaryFocusArea(pendingTasks = []) {
  return pendingTasks.find((task) => task.focusArea)?.focusArea || null;
}

function dayNumber(dateString) {
  return Math.floor(new Date(`${String(dateString).slice(0, 10)}T00:00:00Z`).getTime() / 86400000);
}

function differenceInDays(fromDate, toDate) {
  return dayNumber(toDate) - dayNumber(fromDate);
}

function shouldTriggerUrgency(daysLeft) {
  return [30, 21, 14, 10, 7, 5, 3, 2, 1, 0].includes(daysLeft);
}

function sortCandidates(left, right) {
  return (priorityMap[right.type] || 0) - (priorityMap[left.type] || 0);
}

async function getTaskSnapshot(userId, today) {
  const visibleActiveTasksClause = buildPrepArchitectTaskVisibilityClause({
    taskRef: 'tasks',
    activePlanRef: 'user_context.active_plan_id',
  });

  const result = await query(
    `WITH user_context AS (
       SELECT COALESCE(coach_metadata->>'prepArchitectPlanId', '') AS active_plan_id
       FROM users
       WHERE id = $1
     )
     SELECT
       COUNT(*) FILTER (
         WHERE status IN ('pending', 'in_progress')
           AND scheduled_for <= $2
       )::INT AS pending_count,
       COUNT(*) FILTER (
         WHERE status IN ('pending', 'in_progress')
           AND (
             (due_at IS NOT NULL AND due_at < NOW())
             OR (due_at IS NULL AND scheduled_for < $2)
           )
       )::INT AS overdue_count
     FROM tasks, user_context
     WHERE user_id = $1
       AND ${visibleActiveTasksClause}`,
    [userId, today]
  );

  return {
    pendingCount: Number(result.rows[0]?.pending_count || 0),
    overdueCount: Number(result.rows[0]?.overdue_count || 0),
  };
}

async function getPendingTaskPreview(userId, today) {
  const visibleActiveTasksClause = buildPrepArchitectTaskVisibilityClause({
    taskRef: 'tasks',
    activePlanRef: 'user_context.active_plan_id',
  });

  const result = await query(
    `WITH user_context AS (
       SELECT COALESCE(coach_metadata->>'prepArchitectPlanId', '') AS active_plan_id
       FROM users
       WHERE id = $1
     )
     SELECT
       title,
       category,
       COALESCE(NULLIF(weak_area, ''), NULLIF(subcategory, ''), category) AS focus_area,
       estimated_minutes AS "estimatedMinutes",
       scheduled_for::TEXT AS "scheduledFor",
       due_at AS "dueAt"
     FROM tasks, user_context
     WHERE user_id = $1
       AND status IN ('pending', 'in_progress')
       AND ${visibleActiveTasksClause}
     ORDER BY
       CASE
         WHEN scheduled_for < $2 THEN 0
         WHEN scheduled_for = $2 THEN 1
         ELSE 2
       END,
       scheduled_for ASC,
       created_at ASC
     LIMIT 3`,
    [userId, today]
  );

  return result.rows.map((row) => ({
    title: compactText(row.title),
    category: compactText(row.category || 'Task'),
    focusArea: compactText(row.focus_area || row.category || 'placement prep'),
    estimatedMinutes: Number(row.estimatedMinutes || 0),
    scheduledFor: row.scheduledFor || null,
  }));
}

async function didBreakStreakRecently(userId, currentStreak) {
  if (Number(currentStreak || 0) > 0) {
    return false;
  }

  const history = await progressRepository.listHistory(userId, 7);
  return history.slice(1).some((item) => Number(item.streak || 0) > 0);
}

function buildNotificationCandidates({
  today,
  summary,
  taskSnapshot,
  daysSinceLastLogin,
  daysLeft,
  streakBroken,
}) {
  const candidates = [];
  const readiness = Number(summary?.readinessScore || 0);

  if (daysSinceLastLogin >= 1) {
    candidates.push({
      type: 'daily_inactivity',
      dedupeKey: `daily-inactivity:${today}`,
      metadata: {
        daysSinceLastLogin,
      },
    });
  }

  if (taskSnapshot.pendingCount > 0) {
    candidates.push({
      type: 'pending_tasks',
      dedupeKey: `pending-tasks:${today}`,
      metadata: {
        pendingCount: taskSnapshot.pendingCount,
        overdueCount: taskSnapshot.overdueCount,
      },
    });
  }

  if (streakBroken) {
    candidates.push({
      type: 'missed_streak',
      dedupeKey: `missed-streak:${today}`,
      metadata: {
        streak: Number(summary?.streak || 0),
      },
    });
  }

  if (daysLeft !== null && daysLeft <= 30 && shouldTriggerUrgency(daysLeft)) {
    candidates.push({
      type: 'countdown_urgency',
      dedupeKey: `countdown:${daysLeft}`,
      metadata: {
        daysLeft,
      },
    });
  }

  if (!candidates.length || readiness < 58) {
    candidates.push({
      type: 'motivation',
      dedupeKey: `motivation:${today}`,
      metadata: {
        readinessScore: readiness,
      },
    });
  }

  return candidates.sort(sortCandidates);
}

function buildNotificationKeys(candidates = []) {
  return candidates.map((candidate) => ({
    type: candidate.type,
    dedupeKey: candidate.dedupeKey,
  }));
}

function buildPlanSnapshot(plan) {
  if (!plan) {
    return null;
  }

  const firstDay = Array.isArray(plan.tasks) ? plan.tasks[0] : null;

  return {
    id: plan.id,
    targetRole: compactText(plan.targetRole),
    timePerDay: Number(plan.timePerDay || 0),
    knownTopics: cleanList(plan.knownTopics, 4),
    targetTopics: cleanList(plan.targetTopics, 4),
    coachLine: compactText(plan.metadata?.coachLine),
    firstTheme: compactText(firstDay?.theme),
    firstItems: Array.isArray(firstDay?.items)
      ? firstDay.items.slice(0, 3).map((item) => compactText(item.title)).filter(Boolean)
      : [],
  };
}

function buildNotificationContext({
  user,
  summary,
  taskSnapshot,
  pendingTasks,
  daysSinceLastLogin,
  daysLeft,
  placementDate,
  planSnapshot,
}) {
  const coachProfile = summary?.coachProfile || {};
  const focusArea = compactText(
    coachProfile.focusArea
    || getPrimaryFocusArea(pendingTasks)
    || planSnapshot?.targetTopics?.[0]
    || 'placement prep'
  );
  const nextTask = pendingTasks[0] || null;

  return {
    name: compactText(user.name || user.username || 'PlacePrep user'),
    username: compactText(user.username),
    targetRole: compactText(user.targetRole || planSnapshot?.targetRole || 'Placement preparation'),
    placementDate,
    daysLeft,
    focusArea,
    weakTopics: cleanList(coachProfile.weakTopics, 4),
    strongTopics: cleanList(coachProfile.strongTopics, 3),
    readinessScore: Number(summary?.readinessScore || coachProfile.readinessScore || 0),
    consistencyScore: Number(summary?.consistencyScore || coachProfile.consistencyScore || 0),
    streak: Number(summary?.streak || coachProfile.streak || 0),
    averageTimePerProblem: Number(coachProfile.averageTimePerProblem || 0),
    failedAttempts: Number(coachProfile.failedAttempts || 0),
    commandLine: compactText(coachProfile.commandLine),
    daysSinceLastLogin,
    pendingCount: Number(taskSnapshot.pendingCount || 0),
    overdueCount: Number(taskSnapshot.overdueCount || 0),
    nextTask,
    pendingTasks,
    planId: planSnapshot?.id || null,
    planCoachLine: compactText(planSnapshot?.coachLine),
    planTargetTopics: planSnapshot?.targetTopics || [],
    planKnownTopics: planSnapshot?.knownTopics || [],
    planFirstTheme: compactText(planSnapshot?.firstTheme),
    planFirstItems: planSnapshot?.firstItems || [],
    planTimePerDay: Number(planSnapshot?.timePerDay || 0),
  };
}

function buildFallbackSummaryLine(context) {
  const focus = context.focusArea || context.weakTopics[0] || 'placement prep';
  const role = context.targetRole || 'placement prep';

  if (context.daysLeft !== null && context.daysLeft <= 14) {
    return `${focus} will decide your ${role} finish. Close one clean block tonight.`;
  }

  if (context.pendingCount > 0) {
    return `${focus} is still exposed. Clear one real task before the day closes.`;
  }

  return `${focus} is the pressure point. Build one honest hour around it tonight.`;
}

function buildFallbackNotificationCopy(candidate, context) {
  const focus = context.focusArea || context.weakTopics[0] || 'placement prep';
  const nextWeak = context.weakTopics[1] || focus;
  const role = context.targetRole || 'placement prep';
  const nextTaskTitle = context.nextTask?.title || `${focus} recovery block`;
  const nextTaskDuration = formatHoursLabel(context.nextTask?.estimatedMinutes || 60);
  const planTheme = context.planFirstTheme || context.planTargetTopics[0] || focus;

  switch (candidate.type) {
    case 'daily_inactivity':
      return {
        subject: `PlacePrep | ${focus} is still waiting`,
        headline: context.daysSinceLastLogin >= 2
          ? `${focus} has been idle for ${context.daysSinceLastLogin} days.`
          : `You stepped away before ${focus} was closed.`,
        preview: `Return through ${nextTaskTitle}.`,
        message: `Your ${role} prep is drifting at ${focus}. Re-enter with ${nextTaskTitle} and keep the block honest.`,
        actionLabel: 'Return now',
        actionText: `Start ${nextTaskTitle} for ${nextTaskDuration}.`,
        whyNow: `${context.daysSinceLastLogin} days away turns one soft spot into two.`,
      };
    case 'pending_tasks':
      return {
        subject: `PlacePrep | ${context.pendingCount} tasks still open`,
        headline: context.overdueCount > 0
          ? `${context.overdueCount} tasks have already slipped.`
          : `${context.pendingCount} tasks are still waiting.`,
        preview: `${focus} is still exposed for ${role}.`,
        message: `Backlog pressure is sitting on ${focus}. Start with ${nextTaskTitle} and remove one open loop tonight.`,
        actionLabel: 'Clear one',
        actionText: `Finish ${nextTaskTitle}, then revise ${nextWeak}.`,
        whyNow: context.overdueCount > 0
          ? `${context.overdueCount} overdue tasks are already taxing focus.`
          : `${context.pendingCount} open tasks still block a clean day.`,
      };
    case 'missed_streak':
      return {
        subject: 'PlacePrep | The streak needs rebuilding',
        headline: `The streak is gone. Rebuild it in ${focus}.`,
        preview: 'One clean win reopens momentum.',
        message: `Discipline slipped, not ability. Reclaim control through ${planTheme} before you touch anything comfortable.`,
        actionLabel: 'Rebuild',
        actionText: `Finish one focused ${focus} block tonight.`,
        whyNow: 'A broken streak is easiest to repair on the very next day.',
      };
    case 'countdown_urgency':
      return {
        subject: `PlacePrep | ${context.daysLeft} days to go`,
        headline: `${context.daysLeft} days left. ${focus} cannot stay soft.`,
        preview: `${role} pressure is no longer abstract.`,
        message: `${focus} is still the gap between effort and readiness. Use tonight to close one measurable block before the deadline tightens further.`,
        actionLabel: 'Tighten up',
        actionText: `Prioritize ${nextTaskTitle} before anything else.`,
        whyNow: `Readiness is ${Math.round(context.readinessScore)} with ${context.daysLeft} days remaining.`,
      };
    case 'motivation':
    default:
      return {
        subject: `PlacePrep | Hold the line in ${focus}`,
        headline: `${focus} decides the next version of you.`,
        preview: 'Keep the work sharp and personal.',
        message: `Your edge for ${role} still runs through ${focus}. Build one clean block, then lock the lesson before the night ends.`,
        actionLabel: 'Stay strict',
        actionText: `Finish ${nextTaskTitle} and note the pattern.`,
        whyNow: `Weak areas are ${cleanList([focus, nextWeak], 2).join(' and ')} right now.`,
      };
  }
}

function normalizePersonalizedCopy(item, candidate, context) {
  const fallback = buildFallbackNotificationCopy(candidate, context);

  return {
    type: candidate.type,
    subject: pickText(item?.subject, fallback.subject, 88),
    headline: pickText(item?.headline, fallback.headline, 120),
    preview: pickText(item?.preview, fallback.preview, 140),
    message: pickText(item?.message, fallback.message, 200),
    actionLabel: pickText(item?.actionLabel, fallback.actionLabel, 24),
    actionText: pickText(item?.actionText, fallback.actionText, 140),
    whyNow: pickText(item?.whyNow, fallback.whyNow, 140),
  };
}

async function personalizeNotificationCopies(candidates, context) {
  const fallbackResult = {
    summaryLine: buildFallbackSummaryLine(context),
    copies: candidates.map((candidate) => normalizePersonalizedCopy(null, candidate, context)),
    usedFallback: true,
  };

  if (!candidates.length) {
    return fallbackResult;
  }

  const status = getAIStatus();
  if (status.fallbackMode && ['quota_exceeded', 'no_key'].includes(status.reason)) {
    return fallbackResult;
  }

  const client = getOpenAIClient();
  if (!client) {
    return fallbackResult;
  }

  try {
    const response = await client.chat.completions.create({
      model: env.aiModel,
      temperature: 0.55,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You write premium notification copy for PlacePrep, a private placement-prep command center.',
            'Tone: strict, direct, personal, disciplined, no fluff, no spam language, no exclamation marks.',
            'Use the actual weak areas, role target, streak, readiness, countdown, and next task.',
            'Do not shame the user. Push them clearly and specifically.',
            'Return only JSON.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            'Create a tailored notification brief for this user.',
            '',
            'Context JSON:',
            JSON.stringify({
              user: {
                name: context.name,
                username: context.username,
                targetRole: context.targetRole,
                placementDate: context.placementDate,
                daysLeft: context.daysLeft,
              },
              performance: {
                focusArea: context.focusArea,
                weakTopics: context.weakTopics,
                strongTopics: context.strongTopics,
                readinessScore: context.readinessScore,
                consistencyScore: context.consistencyScore,
                streak: context.streak,
                averageTimePerProblem: context.averageTimePerProblem,
                failedAttempts: context.failedAttempts,
                commandLine: context.commandLine,
              },
              activity: {
                daysSinceLastLogin: context.daysSinceLastLogin,
                pendingCount: context.pendingCount,
                overdueCount: context.overdueCount,
                nextTask: context.nextTask,
                pendingTasks: context.pendingTasks,
              },
              plan: {
                coachLine: context.planCoachLine,
                targetTopics: context.planTargetTopics,
                knownTopics: context.planKnownTopics,
                firstTheme: context.planFirstTheme,
                firstItems: context.planFirstItems,
                timePerDay: context.planTimePerDay,
              },
              candidates: candidates.map((candidate) => ({
                type: candidate.type,
                dedupeKey: candidate.dedupeKey,
                facts: candidate.metadata,
              })),
            }, null, 2),
            '',
            'Return JSON with keys:',
            '- summaryLine: string, max 20 words',
            '- notifications: array',
            '',
            'Each notification item must contain:',
            '- type',
            '- subject: max 10 words',
            '- headline: max 14 words',
            '- preview: max 16 words',
            '- message: max 28 words',
            '- actionLabel: 1 to 3 words',
            '- actionText: max 14 words',
            '- whyNow: max 16 words',
            '',
            'Return one notification item per candidate type.',
          ].join('\n'),
        },
      ],
    });

    const data = safeJsonParse(response.choices[0]?.message?.content || '{}');
    const itemMap = new Map(
      (Array.isArray(data.notifications) ? data.notifications : [])
        .map((item) => [compactText(item.type), item])
        .filter(([type]) => type)
    );

    markAIWorking();

    return {
      summaryLine: pickText(data.summaryLine, fallbackResult.summaryLine, 140),
      copies: candidates.map((candidate) =>
        normalizePersonalizedCopy(itemMap.get(candidate.type), candidate, context)
      ),
      usedFallback: false,
    };
  } catch (error) {
    const reason = normalizeErrorReason(error);
    if (reason) {
      markAIUnavailable(reason, error);
    }

    return fallbackResult;
  }
}

async function resolveUser(userOrId) {
  if (userOrId?.id) {
    return userOrId;
  }

  const user = await userRepository.findById(userOrId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  return user;
}

async function syncNotificationsForUser(userOrId, options = {}) {
  const user = await resolveUser(userOrId);
  const profile = await userProfileService.getProfile(user);

  if (!profile.notificationsEnabled) {
    return {
      created: [],
      emailAttempted: false,
      emailSent: false,
      emailReason: 'notifications_disabled',
      emailReady: isEmailDeliveryReady(),
      usedAiTailoring: false,
    };
  }

  const timezone = user.timezone || env.defaultTimezone;
  const today = getTodayInTimezone(timezone);
  const summary = await progressService.refreshProgressStats(user);
  const [taskSnapshot, pendingTasks, latestPlan, streakBroken] = await Promise.all([
    getTaskSnapshot(user.id, today),
    getPendingTaskPreview(user.id, today),
    prepPlanRepository.findLatestActiveByUser(user.id),
    didBreakStreakRecently(user.id, summary.streak),
  ]);
  const lastLoginDate = user.lastLoginAt
    ? formatDateInTimezone(new Date(user.lastLoginAt), timezone)
    : null;
  const daysSinceLastLogin = lastLoginDate ? differenceInDays(lastLoginDate, today) : 999;
  const placementDate = user.placementDate ? String(user.placementDate).slice(0, 10) : null;
  const daysLeft = placementDate ? differenceInDays(today, placementDate) : null;

  const candidates = buildNotificationCandidates({
    today,
    summary,
    taskSnapshot,
    daysSinceLastLogin,
    daysLeft,
    streakBroken,
  });
  const notificationContext = buildNotificationContext({
    user,
    summary,
    taskSnapshot,
    pendingTasks,
    daysSinceLastLogin,
    daysLeft,
    placementDate,
    planSnapshot: buildPlanSnapshot(latestPlan),
  });
  const personalization = await personalizeNotificationCopies(candidates, notificationContext);
  const notificationKeys = buildNotificationKeys(candidates);

  const deliveryChannels = [];
  if (profile.notificationEmailEnabled) {
    deliveryChannels.push('email');
  }
  if (profile.notificationBrowserEnabled && profile.notificationBrowserPermission === 'granted') {
    deliveryChannels.push('browser');
    deliveryChannels.push('push');
  }

  if (options.previewOnly) {
    const previewNotifications = candidates.map((candidate, index) => {
      const copy = personalization.copies[index] || normalizePersonalizedCopy(null, candidate, notificationContext);

      return {
        id: `preview-${candidate.type}`,
        userId: user.id,
        type: candidate.type,
        message: copy.message,
        sentAt: new Date().toISOString(),
        read: false,
        readAt: null,
        deliveryChannels,
        dedupeKey: candidate.dedupeKey,
        metadata: {
          ...candidate.metadata,
          title: copy.headline || titleMap[candidate.type] || 'PlacePrep notice',
          source: options.source || 'manual_preview',
          subject: copy.subject,
          headline: copy.headline,
          preview: copy.preview,
          actionLabel: copy.actionLabel,
          actionText: copy.actionText,
          whyNow: copy.whyNow,
          summaryLine: personalization.summaryLine,
          focusArea: notificationContext.focusArea,
          targetRole: notificationContext.targetRole,
          weakTopics: notificationContext.weakTopics,
          strongTopics: notificationContext.strongTopics,
          nextTask: notificationContext.nextTask,
          planCoachLine: notificationContext.planCoachLine,
          aiTailored: !personalization.usedFallback,
        },
      };
    });

    let previewEmailResult = {
      attempted: false,
      sent: false,
      reason: profile.notificationEmailEnabled ? 'delivery_skipped' : 'email_disabled',
    };

    if (previewNotifications.length && options.deliverEmail && profile.notificationEmailEnabled) {
      previewEmailResult = await sendNotificationDigestEmail({
        user,
        notifications: previewNotifications,
        summary,
        context: {
          ...notificationContext,
          summaryLine: personalization.summaryLine,
          usedAiTailoring: !personalization.usedFallback,
        },
      });
    }

    return {
      created: previewNotifications,
      emailAttempted: previewEmailResult.attempted,
      emailSent: previewEmailResult.sent,
      emailReason: previewEmailResult.reason,
      emailReady: isEmailDeliveryReady(),
      usedAiTailoring: !personalization.usedFallback,
      previewOnly: true,
    };
  }

  const created = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const copy = personalization.copies[index] || normalizePersonalizedCopy(null, candidate, notificationContext);

    const notification = await notificationRepository.createNotification({
      userId: user.id,
      type: candidate.type,
      message: copy.message,
      sentAt: new Date().toISOString(),
      deliveryChannels,
      metadata: {
        ...candidate.metadata,
        title: copy.headline || titleMap[candidate.type] || 'PlacePrep notice',
        source: options.source || 'manual',
        subject: copy.subject,
        headline: copy.headline,
        preview: copy.preview,
        actionLabel: copy.actionLabel,
        actionText: copy.actionText,
        whyNow: copy.whyNow,
        summaryLine: personalization.summaryLine,
        focusArea: notificationContext.focusArea,
        targetRole: notificationContext.targetRole,
        weakTopics: notificationContext.weakTopics,
        strongTopics: notificationContext.strongTopics,
        nextTask: notificationContext.nextTask,
        planCoachLine: notificationContext.planCoachLine,
        aiTailored: !personalization.usedFallback,
      },
      dedupeKey: candidate.dedupeKey,
    });

    if (notification) {
      created.push(notification);
    }
  }

  if (profile.notificationBrowserEnabled && profile.notificationBrowserPermission === 'granted') {
    await Promise.allSettled(
      created.map((notification) =>
        enqueueNotificationPush({
          userId: user.id,
          notification,
          dedupeKey: `notification-push:${notification.id}`,
        })
      )
    );
  }

  let notificationsForEmail = [];
  if (options.deliverEmail && profile.notificationEmailEnabled) {
    notificationsForEmail = await notificationRepository.findNotificationsByKeys(
      user.id,
      notificationKeys
    );
    notificationsForEmail = notificationsForEmail.filter((notification) => !notification.emailedAt);
  }

  let emailResult = {
    attempted: false,
    sent: false,
    reason: profile.notificationEmailEnabled ? 'delivery_skipped' : 'email_disabled',
  };

  if (notificationsForEmail.length && options.deliverEmail && profile.notificationEmailEnabled) {
    const queuedEmailJob = await enqueueNotificationDigestEmail({
      user,
      notifications: notificationsForEmail,
      summary,
      context: {
        ...notificationContext,
        summaryLine: personalization.summaryLine,
        usedAiTailoring: !personalization.usedFallback,
      },
      dedupeKey: `notification-digest:${notificationsForEmail.map((notification) => notification.id).sort().join(':')}`,
    });

    emailResult = queuedEmailJob
      ? {
          attempted: true,
          sent: false,
          reason: 'queued',
        }
      : {
          attempted: false,
          sent: false,
          reason: 'already_queued',
        };
  } else if (options.deliverEmail && profile.notificationEmailEnabled && notificationKeys.length) {
    emailResult = {
      attempted: false,
      sent: false,
      reason: 'already_emailed',
    };
  }

  return {
    created,
    emailAttempted: emailResult.attempted,
    emailSent: emailResult.sent,
    emailReason: emailResult.reason,
    emailReady: isEmailDeliveryReady(),
    usedAiTailoring: !personalization.usedFallback,
  };
}

async function runDailySweep() {
  const users = await userRepository.listUsersForNotificationSweep();
  const results = [];

  for (const user of users) {
    try {
      const result = await syncNotificationsForUser(user, {
        source: 'daily_sweep',
        deliverEmail: true,
      });

      results.push({
        userId: user.id,
        created: result.created.length,
        emailSent: result.emailSent,
        emailQueued: result.emailReason === 'queued',
        emailReason: result.emailReason,
        usedAiTailoring: result.usedAiTailoring,
      });
    } catch (error) {
      console.error(`[notifications] Failed sweep for user ${user.id}.`, error);
      results.push({
        userId: user.id,
        created: 0,
        emailSent: false,
        error: error?.message || 'notification_failed',
      });
    }
  }

  return {
    scannedUsers: users.length,
    createdCount: results.reduce((sum, item) => sum + Number(item.created || 0), 0),
    emailSentCount: results.filter((item) => item.emailSent).length,
    emailQueuedCount: results.filter((item) => item.emailQueued).length,
    results,
  };
}

async function listNotificationsForUser(user, filters = {}) {
  return notificationRepository.listNotifications(user.id, filters);
}

async function markNotificationRead(user, notificationId) {
  const notification = await notificationRepository.markRead(user.id, notificationId);
  if (!notification) {
    throw new AppError('Notification not found.', 404);
  }

  return notification;
}

async function markAllNotificationsRead(user) {
  const updated = await notificationRepository.markAllRead(user.id);
  return {
    updated,
  };
}

async function clearNotificationHistory(user) {
  const deleted = await notificationRepository.deleteByUser(user.id);
  return {
    deleted,
    clearedAt: new Date().toISOString(),
  };
}

module.exports = {
  syncNotificationsForUser,
  runDailySweep,
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotificationHistory,
};
