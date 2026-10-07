package com.placeprep.repository;

import com.placeprep.model.ApkVersion;
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
public class ApkVersionRepository {

    private final JdbcTemplate jdbcTemplate;

    public ApkVersionRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<ApkVersion> rowMapper = (rs, rowNum) -> {
        ApkVersion a = new ApkVersion();
        a.setId(rs.getObject("id", UUID.class));
        a.setVersion(rs.getString("version"));
        a.setFileName(rs.getString("file_name"));
        a.setFileUrl(rs.getString("file_url"));
        a.setPublicId(rs.getString("public_id"));
        a.setMimeType(rs.getString("mime_type"));
        a.setBytes(rs.getInt("bytes"));
        a.setStorageProvider(rs.getString("storage_provider"));
        a.setUploadedBy(rs.getObject("uploaded_by", UUID.class));
        a.setIsActive(rs.getBoolean("is_active"));
        a.setMetadata(JsonUtil.toMap(rs.getString("metadata")));

        Timestamp up = rs.getTimestamp("uploaded_at");
        if (up != null) a.setUploadedAt(up.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp c = rs.getTimestamp("created_at");
        if (c != null) a.setCreatedAt(c.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp u = rs.getTimestamp("updated_at");
        if (u != null) a.setUpdatedAt(u.toInstant().atOffset(ZoneOffset.UTC));

        return a;
    };

    public ApkVersion createVersion(ApkVersion payload) {
        UUID id = payload.getId() != null ? payload.getId() : UUID.randomUUID();

        String sql = """
            INSERT INTO apk_versions (
                id, version, file_name, file_url, public_id, mime_type, bytes,
                storage_provider, uploaded_by, is_active, metadata
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, TRUE, ?::jsonb
            )
            RETURNING *
        """;

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                id,
                payload.getVersion(),
                payload.getFileName(),
                payload.getFileUrl(),
                payload.getPublicId(),
                payload.getMimeType() != null ? payload.getMimeType() : "application/vnd.android.package-archive",
                payload.getBytes() != null ? payload.getBytes() : 0,
                payload.getStorageProvider() != null ? payload.getStorageProvider() : "local",
                payload.getUploadedBy(),
                JsonUtil.toJson(payload.getMetadata())
        );
    }

    public void deactivateAll() {
        jdbcTemplate.update("UPDATE apk_versions SET is_active = FALSE WHERE is_active = TRUE");
    }

    public Optional<ApkVersion> findLatestActive() {
        String sql = "SELECT * FROM apk_versions WHERE is_active = TRUE ORDER BY uploaded_at DESC LIMIT 1";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, rowMapper));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<ApkVersion> findById(UUID id) {
        String sql = "SELECT * FROM apk_versions WHERE id = ?";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, rowMapper, id));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public List<ApkVersion> listVersions(int limit) {
        String sql = "SELECT * FROM apk_versions ORDER BY uploaded_at DESC LIMIT ?";
        return jdbcTemplate.query(sql, rowMapper, limit > 0 ? limit : 10);
    }
}
