package com.placeprep.repository;

import com.placeprep.model.Resume;
import com.placeprep.util.JsonUtil;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Array;
import java.sql.Timestamp;
import java.time.ZoneOffset;
import java.util.*;

@Repository
public class ResumeRepository {

    private final JdbcTemplate jdbcTemplate;

    public ResumeRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<Resume> rowMapper = (rs, rowNum) -> {
        Resume r = new Resume();
        r.setId(rs.getObject("id", UUID.class));
        r.setUserId(rs.getObject("user_id", UUID.class));
        r.setFileName(rs.getString("file_name"));
        r.setMimeType(rs.getString("mime_type"));
        r.setSecureUrl(rs.getString("secure_url"));
        r.setPublicId(rs.getString("public_id"));
        r.setStorageProvider(rs.getString("storage_provider"));
        r.setSizeBytes(rs.getInt("size_bytes"));
        r.setExtractedText(rs.getString("extracted_text"));
        r.setAnalysisSummary(rs.getString("analysis_summary"));
        r.setScore(rs.getInt("score"));

        Array sArr = rs.getArray("strengths");
        if (sArr != null) r.setStrengths(Arrays.asList((String[]) sArr.getArray()));

        Array iArr = rs.getArray("improvements");
        if (iArr != null) r.setImprovements(Arrays.asList((String[]) iArr.getArray()));

        Array kArr = rs.getArray("keywords");
        if (kArr != null) r.setKeywords(Arrays.asList((String[]) kArr.getArray()));

        r.setSections(JsonUtil.toMap(rs.getString("sections")));
        r.setIsActive(rs.getBoolean("is_active"));

        Timestamp c = rs.getTimestamp("created_at");
        if (c != null) r.setCreatedAt(c.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp u = rs.getTimestamp("updated_at");
        if (u != null) r.setUpdatedAt(u.toInstant().atOffset(ZoneOffset.UTC));

        return r;
    };

    public void deactivateActiveResumes(UUID userId) {
        jdbcTemplate.update("UPDATE resumes SET is_active = FALSE WHERE user_id = ? AND is_active = TRUE", userId);
    }

    public Resume createResume(Resume payload) {
        UUID id = payload.getId() != null ? payload.getId() : UUID.randomUUID();

        String sql = """
            INSERT INTO resumes (
                id, user_id, file_name, mime_type, secure_url, public_id,
                storage_provider, size_bytes, extracted_text, analysis_summary,
                score, strengths, improvements, keywords, sections, is_active
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?::jsonb, ?
            )
            RETURNING *
        """;

        String[] strengths = payload.getStrengths() != null ? payload.getStrengths().toArray(new String[0]) : new String[0];
        String[] improvements = payload.getImprovements() != null ? payload.getImprovements().toArray(new String[0]) : new String[0];
        String[] keywords = payload.getKeywords() != null ? payload.getKeywords().toArray(new String[0]) : new String[0];

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                id,
                payload.getUserId(),
                payload.getFileName(),
                payload.getMimeType(),
                payload.getSecureUrl(),
                payload.getPublicId(),
                payload.getStorageProvider() != null ? payload.getStorageProvider() : "local",
                payload.getSizeBytes() != null ? payload.getSizeBytes() : 0,
                payload.getExtractedText(),
                payload.getAnalysisSummary(),
                payload.getScore() != null ? payload.getScore() : 0,
                strengths,
                improvements,
                keywords,
                JsonUtil.toJson(payload.getSections() != null ? payload.getSections() : Map.of()),
                payload.getIsActive() != null ? payload.getIsActive() : true
        );
    }

    public Optional<Resume> getLatestResume(UUID userId) {
        String sql = "SELECT * FROM resumes WHERE user_id = ? ORDER BY is_active DESC, created_at DESC LIMIT 1";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, rowMapper, userId));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public List<Resume> listResumes(UUID userId) {
        String sql = "SELECT * FROM resumes WHERE user_id = ? ORDER BY created_at DESC";
        return jdbcTemplate.query(sql, rowMapper, userId);
    }

    public List<Resume> deleteByUser(UUID userId) {
        String sql = "DELETE FROM resumes WHERE user_id = ? RETURNING *";
        return jdbcTemplate.query(sql, rowMapper, userId);
    }

    public Optional<Resume> deleteByIdAndUser(UUID id, UUID userId) {
        String sql = "DELETE FROM resumes WHERE id = ? AND user_id = ? RETURNING *";
        try {
            Resume deleted = jdbcTemplate.queryForObject(sql, rowMapper, id, userId);
            jdbcTemplate.update(
                "UPDATE resumes SET is_active = TRUE WHERE id = (SELECT id FROM resumes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1)",
                userId
            );
            return Optional.ofNullable(deleted);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }
}
