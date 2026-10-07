package com.placeprep.repository;

import com.placeprep.model.Task;
import com.placeprep.util.JsonUtil;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Repository
public class TaskRepository {

    private final JdbcTemplate jdbcTemplate;

    public TaskRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<Task> rowMapper = (rs, rowNum) -> {
        Task t = new Task();
        t.setId(rs.getObject("id", UUID.class));
        t.setUserId(rs.getObject("user_id", UUID.class));
        t.setTitle(rs.getString("title"));
        t.setDescription(rs.getString("description"));
        t.setCategory(rs.getString("category"));
        t.setSubcategory(rs.getString("subcategory"));
        t.setStatus(rs.getString("status"));
        t.setPriority(rs.getString("priority"));
        t.setIntensity(rs.getString("intensity"));
        t.setReferenceLabel(rs.getString("reference_label"));
        t.setReferenceUrl(rs.getString("reference_url"));

        Date dueDate = rs.getDate("due_date");
        if (dueDate != null) t.setDueDate(dueDate.toLocalDate());

        Timestamp dueAt = rs.getTimestamp("due_at");
        if (dueAt != null) t.setDueAt(dueAt.toInstant().atOffset(ZoneOffset.UTC));

        Date scheduledFor = rs.getDate("scheduled_for");
        if (scheduledFor != null) t.setScheduledFor(scheduledFor.toLocalDate());

        t.setEstimatedMinutes(rs.getInt("estimated_minutes"));
        t.setActualMinutes(rs.getInt("actual_minutes"));
        t.setDifficulty(rs.getInt("difficulty"));
        t.setWeakArea(rs.getString("weak_area"));
        t.setAiGenerated(rs.getBoolean("ai_generated"));
        t.setMetadata(JsonUtil.toMap(rs.getString("metadata")));

        Timestamp completedAt = rs.getTimestamp("completed_at");
        if (completedAt != null) t.setCompletedAt(completedAt.toInstant().atOffset(ZoneOffset.UTC));

        Timestamp createdAt = rs.getTimestamp("created_at");
        if (createdAt != null) t.setCreatedAt(createdAt.toInstant().atOffset(ZoneOffset.UTC));

        Timestamp updatedAt = rs.getTimestamp("updated_at");
        if (updatedAt != null) t.setUpdatedAt(updatedAt.toInstant().atOffset(ZoneOffset.UTC));

        return t;
    };

    public Task createTask(Task t) {
        UUID id = t.getId() != null ? t.getId() : UUID.randomUUID();
        t.setId(id);

        String sql = """
            INSERT INTO tasks (
                id, user_id, title, description, category, subcategory,
                status, priority, intensity, reference_label, reference_url,
                due_date, due_at, scheduled_for, estimated_minutes, actual_minutes,
                difficulty, weak_area, ai_generated, metadata, completed_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?::jsonb, ?
            )
            RETURNING *
        """;

        Date dueDate = t.getDueDate() != null ? Date.valueOf(t.getDueDate()) : null;
        Timestamp dueAt = t.getDueAt() != null ? Timestamp.from(t.getDueAt().toInstant()) : null;
        Date scheduledFor = t.getScheduledFor() != null ? Date.valueOf(t.getScheduledFor()) : null;
        Timestamp completedAt = t.getCompletedAt() != null ? Timestamp.from(t.getCompletedAt().toInstant()) : null;

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                id,
                t.getUserId(),
                t.getTitle(),
                t.getDescription(),
                t.getCategory() != null ? t.getCategory() : "DSA",
                t.getSubcategory(),
                t.getStatus() != null ? t.getStatus() : "pending",
                t.getPriority() != null ? t.getPriority() : "medium",
                t.getIntensity() != null ? t.getIntensity() : "moderate",
                t.getReferenceLabel(),
                t.getReferenceUrl(),
                dueDate,
                dueAt,
                scheduledFor,
                t.getEstimatedMinutes(),
                t.getActualMinutes(),
                t.getDifficulty(),
                t.getWeakArea(),
                t.isAiGenerated(),
                JsonUtil.toJson(t.getMetadata()),
                completedAt
        );
    }

    public Optional<Task> findById(UUID id) {
        String sql = "SELECT * FROM tasks WHERE id = ?";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, rowMapper, id));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<Task> findByUserAndId(UUID userId, UUID id) {
        String sql = "SELECT * FROM tasks WHERE user_id = ? AND id = ?";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, rowMapper, userId, id));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<Task> findById(UUID taskId, UUID userId) {
        return findByUserAndId(userId, taskId);
    }

    public List<Task> listTasks(UUID userId, String date, String status, String category, Integer limit) {
        StringBuilder sql = new StringBuilder("SELECT * FROM tasks WHERE user_id = ?");
        List<Object> params = new ArrayList<>();
        params.add(userId);

        if (date != null && !date.isBlank()) {
            if ("today".equalsIgnoreCase(date)) {
                sql.append(" AND (scheduled_for = CURRENT_DATE OR (scheduled_for IS NULL AND due_date = CURRENT_DATE))");
            } else {
                sql.append(" AND (scheduled_for = ?::date OR due_date = ?::date)");
                params.add(date);
                params.add(date);
            }
        }

        if (status != null && !status.isBlank()) {
            sql.append(" AND status = ?");
            params.add(status.toLowerCase());
        }

        if (category != null && !category.isBlank()) {
            sql.append(" AND category = ?");
            params.add(category);
        }

        sql.append(" ORDER BY priority DESC, created_at DESC");
        if (limit != null && limit > 0) {
            sql.append(" LIMIT ?");
            params.add(limit);
        }

        return jdbcTemplate.query(sql.toString(), rowMapper, params.toArray());
    }

    public Task updateTask(Task t) {
        String sql = """
            UPDATE tasks SET
                title = COALESCE(?, title),
                description = COALESCE(?, description),
                category = COALESCE(?, category),
                status = COALESCE(?, status),
                priority = COALESCE(?, priority),
                scheduled_for = COALESCE(?, scheduled_for),
                estimated_minutes = COALESCE(?, estimated_minutes),
                actual_minutes = COALESCE(?, actual_minutes),
                difficulty = COALESCE(?, difficulty),
                completed_at = ?,
                updated_at = NOW()
            WHERE id = ? AND user_id = ?
            RETURNING *
        """;

        Date sched = t.getScheduledFor() != null ? Date.valueOf(t.getScheduledFor()) : null;
        Timestamp comp = t.getCompletedAt() != null ? Timestamp.from(t.getCompletedAt().toInstant()) : null;

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                t.getTitle(),
                t.getDescription(),
                t.getCategory(),
                t.getStatus(),
                t.getPriority(),
                sched,
                t.getEstimatedMinutes() > 0 ? t.getEstimatedMinutes() : null,
                t.getActualMinutes() > 0 ? t.getActualMinutes() : null,
                t.getDifficulty() > 0 ? t.getDifficulty() : null,
                comp,
                t.getId(),
                t.getUserId()
        );
    }

    public boolean deleteTask(UUID userId, UUID id) {
        int rows = jdbcTemplate.update("DELETE FROM tasks WHERE user_id = ? AND id = ?", userId, id);
        return rows > 0;
    }
}
