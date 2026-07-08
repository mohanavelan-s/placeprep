const { query } = require('../config/database');
const env = require('../config/env');
const aiGateway = require('./aiGateway.service');
const progressRepository = require('../repositories/progress.repository');
const notificationRepository = require('../repositories/notification.repository');
const prepPlanRepository = require('../repositories/prepPlan.repository');
const userRepository = require('../repositories/user.repository');
const { sendNotificationDigestEmail, isEmailDeliveryReady } = require('./email.service');
const {
  enqueueNotificationPush,
} = require('./deliveryJob.service');
const { sendPushNotificationToUser } = require('./webPush.service');
const progressService = require('./progress.service');
const userProfileService = require('./userProfile.service');
const AppError = require('../utils/appError');
const { buildPrepArchitectTaskVisibilityClause } = require('../utils/taskVisibility');
const { formatDateInTimezone, getTodayInTimezone } = require('../utils/date');

const priorityMap = {
  plan_pulse: 7,
  consistency_pulse: 6,
  countdown_urgency: 5,
  missed_streak: 4,
  pending_tasks: 3,
  daily_inactivity: 2,
  motivation: 1,
  test_notification: 0,
};

const titleMap = {
  plan_pulse: 'Plan pulse',
  consistency_pulse: 'Consistency pulse',
  countdown_urgency: 'Deadline pressure',
  missed_streak: 'Streak warning',
  pending_tasks: 'Pending tasks',
  daily_inactivity: 'Return to command',
  motivation: 'Nocturne push',
  test_notification: 'Notification test',
};

const windowLabelMap = {
  morning: 'Morning pulse',
  evening: 'Evening close',
  idle_6h: 'Six-hour check-in',
  idle_8h: 'Eight-hour recovery',
  manual: 'Manual sync',
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

function differenceInHours(fromDate, toDate = new Date()) {
  if (!fromDate) {
    return 999;
  }

  const diffMs = new Date(toDate).getTime() - new Date(fromDate).getTime();
  if (!Number.isFinite(diffMs)) {
    return 999;
  }

  return Math.max(0, Math.floor(diffMs / 3600000));
}

function shouldTriggerUrgency(daysLeft) {
  return [30, 21, 14, 10, 7, 5, 3, 2, 1, 0].includes(daysLeft);
}

function sortCandidates(left, right) {
  return (priorityMap[right.type] || 0) - (priorityMap[left.type] || 0);
}

function getZonedTimeParts(timezone, date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour || 0),
    minute: Number(map.minute || 0),
  };
}

function isWithinNotificationWindow(currentMinutes, targetHour, windowMinutes) {
  const startMinutes = targetHour * 60;
  return currentMinutes >= startMinutes && currentMinutes < (startMinutes + windowMinutes);
}

function resolveDeliveryWindow({ timezone, requestedWindow = null, now = new Date(), hoursSinceLastLogin = 0 }) {
  if (requestedWindow === 'manual') {
    const parts = getZonedTimeParts(timezone, now);
    return {
      key: 'manual',
      label: windowLabelMap.manual,
      localDate: parts.date,
    };
  }

  const parts = getZonedTimeParts(timezone, now);
  const currentMinutes = (parts.hour * 60) + parts.minute;
  const windowMinutes = Math.max(Number(env.notificationSlotWindowMinutes || 75), 15);

  if (isWithinNotificationWindow(currentMinutes, env.notificationMorningHour, windowMinutes)) {
    return {
      key: 'morning',
      label: windowLabelMap.morning,
      localDate: parts.date,
    };
  }

  if (isWithinNotificationWindow(currentMinutes, env.notificationEveningHour, windowMinutes)) {
    return {
      key: 'evening',
      label: windowLabelMap.evening,
      localDate: parts.date,
    };
  }

  if (hoursSinceLastLogin >= 8) {
    return {
      key: 'idle_8h',
      label: windowLabelMap.idle_8h,
      localDate: parts.date,
    };
  }

  if (hoursSinceLastLogin >= 6) {
    return {
      key: 'idle_6h',
      label: windowLabelMap.idle_6h,
      localDate: parts.date,
    };
  }

  return null;
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
       COUNT(*)::INT AS total_count,
       COUNT(*) FILTER (WHERE status = 'completed')::INT AS completed_count,
       COUNT(*) FILTER (WHERE scheduled_for <= $2)::INT AS planned_due_count,
       COUNT(*) FILTER (
         WHERE status = 'completed'
           AND scheduled_for <= $2
       )::INT AS completed_due_count,
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
    totalCount: Number(result.rows[0]?.total_count || 0),
    completedCount: Number(result.rows[0]?.completed_count || 0),
    plannedDueCount: Number(result.rows[0]?.planned_due_count || 0),
    completedDueCount: Number(result.rows[0]?.completed_due_count || 0),
    pendingCount: Number(result.rows[0]?.pending_count || 0),
    overdueCount: Number(result.rows[0]?.overdue_count || 0),
  };
}

