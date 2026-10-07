package com.placeprep.service;

import com.placeprep.model.ProgressStat;
import com.placeprep.model.User;
import com.placeprep.repository.ProgressRepository;
import com.placeprep.repository.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@Service
public class ProgressService {

    private final ProgressRepository progressRepository;
    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;

    public ProgressService(ProgressRepository progressRepository, UserRepository userRepository, JdbcTemplate jdbcTemplate) {
        this.progressRepository = progressRepository;
        this.userRepository = userRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> getSummary(User user) {
        Optional<ProgressStat> latestOpt = progressRepository.findLatestByUserId(user.getId());

        int streak = user.getCurrentStreak();
        double readiness = user.getReadinessScore();
        double consistency = user.getConsistencyScore();

        // Calculate completed tasks today
        Integer todayTasks = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM tasks WHERE user_id = ? AND status = 'completed' AND completed_at::date = CURRENT_DATE",
                Integer.class,
                user.getId()
        );

        Integer totalCompletedTasks = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM tasks WHERE user_id = ? AND status = 'completed'",
                Integer.class,
                user.getId()
        );

        List<Map<String, Object>> topicStrength = List.of(
                Map.of("topic", "DSA", "strength", user.getStrongTopics().contains("DSA") ? 85 : 60),
                Map.of("topic", "Core Subjects", "strength", user.getStrongTopics().contains("Core") ? 80 : 55),
                Map.of("topic", "System Design & Projects", "strength", user.getStrongTopics().contains("Project") ? 75 : 50)
        );

        String coachCommand = readiness >= 75
                ? "Excellent momentum! Focus on advanced algorithmic problems and mock interviews."
                : readiness >= 50
                ? "Good consistency! Strengthen weak topics and complete daily targets."
                : "Build daily streak. Solve at least 2 fundamental DSA problems today.";

        Map<String, Object> summary = new HashMap<>();
        summary.put("streak", streak > 0 ? streak : (latestOpt.map(ProgressStat::getStreak).orElse(1)));
        summary.put("bonusStreak", latestOpt.map(ProgressStat::getBonusStreak).orElse(0));
        summary.put("consistencyScore", consistency > 0 ? consistency : 65.0);
        summary.put("readinessScore", readiness > 0 ? readiness : 50.0);
        summary.put("executionRate", latestOpt.map(ProgressStat::getExecutionRate).orElse(75.0));
        summary.put("totalHours", latestOpt.map(ProgressStat::getTotalHours).orElse(12.5));
        summary.put("tasksCompleted", totalCompletedTasks != null ? totalCompletedTasks : 0);
        summary.put("coachCommand", coachCommand);
        summary.put("topicStrength", topicStrength);
        summary.put("today", Map.of(
                "date", LocalDate.now().toString(),
                "tasksCompleted", todayTasks != null ? todayTasks : 0,
                "hoursLogged", 1.5
        ));

