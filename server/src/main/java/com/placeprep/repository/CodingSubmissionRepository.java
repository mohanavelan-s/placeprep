package com.placeprep.repository;

import com.placeprep.model.CodingSubmission;
import com.placeprep.util.JsonUtil;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class CodingSubmissionRepository {

    private final JdbcTemplate jdbcTemplate;

    public CodingSubmissionRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<CodingSubmission> rowMapper = (rs, rowNum) -> {
        CodingSubmission s = new CodingSubmission();
        s.setId(rs.getObject("id", UUID.class));
        s.setUserId(rs.getObject("user_id", UUID.class));
        s.setTaskId(rs.getObject("task_id", UUID.class));
        s.setProblem(JsonUtil.toMap(rs.getString("problem")));
        s.setLanguage(rs.getString("language"));
        s.setSourceCode(rs.getString("source_code"));
        s.setStdin(rs.getString("stdin"));
        s.setExpectedOutput(rs.getString("expected_output"));
        s.setStatus(rs.getString("status"));
        s.setStdout(rs.getString("stdout"));
        s.setStderr(rs.getString("stderr"));
        s.setCompileOutput(rs.getString("compile_output"));
        s.setJudgeToken(rs.getString("judge_token"));
        s.setTime(rs.getDouble("time"));
        s.setMemory(rs.getInt("memory"));
        s.setTestResults(JsonUtil.toListOfMaps(rs.getString("test_results")));
        s.setAnalysis(JsonUtil.toMap(rs.getString("analysis")));
        s.setRubric(JsonUtil.toMap(rs.getString("rubric")));
        s.setScore(rs.getDouble("score"));

        Timestamp c = rs.getTimestamp("created_at");
        if (c != null) s.setCreatedAt(c.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp u = rs.getTimestamp("updated_at");
        if (u != null) s.setUpdatedAt(u.toInstant().atOffset(ZoneOffset.UTC));

        return s;
    };

    public CodingSubmission create(CodingSubmission s) {
        UUID id = s.getId() != null ? s.getId() : UUID.randomUUID();
        s.setId(id);

        String sql = """
            INSERT INTO coding_submissions (
                id, user_id, task_id, problem, language, source_code,
                stdin, expected_output, status, stdout, stderr, compile_output,
                judge_token, time, memory, test_results, analysis, rubric, score
            ) VALUES (
                ?, ?, ?, ?::jsonb, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?
            )
            RETURNING *
        """;

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                id,
                s.getUserId(),
                s.getTaskId(),
                JsonUtil.toJson(s.getProblem()),
                s.getLanguage() != null ? s.getLanguage() : "python",
                s.getSourceCode() != null ? s.getSourceCode() : "",
                s.getStdin(),
                s.getExpectedOutput(),
                s.getStatus() != null ? s.getStatus() : "accepted",
                s.getStdout(),
                s.getStderr(),
                s.getCompileOutput(),
                s.getJudgeToken(),
                s.getTime(),
                s.getMemory(),
                JsonUtil.toJson(s.getTestResults()),
                JsonUtil.toJson(s.getAnalysis()),
                JsonUtil.toJson(s.getRubric()),
                s.getScore() != null ? s.getScore() : 100.0
        );
    }

    public Optional<CodingSubmission> findById(UUID id) {
        String sql = "SELECT * FROM coding_submissions WHERE id = ?";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, rowMapper, id));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public List<CodingSubmission> listByUser(UUID userId, int limit) {
        String sql = "SELECT * FROM coding_submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?";
        return jdbcTemplate.query(sql, rowMapper, userId, limit);
    }

    public List<CodingSubmission> listByTask(UUID userId, UUID taskId) {
        String sql = "SELECT * FROM coding_submissions WHERE user_id = ? AND task_id = ? ORDER BY created_at DESC LIMIT 20";
        return jdbcTemplate.query(sql, rowMapper, userId, taskId);
    }

    public int deleteByIdAndUser(UUID id, UUID userId) {
        return jdbcTemplate.update("DELETE FROM coding_submissions WHERE id = ? AND user_id = ?", id, userId);
    }

    public int deleteAllByUser(UUID userId) {
        return jdbcTemplate.update("DELETE FROM coding_submissions WHERE user_id = ?", userId);
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