function buildPlanPaceSnapshot(taskSnapshot = {}) {
  const plannedDueCount = Number(taskSnapshot.plannedDueCount || 0);
  const completedDueCount = Number(taskSnapshot.completedDueCount || 0);
  const totalCount = Number(taskSnapshot.totalCount || 0);
  const completedCount = Number(taskSnapshot.completedCount || 0);
  const delta = completedDueCount - plannedDueCount;
  const remainingCount = Math.max(totalCount - completedCount, Number(taskSnapshot.pendingCount || 0));
  const completionPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  let status = 'on_track';
  let label = 'On track with the plan';
  if (delta > 0) {
    status = 'ahead';
    label = `${delta} task${delta === 1 ? '' : 's'} ahead of plan`;
  } else if (delta < 0) {
    status = 'behind';
    label = `${Math.abs(delta)} task${Math.abs(delta) === 1 ? '' : 's'} behind plan`;
  }

  return {
    status,
    label,
    delta,
    plannedDueCount,
    completedDueCount,
    totalCount,
    completedCount,
    remainingCount,
    completionPercent,
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
  hoursSinceLastLogin,
  daysLeft,
  streakBroken,
  deliveryWindow,
}) {
  const candidates = [];
  const readiness = Number(summary?.readinessScore || 0);
  const slotKey = deliveryWindow?.key || 'manual';
  const dedupeSuffix = `${today}:${slotKey}`;

  if (slotKey === 'morning' || slotKey === 'evening') {
    candidates.push({
      type: 'plan_pulse',
      dedupeKey: `plan-pulse:${dedupeSuffix}`,
      metadata: {
        pendingCount: taskSnapshot.pendingCount,
        overdueCount: taskSnapshot.overdueCount,
        remainingCount: taskSnapshot.remainingCount,
        planPaceLabel: taskSnapshot.planPaceLabel,
        deliveryWindow: slotKey,
      },
    });

    candidates.push({
      type: 'consistency_pulse',
      dedupeKey: `consistency-pulse:${dedupeSuffix}`,
      metadata: {
        readinessScore: readiness,
        consistencyScore: Number(summary?.consistencyScore || 0),
        streak: Number(summary?.streak || 0),
        deliveryWindow: slotKey,
      },
    });
  }

  if ((daysSinceLastLogin >= 1 || hoursSinceLastLogin >= 6) && slotKey !== 'morning') {
    candidates.push({
      type: 'daily_inactivity',
      dedupeKey: `daily-inactivity:${dedupeSuffix}`,
      metadata: {
        daysSinceLastLogin,
        hoursSinceLastLogin,
        deliveryWindow: slotKey,
      },
    });
  }

  if (taskSnapshot.pendingCount > 0) {
    candidates.push({
      type: 'pending_tasks',
      dedupeKey: `pending-tasks:${dedupeSuffix}`,
      metadata: {
        pendingCount: taskSnapshot.pendingCount,
        overdueCount: taskSnapshot.overdueCount,
        remainingCount: taskSnapshot.remainingCount,
        planPaceLabel: taskSnapshot.planPaceLabel,
        deliveryWindow: slotKey,
      },
    });
  }

  if (streakBroken || (slotKey === 'evening' && Number(summary?.streak || 0) === 0)) {
    candidates.push({
      type: 'missed_streak',
      dedupeKey: `missed-streak:${dedupeSuffix}`,
      metadata: {
        streak: Number(summary?.streak || 0),
        deliveryWindow: slotKey,
      },
    });
  }

  if (daysLeft !== null && daysLeft <= 30 && shouldTriggerUrgency(daysLeft)) {
    candidates.push({
      type: 'countdown_urgency',
      dedupeKey: `countdown:${daysLeft}:${slotKey}`,
      metadata: {
        daysLeft,
        deliveryWindow: slotKey,
      },
    });
  }

  if (
    !candidates.length
    || readiness < 58
    || slotKey === 'morning'
    || (slotKey === 'evening' && Number(summary?.consistencyScore || 0) < 82)
  ) {
    candidates.push({
      type: 'motivation',
      dedupeKey: `motivation:${dedupeSuffix}`,
      metadata: {
        readinessScore: readiness,
        deliveryWindow: slotKey,
      },
    });
  }

  return candidates.sort(sortCandidates).slice(0, 2);
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
  hoursSinceLastLogin,
  daysLeft,
  placementDate,
  planSnapshot,
  deliveryWindow,
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
    hoursSinceLastLogin,
    pendingCount: Number(taskSnapshot.pendingCount || 0),
    overdueCount: Number(taskSnapshot.overdueCount || 0),
    planPace: taskSnapshot.planPace || buildPlanPaceSnapshot(taskSnapshot),
    planPaceLabel: compactText(taskSnapshot.planPaceLabel || taskSnapshot.planPace?.label),
    remainingTaskCount: Number(taskSnapshot.remainingCount || 0),
    nextTask,
    pendingTasks,
    planId: planSnapshot?.id || null,
    planCoachLine: compactText(planSnapshot?.coachLine),
    planTargetTopics: planSnapshot?.targetTopics || [],
    planKnownTopics: planSnapshot?.knownTopics || [],
    planFirstTheme: compactText(planSnapshot?.firstTheme),
    planFirstItems: planSnapshot?.firstItems || [],
    planTimePerDay: Number(planSnapshot?.timePerDay || 0),
    deliveryWindow: deliveryWindow?.key || 'manual',
    deliveryWindowLabel: deliveryWindow?.label || windowLabelMap.manual,
  };
}

