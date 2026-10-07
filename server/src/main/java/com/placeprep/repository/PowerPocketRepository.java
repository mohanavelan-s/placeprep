package com.placeprep.repository;

import com.placeprep.model.PowerPocketSession;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class PowerPocketRepository {

    private final JdbcTemplate jdbcTemplate;

    public PowerPocketRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<PowerPocketSession> rowMapper = (rs, rowNum) -> {
        PowerPocketSession s = new PowerPocketSession();
        s.setId(rs.getObject("id", UUID.class));
        s.setUserId(rs.getObject("user_id", UUID.class));
        s.setTaskId(rs.getObject("task_id", UUID.class));
        s.setTitle(rs.getString("title"));
        s.setNotes(rs.getString("notes"));
        s.setStatus(rs.getString("status"));
        s.setSource(rs.getString("source"));

        Timestamp start = rs.getTimestamp("started_at");
        if (start != null) s.setStartedAt(start.toInstant().atOffset(ZoneOffset.UTC));

        Timestamp end = rs.getTimestamp("ended_at");
        if (end != null) s.setEndedAt(end.toInstant().atOffset(ZoneOffset.UTC));

        s.setDurationMinutes(rs.getInt("duration_minutes"));

        Timestamp c = rs.getTimestamp("created_at");
        if (c != null) s.setCreatedAt(c.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp u = rs.getTimestamp("updated_at");
        if (u != null) s.setUpdatedAt(u.toInstant().atOffset(ZoneOffset.UTC));

        return s;
    };

    public PowerPocketSession createSession(PowerPocketSession payload) {
        UUID id = payload.getId() != null ? payload.getId() : UUID.randomUUID();

        String sql = """
            INSERT INTO power_pocket_sessions (
                id, user_id, task_id, title, notes, status, source, started_at, ended_at, duration_minutes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *
        """;

        Timestamp started = payload.getStartedAt() != null
                ? Timestamp.from(payload.getStartedAt().toInstant())
                : Timestamp.from(OffsetDateTime.now().toInstant());

        Timestamp ended = payload.getEndedAt() != null
                ? Timestamp.from(payload.getEndedAt().toInstant())
                : null;

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                id,
                payload.getUserId(),
                payload.getTaskId(),
                payload.getTitle(),
                payload.getNotes(),
                payload.getStatus() != null ? payload.getStatus() : "active",
                payload.getSource() != null ? payload.getSource() : "manual",
                started,
                ended,
                payload.getDurationMinutes() != null ? payload.getDurationMinutes() : 0
        );
    }

    public Optional<PowerPocketSession> findActiveSession(UUID userId) {
        String sql = "SELECT * FROM power_pocket_sessions WHERE user_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, rowMapper, userId));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<PowerPocketSession> findById(UUID sessionId, UUID userId) {
        String sql = "SELECT * FROM power_pocket_sessions WHERE id = ? AND user_id = ?";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, rowMapper, sessionId, userId));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<PowerPocketSession> updateSession(UUID sessionId, UUID userId, PowerPocketSession updates) {
        StringBuilder sql = new StringBuilder("UPDATE power_pocket_sessions SET updated_at = NOW()");
        List<Object> params = new ArrayList<>();

        if (updates.getTaskId() != null) {
            sql.append(", task_id = ?");
            params.add(updates.getTaskId());
        }
        if (updates.getTitle() != null) {
            sql.append(", title = ?");
            params.add(updates.getTitle());
        }
        if (updates.getNotes() != null) {
            sql.append(", notes = ?");
            params.add(updates.getNotes());
        }
        if (updates.getStatus() != null) {
            sql.append(", status = ?");
            params.add(updates.getStatus());
        }
        if (updates.getSource() != null) {
            sql.append(", source = ?");
            params.add(updates.getSource());
        }
        if (updates.getEndedAt() != null) {
            sql.append(", ended_at = ?");
            params.add(Timestamp.from(updates.getEndedAt().toInstant()));
        }
        if (updates.getDurationMinutes() != null) {
            sql.append(", duration_minutes = ?");
            params.add(updates.getDurationMinutes());
        }

        sql.append(" WHERE id = ? AND user_id = ? RETURNING *");
        params.add(sessionId);
        params.add(userId);

        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql.toString(), rowMapper, params.toArray()));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public List<PowerPocketSession> listSessions(UUID userId, LocalDate date, String status, Integer limit) {
        StringBuilder sql = new StringBuilder("SELECT * FROM power_pocket_sessions WHERE user_id = ?");
        List<Object> params = new ArrayList<>();
        params.add(userId);

        if (date != null) {
            sql.append(" AND DATE(started_at) = ?");
            params.add(Date.valueOf(date));
        }
        if (status != null && !status.isBlank()) {
            sql.append(" AND status = ?");
            params.add(status);
        }

        int lim = limit != null && limit > 0 ? limit : 25;
        sql.append(" ORDER BY started_at DESC LIMIT ?");
        params.add(lim);

        return jdbcTemplate.query(sql.toString(), rowMapper, params.toArray());
    }

    public int deleteByIdAndUser(UUID id, UUID userId) {
        return jdbcTemplate.update("DELETE FROM power_pocket_sessions WHERE id = ? AND user_id = ?", id, userId);
    }

    public int deleteByUser(UUID userId) {
        return jdbcTemplate.update("DELETE FROM power_pocket_sessions WHERE user_id = ?", userId);
    }
}