        return summary;
    }

    public List<ProgressStat> getHistory(User user, int days) {
        return progressRepository.findHistoryByUserId(user.getId(), Math.clamp(days, 1, 90));
    }

    public Map<String, Object> clearHistory(User user) {
        int deleted = progressRepository.clearHistory(user.getId());
        return Map.of("success", true, "deleted", deleted);
    }

    public void refreshProgressStats(UUID userId, String timezone) {
        ZoneId zone = ZoneId.of(timezone != null && !timezone.isBlank() ? timezone : "Asia/Calcutta");
        LocalDate today = LocalDate.now(zone);
        LocalDate last14Start = today.minusDays(13);
        LocalDate last30Start = today.minusDays(29);

        // 1. Task aggregates (last 14 days)
        Integer totalTasks = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM tasks WHERE user_id = ? AND scheduled_for BETWEEN ? AND ?",
                Integer.class, userId, java.sql.Date.valueOf(last14Start), java.sql.Date.valueOf(today)
        );
        Integer completedTasks = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM tasks WHERE user_id = ? AND status = 'completed' AND scheduled_for BETWEEN ? AND ?",
                Integer.class, userId, java.sql.Date.valueOf(last14Start), java.sql.Date.valueOf(today)
        );

        totalTasks = totalTasks != null ? totalTasks : 0;
        completedTasks = completedTasks != null ? completedTasks : 0;
        double executionRate = totalTasks > 0 ? Math.round(((double) completedTasks / totalTasks) * 10000.0) / 100.0 : 0.0;

        // 2. Daily log aggregates (last 14 days)
        Double totalHours = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(hours_studied), 0) FROM daily_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?",
                Double.class, userId, java.sql.Date.valueOf(last14Start), java.sql.Date.valueOf(today)
        );
        Double avgProductivity = jdbcTemplate.queryForObject(
                "SELECT COALESCE(AVG(productivity_score), 0) FROM daily_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?",
                Double.class, userId, java.sql.Date.valueOf(last14Start), java.sql.Date.valueOf(today)
        );
        totalHours = totalHours != null ? totalHours : 0.0;
        avgProductivity = avgProductivity != null ? avgProductivity : 0.0;

        // 3. Power pocket minutes (last 14 days)
        Integer totalPowerPocketMinutes = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(duration_minutes), 0) FROM power_pocket_sessions WHERE user_id = ? AND status = 'completed' AND DATE(started_at) BETWEEN ? AND ?",
                Integer.class, userId, java.sql.Date.valueOf(last14Start), java.sql.Date.valueOf(today)
        );
        totalPowerPocketMinutes = totalPowerPocketMinutes != null ? totalPowerPocketMinutes : 0;

        // 4. Activity dates (last 14 days)
        List<String> activeDates = jdbcTemplate.queryForList(
                """
                SELECT DISTINCT activity_date::TEXT FROM (
                    SELECT log_date AS activity_date FROM daily_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?
                    UNION
                    SELECT scheduled_for AS activity_date FROM tasks WHERE user_id = ? AND status = 'completed' AND scheduled_for BETWEEN ? AND ?
                    UNION
                    SELECT DATE(started_at) AS activity_date FROM power_pocket_sessions WHERE user_id = ? AND status = 'completed' AND DATE(started_at) BETWEEN ? AND ?
                ) act
                """,
                String.class,
                userId, java.sql.Date.valueOf(last14Start), java.sql.Date.valueOf(today),
                userId, java.sql.Date.valueOf(last14Start), java.sql.Date.valueOf(today),
                userId, java.sql.Date.valueOf(last14Start), java.sql.Date.valueOf(today)
        );

        int activeDays = activeDates.size();
        double consistencyScore = Math.round(((double) activeDays / 14.0) * 10000.0) / 100.0;

        // Compute streak
        Set<String> allActivityDates = new HashSet<>(jdbcTemplate.queryForList(
                """
                SELECT DISTINCT activity_date::TEXT FROM (
                    SELECT log_date AS activity_date FROM daily_logs WHERE user_id = ? AND log_date <= ?
                    UNION
                    SELECT scheduled_for AS activity_date FROM tasks WHERE user_id = ? AND status = 'completed' AND scheduled_for <= ?
                    UNION
                    SELECT DATE(started_at) AS activity_date FROM power_pocket_sessions WHERE user_id = ? AND status = 'completed' AND DATE(started_at) <= ?
                ) act
                """,
                String.class,
                userId, java.sql.Date.valueOf(today),
                userId, java.sql.Date.valueOf(today),
                userId, java.sql.Date.valueOf(today)
        ));

        int streak = 0;
        LocalDate cursor = today;
        while (allActivityDates.contains(cursor.toString())) {
            streak++;
            cursor = cursor.minusDays(1);
        }

        double powerPocketBoost = Math.min(100.0, Math.round(((double) totalPowerPocketMinutes / 180.0) * 10000.0) / 100.0);
        double readinessScore = Math.round(
                (executionRate * 0.4) + (consistencyScore * 0.25) + (avgProductivity * 0.2) + (powerPocketBoost * 0.15)
        );

        // DSA aggregates
        Integer solvedProblems = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM tasks WHERE user_id = ? AND category = 'DSA' AND status = 'completed'",
                Integer.class, userId
        );
        solvedProblems = solvedProblems != null ? solvedProblems : 0;

        Double avgTimeDsa = jdbcTemplate.queryForObject(
                "SELECT COALESCE(AVG(GREATEST(COALESCE(NULLIF(actual_minutes, 0), estimated_minutes), estimated_minutes)), 0) FROM tasks WHERE user_id = ? AND category = 'DSA' AND status = 'completed'",
                Double.class, userId
        );
        double averageTimePerProblem = avgTimeDsa != null ? Math.round(avgTimeDsa * 100.0) / 100.0 : 0.0;

        Integer skippedDsa = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM tasks WHERE user_id = ? AND category = 'DSA' AND status = 'skipped'",
                Integer.class, userId
        );
        int failedAttempts = skippedDsa != null ? skippedDsa : 0;

        ProgressStat stat = new ProgressStat();
        stat.setUserId(userId);
        stat.setStatDate(today);
        stat.setStreak(streak);
        stat.setBonusStreak(0);
        stat.setConsistencyScore(consistencyScore);
        stat.setReadinessScore(readinessScore);
        stat.setExecutionRate(executionRate);
        stat.setTotalHours(Math.round((totalHours + (totalPowerPocketMinutes / 60.0)) * 100.0) / 100.0);
        stat.setTasksCompleted(completedTasks);
        stat.setPowerPocketMinutes(totalPowerPocketMinutes);

        Map<String, Object> meta = new HashMap<>();
        meta.put("avgProductivity", avgProductivity);
        meta.put("today", Map.of("date", today.toString(), "tasksCompleted", completedTasks, "hoursLogged", totalHours));
        stat.setMetadata(meta);

        progressRepository.upsertProgressStat(stat);

        // Update user row
        jdbcTemplate.update(
                """
                UPDATE users SET
                    current_streak = ?,
                    consistency_score = ?,
                    readiness_score = ?,
                    solved_problems = ?,
                    average_time_per_problem = ?,
                    failed_attempts = ?,
                    updated_at = NOW()
                WHERE id = ?
                """,
                streak, consistencyScore, readinessScore, solvedProblems, averageTimePerProblem, failedAttempts, userId
        );
    }
}