function buildFallbackSummaryLine(context) {
  const focus = context.focusArea || context.weakTopics[0] || 'placement prep';
  const role = context.targetRole || 'placement prep';
  const windowLabel = context.deliveryWindow === 'morning' ? 'morning' : context.deliveryWindow === 'evening' ? 'evening' : 'next';

  if (context.deliveryWindow === 'morning') {
    return `${focus} sets the tone this morning. Start clean for ${role}.`;
  }

  if (context.daysLeft !== null && context.daysLeft <= 14) {
    return `${focus} will decide your ${role} finish. Close one clean block this ${windowLabel}.`;
  }

  if (context.pendingCount > 0) {
    return `${focus} is still exposed. Clear one real task this ${windowLabel}.`;
  }

  return `${focus} is the pressure point. Build one honest hour around it this ${windowLabel}.`;
}

function buildFallbackNotificationCopy(candidate, context) {
  const focus = context.focusArea || context.weakTopics[0] || 'placement prep';
  const nextWeak = context.weakTopics[1] || focus;
  const role = context.targetRole || 'placement prep';
  const nextTaskTitle = context.nextTask?.title || `${focus} recovery block`;
  const nextTaskDuration = formatHoursLabel(context.nextTask?.estimatedMinutes || 60);
  const planTheme = context.planFirstTheme || context.planTargetTopics[0] || focus;
  const isMorning = context.deliveryWindow === 'morning';
  const isEvening = context.deliveryWindow === 'evening';
  const rhythmLabel = isMorning ? 'morning' : isEvening ? 'evening' : 'next block';

  switch (candidate.type) {
    case 'plan_pulse':
      return {
        subject: `PlacePrep | ${isMorning ? 'Morning plan' : 'Evening plan'}`,
        headline: context.planPaceLabel || `${planTheme} is the current plan pressure.`,
        preview: context.pendingCount > 0
          ? `${context.pendingCount} tasks are still open for ${role}.`
          : `Use ${planTheme} to keep the plan moving.`,
        message: context.pendingCount > 0
          ? `Your ${role} plan still has ${context.pendingCount} open tasks. Start with ${nextTaskTitle} and protect the ${rhythmLabel} block.`
          : `Your ${role} plan stays alive through ${planTheme}. Build one clean ${rhythmLabel} block and log it honestly.`,
        actionLabel: isMorning ? 'Start plan' : 'Close plan',
        actionText: `Work on ${nextTaskTitle} for ${nextTaskDuration}.`,
        whyNow: context.planPaceLabel || `${planTheme} is the next visible part of the plan.`,
      };
    case 'consistency_pulse':
      return {
        subject: `PlacePrep | ${isMorning ? 'Morning consistency' : 'Evening consistency'}`,
        headline: `Consistency is ${Math.round(context.consistencyScore)}. Streak is ${Math.round(context.streak)}.`,
        preview: isMorning ? 'Set the day with one clean rep.' : 'Close the day without leaving drift behind.',
        message: `Your ${role} consistency is built through ${focus}. Do one measurable ${rhythmLabel} block and keep the streak honest.`,
        actionLabel: isMorning ? 'Set rhythm' : 'Log progress',
        actionText: `Complete ${nextTaskTitle}, then record the outcome.`,
        whyNow: `Readiness is ${Math.round(context.readinessScore)} and consistency is ${Math.round(context.consistencyScore)}.`,
      };
    case 'daily_inactivity':
      return {
        subject: `PlacePrep | ${isMorning ? 'Morning reset' : 'Return to the work'}`,
        headline: context.daysSinceLastLogin >= 2
          ? `${focus} has been idle for ${context.daysSinceLastLogin} days.`
          : `${focus} has been idle for ${context.hoursSinceLastLogin || 6} hours.`,
        preview: `Return through ${nextTaskTitle} this ${rhythmLabel}.`,
        message: `Your ${role} prep is drifting at ${focus}. Re-enter with ${nextTaskTitle} and keep the block honest this ${rhythmLabel}.`,
        actionLabel: isMorning ? 'Restart' : 'Return now',
        actionText: `Start ${nextTaskTitle} for ${nextTaskDuration}.`,
        whyNow: context.daysSinceLastLogin >= 1
          ? `${context.daysSinceLastLogin} days away turns one soft spot into two.`
          : `${context.hoursSinceLastLogin || 6} hours away is enough for drift to set in.`,
      };
    case 'pending_tasks':
      return {
        subject: `PlacePrep | ${isMorning ? 'Morning task brief' : 'Evening task close'}`,
        headline: context.overdueCount > 0
          ? `${context.overdueCount} tasks have already slipped.`
          : `${context.pendingCount} tasks are still waiting.`,
        preview: `${focus} is still exposed for ${role}.`,
        message: `Backlog pressure is sitting on ${focus}. Start with ${nextTaskTitle} and remove one open loop this ${rhythmLabel}.`,
        actionLabel: isMorning ? 'Start clean' : 'Close one',
        actionText: `Finish ${nextTaskTitle}, then revise ${nextWeak}.`,
        whyNow: context.planPace?.status === 'behind'
          ? context.planPace.label
          : context.overdueCount > 0
          ? `${context.overdueCount} overdue tasks are already taxing focus.`
          : `${context.pendingCount} open tasks still block a clean day.`,
      };
    case 'missed_streak':
      return {
        subject: `PlacePrep | ${isEvening ? 'Protect the streak' : 'Rebuild momentum'}`,
        headline: `The streak needs work in ${focus}.`,
        preview: 'One clean win reopens momentum.',
        message: `Discipline slipped, not ability. Reclaim control through ${planTheme} before you touch anything comfortable this ${rhythmLabel}.`,
        actionLabel: 'Rebuild',
        actionText: `Finish one focused ${focus} block this ${rhythmLabel}.`,
        whyNow: 'A broken streak is easiest to repair on the very next day.',
      };
    case 'countdown_urgency':
      return {
        subject: `PlacePrep | ${isMorning ? 'Morning countdown' : 'Deadline pressure'}`,
        headline: `${context.daysLeft} days left. ${focus} cannot stay soft.`,
        preview: `${role} pressure is no longer abstract.`,
        message: `${focus} is still the gap between effort and readiness. Use this ${rhythmLabel} to close one measurable block before the deadline tightens further.`,
        actionLabel: 'Tighten up',
        actionText: `Prioritize ${nextTaskTitle} before anything else.`,
        whyNow: `Readiness is ${Math.round(context.readinessScore)} with ${context.daysLeft} days remaining.`,
      };
    case 'motivation':
    default:
      return {
        subject: `PlacePrep | ${isMorning ? 'Morning motivation' : 'Consistency reminder'}`,
        headline: isMorning
          ? `${focus} decides how this day starts.`
          : `${focus} still decides the next version of you.`,
        preview: isMorning
          ? 'Open the day with one honest block.'
          : 'Close the day with one honest block.',
        message: `Your edge for ${role} still runs through ${focus}. Build one clean block, then lock the lesson before this ${rhythmLabel} ends.`,
        actionLabel: isMorning ? 'Start strict' : 'Stay strict',
        actionText: `Finish ${nextTaskTitle} and note the pattern.`,
        whyNow: `Consistency is still built through ${cleanList([focus, nextWeak], 2).join(' and ')} right now.`,
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

  const result = await aiGateway.requestJson(
    [
            'You write premium notification copy for PlacePrep, a private placement-prep command center.',
            'Tone: strict, direct, personal, disciplined, no fluff, no spam language, no exclamation marks.',
            'Use the actual weak areas, role target, streak, readiness, countdown, and next task.',
            'Do not shame the user. Push them clearly and specifically.',
            'Return only JSON.',
    ].join(' '),
    [
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
                deliveryWindow: context.deliveryWindow,
                deliveryWindowLabel: context.deliveryWindowLabel,
                daysSinceLastLogin: context.daysSinceLastLogin,
                hoursSinceLastLogin: context.hoursSinceLastLogin,
                pendingCount: context.pendingCount,
                overdueCount: context.overdueCount,
                remainingTaskCount: context.remainingTaskCount,
                planPace: context.planPace,
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
    () => null,
    { label: 'notification-personalization' },
  );

  if (result.usedFallback || !result.data) {
    return fallbackResult;
  }

  try {
    const data = result.data;
    const itemMap = new Map(
      (Array.isArray(data.notifications) ? data.notifications : [])
        .map((item) => [compactText(item.type), item])
        .filter(([type]) => type)
    );

    return {
      summaryLine: pickText(data.summaryLine, fallbackResult.summaryLine, 140),
      copies: candidates.map((candidate) =>
        normalizePersonalizedCopy(itemMap.get(candidate.type), candidate, context)
      ),
      usedFallback: false,
    };
  } catch {
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
      emailError: null,
      emailReady: isEmailDeliveryReady(),
      usedAiTailoring: false,
    };
  }

  const timezone = user.timezone || env.defaultTimezone;
  const now = options.now || new Date();
  const hoursSinceLastLogin = differenceInHours(user.lastLoginAt, now);
  const deliveryWindow = resolveDeliveryWindow({
    timezone,
    requestedWindow: options.deliveryWindow
      || ((options.previewOnly || options.source === 'manual' || options.processDeliveryNow) ? 'manual' : null),
    now,
    hoursSinceLastLogin,
  });

  if (!deliveryWindow && !options.previewOnly) {
    return {
      created: [],
      emailAttempted: false,
      emailSent: false,
      emailReason: profile.notificationEmailEnabled ? 'outside_window' : 'email_disabled',
      emailError: null,
      emailReady: isEmailDeliveryReady(),
      usedAiTailoring: false,
      skippedReason: 'outside_window',
    };
  }

  const today = deliveryWindow?.localDate || getTodayInTimezone(timezone);
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
  const planPace = buildPlanPaceSnapshot(taskSnapshot);
  const enrichedTaskSnapshot = {
    ...taskSnapshot,
    planPace,
    planPaceLabel: planPace.label,
    remainingCount: planPace.remainingCount,
  };

  const candidates = buildNotificationCandidates({
    today,
    summary,
    taskSnapshot: enrichedTaskSnapshot,
    daysSinceLastLogin,
    hoursSinceLastLogin,
    daysLeft,
    streakBroken,
    deliveryWindow,
  });
  const notificationContext = buildNotificationContext({
    user,
    summary,
    taskSnapshot: enrichedTaskSnapshot,
    pendingTasks,
    daysSinceLastLogin,
    hoursSinceLastLogin,
    daysLeft,
    placementDate,
    planSnapshot: buildPlanSnapshot(latestPlan),
    deliveryWindow,
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
          deliveryWindow: notificationContext.deliveryWindow,
          deliveryWindowLabel: notificationContext.deliveryWindowLabel,
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
          planPace: notificationContext.planPace,
          planPaceLabel: notificationContext.planPaceLabel,
          remainingTaskCount: notificationContext.remainingTaskCount,
          placementDate: notificationContext.placementDate,
          daysLeft: notificationContext.daysLeft,
          aiTailored: !personalization.usedFallback,
        },
      };
    });

    let previewEmailResult = {
      attempted: false,
      sent: false,
      reason: profile.notificationEmailEnabled ? 'delivery_skipped' : 'email_disabled',
      error: null,
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
      emailError: previewEmailResult.error || null,
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
        deliveryWindow: notificationContext.deliveryWindow,
        deliveryWindowLabel: notificationContext.deliveryWindowLabel,
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
        planPace: notificationContext.planPace,
        planPaceLabel: notificationContext.planPaceLabel,
        remainingTaskCount: notificationContext.remainingTaskCount,
        placementDate: notificationContext.placementDate,
        daysLeft: notificationContext.daysLeft,
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
    error: null,
  };

  if (notificationsForEmail.length && options.deliverEmail && profile.notificationEmailEnabled) {
    emailResult = await sendNotificationDigestEmail({
      user,
      notifications: notificationsForEmail,
      summary,
      context: {
        ...notificationContext,
        summaryLine: personalization.summaryLine,
        usedAiTailoring: !personalization.usedFallback,
      },
    });

    if (emailResult.sent) {
      await notificationRepository.markEmailed(
        notificationsForEmail.map((notification) => notification.id)
      );
    }
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
    emailError: emailResult.error || null,
    emailReady: isEmailDeliveryReady(),
    usedAiTailoring: !personalization.usedFallback,
  };
}

