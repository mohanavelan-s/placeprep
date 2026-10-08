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
                subcategory = COALESCE(?, subcategory),
                status = COALESCE(?, status),
                priority = COALESCE(?, priority),
                intensity = COALESCE(?, intensity),
                reference_label = COALESCE(?, reference_label),
                reference_url = COALESCE(?, reference_url),
                due_date = COALESCE(?, due_date),
                scheduled_for = COALESCE(?, scheduled_for),
                estimated_minutes = ?,
                actual_minutes = ?,
                difficulty = COALESCE(?, difficulty),
                weak_area = COALESCE(?, weak_area),
                completed_at = ?,
                updated_at = NOW()
            WHERE id = ? AND user_id = ?
            RETURNING *
        """;

        Date dueDate = t.getDueDate() != null ? Date.valueOf(t.getDueDate()) : null;
        Date sched = t.getScheduledFor() != null ? Date.valueOf(t.getScheduledFor()) : null;
        Timestamp comp = t.getCompletedAt() != null ? Timestamp.from(t.getCompletedAt().toInstant()) : null;

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                t.getTitle(),
                t.getDescription(),
                t.getCategory(),
                t.getSubcategory(),
                t.getStatus(),
                t.getPriority(),
                t.getIntensity(),
                t.getReferenceLabel(),
                t.getReferenceUrl(),
                dueDate,
                sched,
                t.getEstimatedMinutes() >= 0 ? t.getEstimatedMinutes() : 30,
                t.getActualMinutes() >= 0 ? t.getActualMinutes() : 0,
                t.getDifficulty() > 0 ? t.getDifficulty() : null,
                t.getWeakArea(),
                comp,
                t.getId(),
                t.getUserId()
        );
    }

    public boolean deleteTask(UUID userId, UUID id) {
        int rows = jdbcTemplate.update("DELETE FROM tasks WHERE user_id = ? AND id = ?", userId, id);
        return rows > 0;
    }

    public record BulkDeleteResult(
            int requestedCount,
            int deletedCount,
            int alreadyMissingCount,
            int unauthorizedCount,
            int failedCount,
            List<UUID> deletedIds,
            List<UUID> missingIds,
            List<UUID> unauthorizedIds,
            String summary
    ) {}

    public BulkDeleteResult bulkDeleteTasks(UUID userId, List<UUID> taskIds) {
        if (taskIds == null || taskIds.isEmpty()) {
            return new BulkDeleteResult(0, 0, 0, 0, 0, List.of(), List.of(), List.of(), "No task IDs were provided.");
        }

        List<UUID> uniqueIds = taskIds.stream().filter(Objects::nonNull).distinct().toList();
        if (uniqueIds.isEmpty()) {
            return new BulkDeleteResult(0, 0, 0, 0, 0, List.of(), List.of(), List.of(), "No valid task IDs were provided.");
        }

        int requestedCount = uniqueIds.size();
        String inSql = String.join(",", Collections.nCopies(uniqueIds.size(), "?"));
        String selectSql = "SELECT id, user_id FROM tasks WHERE id IN (" + inSql + ")";

        List<Map<String, Object>> existing = jdbcTemplate.queryForList(selectSql, uniqueIds.toArray());
        Map<UUID, UUID> idToUser = new HashMap<>();
        for (Map<String, Object> row : existing) {
            UUID id = (UUID) row.get("id");
            UUID uid = (UUID) row.get("user_id");
            idToUser.put(id, uid);
        }

        List<UUID> ownedIds = new ArrayList<>();
        List<UUID> unauthorizedIds = new ArrayList<>();
        List<UUID> missingIds = new ArrayList<>();

        for (UUID id : uniqueIds) {
            if (!idToUser.containsKey(id)) {
                missingIds.add(id);
            } else if (!userId.equals(idToUser.get(id))) {
                unauthorizedIds.add(id);
            } else {
                ownedIds.add(id);
            }
        }

        int deletedCount = 0;
        int failedCount = 0;
        if (!ownedIds.isEmpty()) {
            String deleteInSql = String.join(",", Collections.nCopies(ownedIds.size(), "?"));
            String deleteSql = "DELETE FROM tasks WHERE user_id = ? AND id IN (" + deleteInSql + ")";
            List<Object> deleteParams = new ArrayList<>();
            deleteParams.add(userId);
            deleteParams.addAll(ownedIds);
            deletedCount = jdbcTemplate.update(deleteSql, deleteParams.toArray());
            if (deletedCount < ownedIds.size()) {
                failedCount = ownedIds.size() - deletedCount;
            }
        }

        String summary = String.format("Requested %d task(s): %d deleted, %d already missing, %d unauthorized, %d failed.",
                requestedCount, deletedCount, missingIds.size(), unauthorizedIds.size(), failedCount);

        return new BulkDeleteResult(
                requestedCount,
                deletedCount,
                missingIds.size(),
                unauthorizedIds.size(),
                failedCount,
                ownedIds,
                missingIds,
                unauthorizedIds,
                summary
        );
    }

    public List<Task> bulkCompleteTasks(UUID userId, List<UUID> taskIds) {
        if (taskIds == null || taskIds.isEmpty()) {
            return List.of();
        }
        List<UUID> uniqueIds = taskIds.stream().filter(Objects::nonNull).distinct().toList();
        if (uniqueIds.isEmpty()) return List.of();

        String inSql = String.join(",", Collections.nCopies(uniqueIds.size(), "?"));
        String updateSql = "UPDATE tasks SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE user_id = ? AND id IN (" + inSql + ") RETURNING *";
        List<Object> params = new ArrayList<>();
        params.add(userId);
        params.addAll(uniqueIds);
        return jdbcTemplate.query(updateSql, rowMapper, params.toArray());
    }

    public List<Task> bulkUpdateTasks(UUID userId, List<UUID> taskIds, Map<String, Object> updates) {
        if (taskIds == null || taskIds.isEmpty() || updates == null || updates.isEmpty()) {
            return List.of();
        }
        List<UUID> uniqueIds = taskIds.stream().filter(Objects::nonNull).distinct().toList();
        if (uniqueIds.isEmpty()) return List.of();

        StringBuilder sql = new StringBuilder("UPDATE tasks SET updated_at = NOW()");
        List<Object> setParams = new ArrayList<>();

        if (updates.containsKey("scheduledFor") && updates.get("scheduledFor") != null) {
            sql.append(", scheduled_for = ?::date");
            setParams.add(updates.get("scheduledFor").toString());
        }
        if (updates.containsKey("priority") && updates.get("priority") != null) {
            sql.append(", priority = ?");
            setParams.add(updates.get("priority").toString());
        }
        if (updates.containsKey("category") && updates.get("category") != null) {
            sql.append(", category = ?");
            setParams.add(updates.get("category").toString());
        }
        if (updates.containsKey("status") && updates.get("status") != null) {
            String status = updates.get("status").toString().toLowerCase();
            sql.append(", status = ?");
            setParams.add(status);
            if ("completed".equals(status)) {
                sql.append(", completed_at = NOW()");
            }
        }
        if (updates.containsKey("estimatedMinutes") || updates.containsKey("estimated_minutes")) {
            Object est = updates.get("estimatedMinutes");
            if (est == null) est = updates.get("estimated_minutes");
            if (est != null) {
                int val = est instanceof Number n ? n.intValue() : Integer.parseInt(est.toString().trim());
                if (val >= 0) {
                    sql.append(", estimated_minutes = ?");
                    setParams.add(val);
                }
            }
        }
        if (updates.containsKey("actualMinutes") || updates.containsKey("actual_minutes")) {
            Object act = updates.get("actualMinutes");
            if (act == null) act = updates.get("actual_minutes");
            if (act != null) {
                int val = act instanceof Number n ? n.intValue() : Integer.parseInt(act.toString().trim());
                if (val >= 0) {
                    sql.append(", actual_minutes = ?");
                    setParams.add(val);
                }
            }
        }

        String inSql = String.join(",", Collections.nCopies(uniqueIds.size(), "?"));
        sql.append(" WHERE user_id = ? AND id IN (").append(inSql).append(") RETURNING *");

        List<Object> allParams = new ArrayList<>(setParams);
        allParams.add(userId);
        allParams.addAll(uniqueIds);

        return jdbcTemplate.query(sql.toString(), rowMapper, allParams.toArray());
    }

    public List<Task> searchTasks(UUID userId, String query, String status, String category, LocalDate fromDate, LocalDate toDate, Integer limit) {
        StringBuilder sql = new StringBuilder("SELECT * FROM tasks WHERE user_id = ?");
        List<Object> params = new ArrayList<>();
        params.add(userId);

        if (query != null && !query.isBlank()) {
            sql.append(" AND (title ILIKE ? OR description ILIKE ? OR subcategory ILIKE ? OR weak_area ILIKE ?)");
            String p = "%" + query.trim() + "%";
            params.add(p);
            params.add(p);
            params.add(p);
            params.add(p);
        }

        if (status != null && !status.isBlank()) {
            sql.append(" AND status = ?");
            params.add(status.toLowerCase());
        }

        if (category != null && !category.isBlank()) {
            sql.append(" AND category = ?");
            params.add(category);
        }

        if (fromDate != null) {
            sql.append(" AND (scheduled_for >= ? OR due_date >= ?)");
            params.add(Date.valueOf(fromDate));
            params.add(Date.valueOf(fromDate));
        }

        if (toDate != null) {
            sql.append(" AND (scheduled_for <= ? OR due_date <= ?)");
            params.add(Date.valueOf(toDate));
            params.add(Date.valueOf(toDate));
        }

        sql.append(" ORDER BY scheduled_for ASC NULLS LAST, priority DESC, created_at DESC");
        if (limit != null && limit > 0) {
            sql.append(" LIMIT ?");
            params.add(limit);
        } else {
            sql.append(" LIMIT 50");
        }

        return jdbcTemplate.query(sql.toString(), rowMapper, params.toArray());
    }
}
