package com.placeprep.repository;

import com.placeprep.model.DailyLog;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class DailyLogRepository {

    private final JdbcTemplate jdbcTemplate;

    public DailyLogRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<DailyLog> rowMapper = (rs, rowNum) -> {
        DailyLog log = new DailyLog();
        log.setId(rs.getObject("id", UUID.class));
        log.setUserId(rs.getObject("user_id", UUID.class));

        Date d = rs.getDate("log_date");
        if (d != null) log.setLogDate(d.toLocalDate());

        log.setSummary(rs.getString("summary"));
        log.setWins(rs.getString("wins"));
        log.setBlockers(rs.getString("blockers"));

        int mood = rs.getInt("mood");
        if (!rs.wasNull()) log.setMood(mood);

        int energy = rs.getInt("energy");
        if (!rs.wasNull()) log.setEnergy(energy);

        log.setProductivityScore(rs.getInt("productivity_score"));
        log.setFocusMinutes(rs.getInt("focus_minutes"));
        log.setHoursStudied(rs.getDouble("hours_studied"));
        log.setTasksCompletedCount(rs.getInt("tasks_completed_count"));
        log.setNotes(rs.getString("notes"));
        log.setImprovementPlan(rs.getString("improvement_plan"));

        Timestamp c = rs.getTimestamp("created_at");
        if (c != null) log.setCreatedAt(c.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp u = rs.getTimestamp("updated_at");
        if (u != null) log.setUpdatedAt(u.toInstant().atOffset(ZoneOffset.UTC));

        return log;
    };

    public DailyLog upsertLog(DailyLog payload) {
        UUID id = payload.getId() != null ? payload.getId() : UUID.randomUUID();

        String sql = """
            INSERT INTO daily_logs (
              id,
              user_id,
              log_date,
              summary,
              wins,
              blockers,
              mood,
              energy,
              productivity_score,
              focus_minutes,
              hours_studied,
              tasks_completed_count,
              notes,
              improvement_plan
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            ON CONFLICT (user_id, log_date)
            DO UPDATE SET
              summary = EXCLUDED.summary,
              wins = EXCLUDED.wins,
              blockers = EXCLUDED.blockers,
              mood = EXCLUDED.mood,
              energy = EXCLUDED.energy,
              productivity_score = EXCLUDED.productivity_score,
              focus_minutes = EXCLUDED.focus_minutes,
              hours_studied = EXCLUDED.hours_studied,
              tasks_completed_count = EXCLUDED.tasks_completed_count,
              notes = EXCLUDED.notes,
              improvement_plan = EXCLUDED.improvement_plan
            RETURNING *
        """;

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                id,
                payload.getUserId(),
                payload.getLogDate() != null ? Date.valueOf(payload.getLogDate()) : Date.valueOf(LocalDate.now()),
                payload.getSummary(),
                payload.getWins(),
                payload.getBlockers(),
                payload.getMood(),
                payload.getEnergy(),
                payload.getProductivityScore() != null ? payload.getProductivityScore() : 0,
                payload.getFocusMinutes() != null ? payload.getFocusMinutes() : 0,
                payload.getHoursStudied() != null ? payload.getHoursStudied() : 0.0,
                payload.getTasksCompletedCount() != null ? payload.getTasksCompletedCount() : 0,
                payload.getNotes(),
                payload.getImprovementPlan()
        );
    }

    public Optional<DailyLog> findByDate(UUID userId, LocalDate logDate) {
        String sql = "SELECT * FROM daily_logs WHERE user_id = ? AND log_date = ?";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, rowMapper, userId, Date.valueOf(logDate)));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public List<DailyLog> listLogs(UUID userId, LocalDate date, LocalDate from, LocalDate to, Integer limit) {
        StringBuilder sql = new StringBuilder("SELECT * FROM daily_logs WHERE user_id = ?");
        List<Object> params = new ArrayList<>();
        params.add(userId);

        if (date != null) {
            sql.append(" AND log_date = ?");
            params.add(Date.valueOf(date));
        }
        if (from != null) {
            sql.append(" AND log_date >= ?");
            params.add(Date.valueOf(from));
        }
        if (to != null) {
            sql.append(" AND log_date <= ?");
            params.add(Date.valueOf(to));
        }

        int lim = limit != null && limit > 0 ? limit : 30;
        sql.append(" ORDER BY log_date DESC LIMIT ?");
        params.add(lim);

        return jdbcTemplate.query(sql.toString(), rowMapper, params.toArray());
    }

    public Optional<DailyLog> deleteLog(UUID logId, UUID userId) {
        String sql = "DELETE FROM daily_logs WHERE id = ? AND user_id = ? RETURNING *";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, rowMapper, logId, userId));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }
}
