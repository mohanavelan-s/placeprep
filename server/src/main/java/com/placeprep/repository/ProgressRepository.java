package com.placeprep.repository;

import com.placeprep.model.ProgressStat;
import com.placeprep.util.JsonUtil;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

@Repository
public class ProgressRepository {

    private final JdbcTemplate jdbcTemplate;

    public ProgressRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<ProgressStat> rowMapper = (rs, rowNum) -> {
        ProgressStat s = new ProgressStat();
        s.setId(rs.getObject("id", UUID.class));
        s.setUserId(rs.getObject("user_id", UUID.class));
        Date d = rs.getDate("stat_date");
        if (d != null) s.setStatDate(d.toLocalDate());
        s.setStreak(rs.getInt("streak"));
        s.setBonusStreak(rs.getInt("bonus_streak"));
        s.setConsistencyScore(rs.getDouble("consistency_score"));
        s.setReadinessScore(rs.getDouble("readiness_score"));
        s.setExecutionRate(rs.getDouble("execution_rate"));
        s.setTotalHours(rs.getDouble("total_hours"));
        s.setTasksCompleted(rs.getInt("tasks_completed"));
        s.setPowerPocketMinutes(rs.getInt("power_pocket_minutes"));
        s.setMetadata(JsonUtil.toMap(rs.getString("metadata")));

        Timestamp c = rs.getTimestamp("created_at");
        if (c != null) s.setCreatedAt(c.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp u = rs.getTimestamp("updated_at");
        if (u != null) s.setUpdatedAt(u.toInstant().atOffset(ZoneOffset.UTC));

        return s;
    };

    public ProgressStat upsertProgressStat(ProgressStat s) {
        UUID id = s.getId() != null ? s.getId() : UUID.randomUUID();
        s.setId(id);

        String sql = """
            INSERT INTO progress_stats (
                id, user_id, stat_date, streak, bonus_streak,
                consistency_score, readiness_score, execution_rate,
                total_hours, tasks_completed, power_pocket_minutes, metadata
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?::jsonb
            )
            ON CONFLICT (user_id, stat_date)
            DO UPDATE SET
                streak = EXCLUDED.streak,
                bonus_streak = EXCLUDED.bonus_streak,
                consistency_score = EXCLUDED.consistency_score,
                readiness_score = EXCLUDED.readiness_score,
                execution_rate = EXCLUDED.execution_rate,
                total_hours = EXCLUDED.total_hours,
                tasks_completed = EXCLUDED.tasks_completed,
                power_pocket_minutes = EXCLUDED.power_pocket_minutes,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
            RETURNING *
        """;

        Date statDate = s.getStatDate() != null ? Date.valueOf(s.getStatDate()) : Date.valueOf(LocalDate.now());

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                id,
                s.getUserId(),
                statDate,
                s.getStreak(),
                s.getBonusStreak(),
                s.getConsistencyScore(),
                s.getReadinessScore(),
                s.getExecutionRate(),
                s.getTotalHours(),
                s.getTasksCompleted(),
                s.getPowerPocketMinutes(),
                JsonUtil.toJson(s.getMetadata())
        );
    }

    public Optional<ProgressStat> findLatestByUserId(UUID userId) {
        String sql = "SELECT * FROM progress_stats WHERE user_id = ? ORDER BY stat_date DESC LIMIT 1";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, rowMapper, userId));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public List<ProgressStat> findHistoryByUserId(UUID userId, int days) {
        String sql = "SELECT * FROM progress_stats WHERE user_id = ? ORDER BY stat_date DESC LIMIT ?";
        return jdbcTemplate.query(sql, rowMapper, userId, days);
    }

    public int clearHistory(UUID userId) {
        return jdbcTemplate.update("DELETE FROM progress_stats WHERE user_id = ?", userId);
    }
}
