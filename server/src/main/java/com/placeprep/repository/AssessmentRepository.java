package com.placeprep.repository;

import com.placeprep.model.AssessmentSession;
import com.placeprep.util.JsonUtil;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Array;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Repository
public class AssessmentRepository {

    private final JdbcTemplate jdbcTemplate;

    public AssessmentRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<AssessmentSession> rowMapper = (rs, rowNum) -> {
        AssessmentSession s = new AssessmentSession();
        s.setId(rs.getObject("id", UUID.class));
        s.setUserId(rs.getObject("user_id", UUID.class));
        s.setPlanId(rs.getObject("plan_id", UUID.class));
        s.setStatus(rs.getString("status"));
        s.setAssessmentType(rs.getString("assessment_type"));
        s.setDurationMinutes(rs.getInt("duration_minutes"));

        Array arr = rs.getArray("weak_spots");
        if (arr != null) {
            String[] spots = (String[]) arr.getArray();
            s.setWeakSpots(Arrays.asList(spots));
        }

        s.setRecommendations(JsonUtil.toListOfMaps(rs.getString("recommendations")));
        s.setQuestions(JsonUtil.toListOfMaps(rs.getString("questions")));
        s.setSubmission(JsonUtil.toMap(rs.getString("submission")));
        s.setScore(rs.getDouble("score"));
        s.setMetadata(JsonUtil.toMap(rs.getString("metadata")));

        Timestamp start = rs.getTimestamp("started_at");
        if (start != null) s.setStartedAt(start.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp sub = rs.getTimestamp("submitted_at");
        if (sub != null) s.setSubmittedAt(sub.toInstant().atOffset(ZoneOffset.UTC));

        Timestamp c = rs.getTimestamp("created_at");
        if (c != null) s.setCreatedAt(c.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp u = rs.getTimestamp("updated_at");
        if (u != null) s.setUpdatedAt(u.toInstant().atOffset(ZoneOffset.UTC));

        return s;
    };

    public AssessmentSession createSession(AssessmentSession payload) {
        UUID id = payload.getId() != null ? payload.getId() : UUID.randomUUID();

        String sql = """
            INSERT INTO assessment_sessions (
                id, user_id, plan_id, status, assessment_type,
                duration_minutes, weak_spots, recommendations, questions,
                submission, score, metadata, started_at, submitted_at
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?::jsonb, ?::jsonb,
                ?::jsonb, ?, ?::jsonb, ?, ?
            )
            RETURNING *
        """;

        String[] spots = payload.getWeakSpots() != null ? payload.getWeakSpots().toArray(new String[0]) : new String[0];
        Timestamp started = payload.getStartedAt() != null ? Timestamp.from(payload.getStartedAt().toInstant()) : null;
        Timestamp submitted = payload.getSubmittedAt() != null ? Timestamp.from(payload.getSubmittedAt().toInstant()) : null;

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                id,
                payload.getUserId(),
                payload.getPlanId(),
                payload.getStatus() != null ? payload.getStatus() : "draft",
                payload.getAssessmentType() != null ? payload.getAssessmentType() : "mcq",
                payload.getDurationMinutes() != null ? payload.getDurationMinutes() : 20,
                spots,
                JsonUtil.toJson(payload.getRecommendations() != null ? payload.getRecommendations() : List.of()),
                JsonUtil.toJson(payload.getQuestions() != null ? payload.getQuestions() : List.of()),
                JsonUtil.toJson(payload.getSubmission() != null ? payload.getSubmission() : Map.of()),
                payload.getScore() != null ? payload.getScore() : 0.0,
                JsonUtil.toJson(payload.getMetadata() != null ? payload.getMetadata() : Map.of()),
                started,
                submitted
        );
    }

    public Optional<AssessmentSession> findById(UUID sessionId, UUID userId) {
        String sql = "SELECT * FROM assessment_sessions WHERE id = ? AND user_id = ?";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, rowMapper, sessionId, userId));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public List<AssessmentSession> listByUser(UUID userId, int limit) {
        String sql = "SELECT * FROM assessment_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?";
        return jdbcTemplate.query(sql, rowMapper, userId, limit > 0 ? limit : 8);
    }

    public Optional<AssessmentSession> updateSession(UUID sessionId, UUID userId, AssessmentSession updates) {
        StringBuilder sql = new StringBuilder("UPDATE assessment_sessions SET updated_at = NOW()");
        List<Object> params = new ArrayList<>();

        if (updates.getStatus() != null) {
            sql.append(", status = ?");
            params.add(updates.getStatus());
        }
        if (updates.getWeakSpots() != null) {
            sql.append(", weak_spots = ?");
            params.add(updates.getWeakSpots().toArray(new String[0]));
        }
        if (updates.getRecommendations() != null) {
            sql.append(", recommendations = ?::jsonb");
            params.add(JsonUtil.toJson(updates.getRecommendations()));
        }
        if (updates.getQuestions() != null) {
            sql.append(", questions = ?::jsonb");
            params.add(JsonUtil.toJson(updates.getQuestions()));
        }
        if (updates.getSubmission() != null) {
            sql.append(", submission = ?::jsonb");
            params.add(JsonUtil.toJson(updates.getSubmission()));
        }
        if (updates.getScore() != null) {
            sql.append(", score = ?");
            params.add(updates.getScore());
        }
        if (updates.getMetadata() != null) {
            sql.append(", metadata = ?::jsonb");
            params.add(JsonUtil.toJson(updates.getMetadata()));
        }
        if (updates.getSubmittedAt() != null) {
            sql.append(", submitted_at = ?");
            params.add(Timestamp.from(updates.getSubmittedAt().toInstant()));
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

    public int deleteByIdAndUser(UUID id, UUID userId) {
        return jdbcTemplate.update("DELETE FROM assessment_sessions WHERE id = ? AND user_id = ?", id, userId);
    }

    public int deleteAllByUser(UUID userId) {
        return jdbcTemplate.update("DELETE FROM assessment_sessions WHERE user_id = ?", userId);
    }

    public int deleteBulkByUser(UUID userId, List<UUID> ids) {
        if (ids == null || ids.isEmpty()) return 0;
        int count = 0;
        for (UUID id : ids) {
            count += deleteByIdAndUser(id, userId);
        }
        return count;
    }
}