async function sendTestPushNotification(userOrId) {
  const user = await resolveUser(userOrId);
  const profile = await userProfileService.getProfile(user);
  const emailReady = Boolean(
    profile.notificationsEnabled
    && profile.notificationEmailEnabled
    && isEmailDeliveryReady()
  );
  const browserReady = Boolean(
    profile.notificationsEnabled
    && profile.notificationBrowserEnabled
    && profile.notificationBrowserPermission === 'granted'
  );

  if (!profile.notificationsEnabled) {
    return {
      notification: null,
      attempted: false,
      sentCount: 0,
      failedCount: 0,
      reason: 'notifications_disabled',
      browserReady,
      pushReady: false,
      emailAttempted: false,
      emailSent: false,
      emailReason: 'notifications_disabled',
      emailError: null,
      emailReady,
    };
  }

  if (!browserReady && !profile.notificationEmailEnabled) {
    return {
      notification: null,
      attempted: false,
      sentCount: 0,
      failedCount: 0,
      reason: profile.notificationBrowserPermission !== 'granted'
        ? 'browser_permission_not_granted'
        : 'browser_notifications_disabled',
      browserReady: false,
      pushReady: false,
      emailAttempted: false,
      emailSent: false,
      emailReason: 'email_notifications_disabled',
      emailError: null,
      emailReady,
    };
  }

  const notification = await notificationRepository.createNotification({
    userId: user.id,
    type: 'test_notification',
    message: 'This is your PlacePrep test notification. Delivery was requested from Settings.',
    sentAt: new Date().toISOString(),
    deliveryChannels: [
      ...(profile.notificationEmailEnabled ? ['email'] : []),
      ...(browserReady ? ['browser', 'push'] : []),
    ],
    metadata: {
      source: 'manual_push_test',
      title: 'PlacePrep test notification',
      subject: 'PlacePrep notification test',
      headline: 'Notification test requested.',
      preview: 'Delivery status is reported by each channel.',
      actionLabel: 'Open settings',
      actionText: 'Return to notification settings.',
      whyNow: 'Manual delivery test requested from Settings.',
      summaryLine: 'This test records the request while each channel reports its own delivery status.',
      targetRole: user.targetRole || 'Placement preparation',
      focusArea: user.weakAreas?.[0] || 'placement prep',
      route: '/settings',
    },
    dedupeKey: `manual-push-test:${user.id}:${Date.now()}`,
  });

  const pushResult = browserReady
    ? await sendPushNotificationToUser({
        userId: user.id,
        notification,
      })
    : {
        attempted: false,
        sentCount: 0,
        failedCount: 0,
        reason: profile.notificationBrowserPermission !== 'granted'
          ? 'browser_permission_not_granted'
          : 'browser_notifications_disabled',
      };

  let emailResult = {
    attempted: false,
    sent: false,
    reason: profile.notificationEmailEnabled ? 'email_not_configured' : 'email_notifications_disabled',
    error: null,
  };

  if (profile.notificationEmailEnabled) {
    if (!isEmailDeliveryReady()) {
      emailResult = {
        attempted: false,
        sent: false,
        reason: 'email_not_configured',
        error: null,
      };
    } else {
      try {
        emailResult = await sendNotificationDigestEmail({
          user,
          notifications: [notification],
          summary: {
            readinessScore: user.readinessScore,
            streak: user.currentStreak,
            consistencyScore: user.consistencyScore,
            coachProfile: {
              focusArea: user.weakAreas?.[0] || 'placement prep',
              weakTopics: user.weakAreas || [],
              strongTopics: user.strongTopics || [],
              commandLine: 'Manual notification delivery test requested from Settings.',
            },
          },
          context: {
            targetRole: user.targetRole || 'Placement preparation',
            focusArea: user.weakAreas?.[0] || 'placement prep',
            weakTopics: user.weakAreas || [],
            strongTopics: user.strongTopics || [],
            summaryLine: 'This confirms PlacePrep can send email to your saved account address.',
            deliveryWindowLabel: 'Manual test',
          },
        });

        if (emailResult.sent) {
          await notificationRepository.markEmailed([notification.id]);
        }
      } catch (error) {
        console.error('[notifications] Failed to send test email.', error);
        emailResult = {
          attempted: true,
          sent: false,
          reason: error?.message || 'email_failed',
          error: error?.message || 'email_failed',
        };
      }
    }
  }

  return {
    notification,
    attempted: pushResult.attempted,
    sentCount: pushResult.sentCount,
    failedCount: pushResult.failedCount,
    reason: pushResult.reason,
    browserReady,
    pushReady: pushResult.sentCount > 0,
    emailAttempted: emailResult.attempted,
    emailSent: emailResult.sent,
    emailReason: emailResult.reason,
    emailError: emailResult.error || null,
    emailReady,
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
  sendTestPushNotification,
  runDailySweep,
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotificationHistory,
};
