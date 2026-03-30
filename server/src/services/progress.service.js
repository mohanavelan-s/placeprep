const { query } = require('../config/database');
const progressRepository = require('../repositories/progress.repository');
const userRepository = require('../repositories/user.repository');
const { getDateRange, getTodayInTimezone } = require('../utils/date');
const AppError = require('../utils/appError');

function round(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits));
}

function subtractDays(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function buildDateMap(rows, dateKey, valueKey) {
  return rows.reduce((accumulator, row) => {
    accumulator[row[dateKey]] = Number(row[valueKey] || 0);
    return accumulator;
  }, {});
}

function computeStreak(activityDates, referenceDate) {
  const activitySet = new Set(activityDates);
  let streak = 0;
  let cursor = referenceDate;

  while (activitySet.has(cursor)) {
    streak += 1;
    cursor = subtractDays(cursor, 1);
  }

  return streak;
}

function buildTopicStrength(rows) {
  if (!rows.length) {
    return [
      { topic: 'DSA', strength: 0 },
      { topic: 'Core', strength: 0 },
      { topic: 'Project', strength: 0 },
    ];
  }

  return rows.map((row) => ({
    topic: row.topic,
    strength: Number(row.strength),
  }));
}

function normalizeTopic(topic) {
  return String(topic || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueTopics(topics) {
  return Array.from(
    new Set(
      (topics || [])
        .map((topic) => normalizeTopic(topic))
        .filter(Boolean)
    )
  );
}

function buildCoachCommand({ readinessScore, consistencyScore, streak, focusArea, failedAttempts }) {
  if (readinessScore < 45) {
    return `Recovery mode. Rebuild control with one clean win in ${focusArea} today.`;
  }

  if (consistencyScore < 60) {
    return `Ability is not the issue. Repeat ${focusArea} until it becomes automatic.`;
  }

  if (failedAttempts >= 3) {
    return `You are close, but errors in ${focusArea} are still costing time. Slow down and tighten execution.`;
  }

  if (streak >= 7) {
    return `Momentum is on your side. Press ${focusArea} before the window cools off.`;
  }

  return `Stay strict. Advance ${focusArea} before you touch anything comfortable.`;
}

function rankWeakTopic(left, right) {
  return (
    (right.skippedTasks + right.overdueTasks) - (left.skippedTasks + left.overdueTasks)
    || left.completionRate - right.completionRate
    || right.totalTasks - left.totalTasks
  );
}

function rankStrongTopic(left, right) {
  return (
    right.completionRate - left.completionRate
    || left.averageMinutes - right.averageMinutes
    || right.completedTasks - left.completedTasks
  );
}

function buildCoachProfile({
  user,
  topicPerformance,
  topicStrength,
  solvedProblems,
  averageTimePerProblem,
  failedAttempts,
  mistakeCount,
  consistencyScore,
  streak,
  readinessScore,
  loggedDays,
}) {
  const manualWeakAreas = uniqueTopics(user.weakAreas);
  const manualStrongTopics = uniqueTopics(user.strongTopics);

  const weakFromPerformance = topicPerformance
    .filter((topic) =>
      topic.totalTasks > 0
      && (
        topic.completionRate < 0.6
        || topic.skippedTasks > 0
        || topic.overdueTasks > 0
      )
    )
    .sort(rankWeakTopic)
    .map((topic) => topic.topic);

  const strongFromPerformance = topicPerformance
    .filter((topic) =>
      topic.completedTasks > 0
      && topic.completionRate >= 0.75
      && topic.skippedTasks === 0
    )
    .sort(rankStrongTopic)
    .map((topic) => topic.topic);

  const weakTopics = uniqueTopics([
    ...manualWeakAreas,
    ...weakFromPerformance,
    ...(topicStrength.filter((item) => item.strength < 45).map((item) => item.topic)),
  ]).slice(0, 6);

  const strongTopics = uniqueTopics([
    ...manualStrongTopics,
    ...strongFromPerformance,
    ...topicStrength.filter((item) => item.strength >= 70).map((item) => item.topic),
  ])
    .filter((topic) => !weakTopics.includes(topic))
    .slice(0, 6);

  const focusArea =
    weakTopics[0]
    || [...topicPerformance].sort(rankWeakTopic)[0]?.topic
    || strongTopics[0]
    || topicStrength[0]?.topic
    || 'placement prep';

  return {
    solvedProblems,
    weakTopics: weakTopics.length ? weakTopics : ['Dynamic Programming', 'Operating Systems'],
    strongTopics: strongTopics.length ? strongTopics : ['Arrays', 'Implementation'],
    averageTimePerProblem,
    consistencyScore,
    streak,
    readinessScore,
    failedAttempts,
    mistakeCount,
    focusArea,
    trackedDays: loggedDays,
    commandLine: buildCoachCommand({
      readinessScore,
      consistencyScore,
      streak,
      focusArea,
      failedAttempts,
    }),
    lastRefreshedAt: new Date().toISOString(),
  };
}

async function buildSummaryForUser(user) {
  const today = getTodayInTimezone(user.timezone);
  const fourteenDayWindow = getDateRange(14, user.timezone);
  const sevenDayWindow = getDateRange(7, user.timezone);
  const last14Start = fourteenDayWindow[0];
  const last7Start = sevenDayWindow[0];
  const last30Start = subtractDays(today, 29);

  const [
    taskAggregateResult,
    logAggregateResult,
    powerPocketAggregateResult,
    taskDailyResult,
    logDailyResult,
    powerPocketDailyResult,
    activityResult,
    bonusActivityResult,
    topicStrengthResult,
    dsaAggregateResult,
    topicPerformanceResult,
    struggleAggregateResult,
  ] = await Promise.all([
    query(
      `SELECT
         COUNT(*)::INT AS total_tasks,
         COUNT(*) FILTER (WHERE status = 'completed')::INT AS completed_tasks
       FROM tasks
       WHERE user_id = $1 AND scheduled_for BETWEEN $2 AND $3`,
      [user.id, last14Start, today]
    ),
    query(
      `SELECT
         COALESCE(AVG(productivity_score), 0) AS avg_productivity,
         COALESCE(SUM(hours_studied), 0) AS total_hours,
         COUNT(*)::INT AS logged_days
       FROM daily_logs
       WHERE user_id = $1 AND log_date BETWEEN $2 AND $3`,
      [user.id, last14Start, today]
    ),
    query(
      `SELECT
         COALESCE(SUM(duration_minutes), 0)::INT AS total_minutes,
         COUNT(*)::INT AS sessions_count
       FROM power_pocket_sessions
       WHERE user_id = $1
         AND status = 'completed'
         AND DATE(started_at) BETWEEN $2 AND $3`,
      [user.id, last14Start, today]
    ),
    query(
      `SELECT
         scheduled_for::TEXT AS activity_date,
         COUNT(*) FILTER (WHERE status = 'completed')::INT AS completed_tasks
       FROM tasks
       WHERE user_id = $1 AND scheduled_for BETWEEN $2 AND $3
       GROUP BY scheduled_for
       ORDER BY scheduled_for`,
      [user.id, last7Start, today]
    ),
    query(
      `SELECT
         log_date::TEXT AS activity_date,
         COALESCE(SUM(hours_studied), 0) AS hours
       FROM daily_logs
       WHERE user_id = $1 AND log_date BETWEEN $2 AND $3
       GROUP BY log_date
       ORDER BY log_date`,
      [user.id, last7Start, today]
    ),
    query(
      `SELECT
         DATE(started_at)::TEXT AS activity_date,
         COALESCE(SUM(duration_minutes), 0)::INT AS minutes
       FROM power_pocket_sessions
       WHERE user_id = $1
         AND status = 'completed'
         AND DATE(started_at) BETWEEN $2 AND $3
       GROUP BY DATE(started_at)
       ORDER BY DATE(started_at)`,
      [user.id, last7Start, today]
    ),
    query(
      `SELECT DISTINCT activity_date::TEXT
       FROM (
         SELECT log_date AS activity_date
         FROM daily_logs
         WHERE user_id = $1 AND log_date <= $2
         UNION
         SELECT scheduled_for AS activity_date
         FROM tasks
         WHERE user_id = $1 AND status = 'completed' AND scheduled_for <= $2
         UNION
         SELECT DATE(started_at) AS activity_date
         FROM power_pocket_sessions
         WHERE user_id = $1 AND status = 'completed' AND DATE(started_at) <= $2
       ) AS activity
       ORDER BY activity_date DESC`,
      [user.id, today]
    ),
    query(
      `SELECT DISTINCT DATE(started_at)::TEXT AS activity_date
       FROM power_pocket_sessions
       WHERE user_id = $1
         AND status = 'completed'
         AND DATE(started_at) <= $2
       ORDER BY activity_date DESC`,
      [user.id, today]
    ),
    query(
      `SELECT
         COALESCE(NULLIF(weak_area, ''), NULLIF(subcategory, ''), category) AS topic,
         ROUND(
           COALESCE(
             100.0 * COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0),
             0
           )
         )::INT AS strength
       FROM tasks
       WHERE user_id = $1
         AND scheduled_for BETWEEN $2 AND $3
       GROUP BY topic
       ORDER BY strength DESC, topic ASC
       LIMIT 8`,
      [user.id, last30Start, today]
    ),
    query(
      `SELECT
         COUNT(*) FILTER (WHERE category = 'DSA' AND status = 'completed')::INT AS solved_problems,
         COALESCE(
           ROUND(
             AVG(
               CASE
                 WHEN category = 'DSA' AND status = 'completed'
                   THEN GREATEST(COALESCE(NULLIF(actual_minutes, 0), estimated_minutes), estimated_minutes)
               END
             ),
             2
           ),
           0
         ) AS average_time_per_problem,
         COUNT(*) FILTER (WHERE category = 'DSA' AND status = 'skipped')::INT AS skipped_dsa,
         COUNT(*) FILTER (
           WHERE category = 'DSA'
             AND status IN ('pending', 'in_progress')
             AND scheduled_for < $2
         )::INT AS overdue_dsa
       FROM tasks
       WHERE user_id = $1`,
      [user.id, today]
    ),
    query(
      `SELECT
         COALESCE(NULLIF(weak_area, ''), NULLIF(subcategory, ''), category) AS topic,
         category,
         COUNT(*)::INT AS total_tasks,
         COUNT(*) FILTER (WHERE status = 'completed')::INT AS completed_tasks,
         COUNT(*) FILTER (WHERE status = 'skipped')::INT AS skipped_tasks,
         COUNT(*) FILTER (
           WHERE status IN ('pending', 'in_progress')
             AND scheduled_for < $3
         )::INT AS overdue_tasks,
         COALESCE(
           ROUND(
             AVG(
               CASE
                 WHEN status = 'completed'
                   THEN GREATEST(COALESCE(NULLIF(actual_minutes, 0), estimated_minutes), estimated_minutes)
               END
             ),
             2
           ),
           0
         ) AS average_minutes
       FROM tasks
       WHERE user_id = $1
         AND scheduled_for BETWEEN $2 AND $3
       GROUP BY topic, category
       ORDER BY total_tasks DESC, topic ASC`,
      [user.id, last30Start, today]
    ),
    query(
      `SELECT
         COUNT(*) FILTER (
           WHERE COALESCE(NULLIF(TRIM(blockers), ''), NULLIF(TRIM(notes), '')) IS NOT NULL
         )::INT AS blocker_days
       FROM daily_logs
       WHERE user_id = $1
         AND log_date BETWEEN $2 AND $3`,
      [user.id, last30Start, today]
    ),
  ]);

  const totalTasks = Number(taskAggregateResult.rows[0]?.total_tasks || 0);
  const completedTasks = Number(taskAggregateResult.rows[0]?.completed_tasks || 0);
  const executionRate = totalTasks ? round((completedTasks / totalTasks) * 100) : 0;
  const avgProductivity = round(logAggregateResult.rows[0]?.avg_productivity || 0);
  const totalLogHours = round(logAggregateResult.rows[0]?.total_hours || 0);
  const loggedDays = Number(logAggregateResult.rows[0]?.logged_days || 0);
  const totalPowerPocketMinutes = Number(powerPocketAggregateResult.rows[0]?.total_minutes || 0);
  const activeDays = fourteenDayWindow.filter((date) =>
    activityResult.rows.some((row) => row.activity_date === date)
  ).length;
  const streak = computeStreak(
    activityResult.rows.map((row) => row.activity_date),
    today
  );
  const bonusStreak = computeStreak(
    bonusActivityResult.rows.map((row) => row.activity_date),
    today
  );
  const consistencyScore = round((activeDays / fourteenDayWindow.length) * 100);
  const topicStrength = buildTopicStrength(topicStrengthResult.rows);
  const categoryCoverage = new Set(topicStrength.map((item) => item.topic)).size;
  const coverageScore = round((Math.min(categoryCoverage, 6) / 6) * 100);
  const powerPocketBoost = Math.min(100, round((totalPowerPocketMinutes / 180) * 100));
  const readinessScore = round(
    (executionRate * 0.4)
      + (consistencyScore * 0.25)
      + (avgProductivity * 0.2)
      + (coverageScore * 0.1)
      + (powerPocketBoost * 0.05)
  );
  const totalHours = round(totalLogHours + (totalPowerPocketMinutes / 60));
  const focusScore = round((avgProductivity * 0.7) + (executionRate * 0.3));
  const disciplineIndex = round((consistencyScore * 0.6) + (powerPocketBoost * 0.4));

  const solvedProblems = Number(dsaAggregateResult.rows[0]?.solved_problems || 0);
  const averageTimePerProblem = round(
    dsaAggregateResult.rows[0]?.average_time_per_problem || 0
  );
  const failedAttempts = Number(dsaAggregateResult.rows[0]?.skipped_dsa || 0)
    + Number(dsaAggregateResult.rows[0]?.overdue_dsa || 0);
  const mistakeCount = failedAttempts
    + Number(struggleAggregateResult.rows[0]?.blocker_days || 0)
    + topicPerformanceResult.rows.reduce(
      (count, row) => count + Number(row.skipped_tasks || 0),
      0
    );

  const topicPerformance = topicPerformanceResult.rows.map((row) => {
    const totalTopicTasks = Number(row.total_tasks || 0);
    const completedTopicTasks = Number(row.completed_tasks || 0);
    return {
      topic: normalizeTopic(row.topic),
      category: row.category,
      totalTasks: totalTopicTasks,
      completedTasks: completedTopicTasks,
      skippedTasks: Number(row.skipped_tasks || 0),
      overdueTasks: Number(row.overdue_tasks || 0),
      averageMinutes: round(row.average_minutes || 0),
      completionRate: totalTopicTasks ? completedTopicTasks / totalTopicTasks : 0,
    };
  }).filter((topic) => topic.topic);

  const coachProfile = buildCoachProfile({
    user,
    topicPerformance,
    topicStrength,
    solvedProblems,
    averageTimePerProblem,
    failedAttempts,
    mistakeCount,
    consistencyScore,
    streak,
    readinessScore,
    loggedDays,
  });

  const tasksByDay = buildDateMap(taskDailyResult.rows, 'activity_date', 'completed_tasks');
  const logHoursByDay = buildDateMap(logDailyResult.rows, 'activity_date', 'hours');
  const pocketMinutesByDay = buildDateMap(powerPocketDailyResult.rows, 'activity_date', 'minutes');

  const weeklyProgress = sevenDayWindow.map((date) => ({
    date,
    day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0),
    missions: tasksByDay[date] || 0,
    hours: round((logHoursByDay[date] || 0) + ((pocketMinutesByDay[date] || 0) / 60)),
  }));

  const todayMissions = tasksByDay[today] || 0;
  const todayHours = round((logHoursByDay[today] || 0) + ((pocketMinutesByDay[today] || 0) / 60));

  const stat = await progressRepository.upsertProgressStat({
    userId: user.id,
    statDate: today,
    streak,
    bonusStreak,
    consistencyScore,
    readinessScore,
    executionRate,
    totalHours,
    tasksCompleted: completedTasks,
    powerPocketMinutes: totalPowerPocketMinutes,
    metadata: {
      focusScore,
      disciplineIndex,
      avgProductivity,
      loggedDays,
      weeklyProgress,
      topicStrength,
      coachProfile,
      today: {
        date: today,
        tasksCompleted: todayMissions,
        hoursLogged: todayHours,
      },
    },
  });

  await userRepository.updateUser(user.id, {
    weakAreas: coachProfile.weakTopics,
    strongTopics: coachProfile.strongTopics,
    solvedProblems: coachProfile.solvedProblems,
    averageTimePerProblem: coachProfile.averageTimePerProblem,
    failedAttempts: coachProfile.failedAttempts,
    mistakeCount: coachProfile.mistakeCount,
    consistencyScore: coachProfile.consistencyScore,
    currentStreak: coachProfile.streak,
    readinessScore: coachProfile.readinessScore,
    coachMetadata: {
      focusArea: coachProfile.focusArea,
      commandLine: coachProfile.commandLine,
      trackedDays: coachProfile.trackedDays,
      topicPerformance,
      lastRefreshedAt: coachProfile.lastRefreshedAt,
    },
  });

  return {
    stat,
    focusScore,
    disciplineIndex,
    executionRate,
    totalHoursLogged: totalHours,
    missionsCompleted: completedTasks,
    streak,
    bonusStreak,
    consistencyScore,
    readinessScore,
    weeklyProgress,
    topicStrength,
    coachProfile,
  };
}

async function resolveUser(userId, timezone) {
  if (typeof userId === 'object' && userId?.id) {
    return userId;
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  if (timezone && !user.timezone) {
    user.timezone = timezone;
  }

  return user;
}

async function refreshProgressStats(userIdOrUser, timezone) {
  const user = await resolveUser(userIdOrUser, timezone);
  return buildSummaryForUser(user);
}

async function getSummary(user) {
  return buildSummaryForUser(user);
}

async function getCoachProfile(userIdOrUser, timezone) {
  const summary = await refreshProgressStats(userIdOrUser, timezone);
  return summary.coachProfile;
}

async function getHistory(user, days = 14) {
  await buildSummaryForUser(user);
  return progressRepository.listHistory(user.id, days);
}

module.exports = {
  refreshProgressStats,
  getSummary,
  getCoachProfile,
  getHistory,
};
