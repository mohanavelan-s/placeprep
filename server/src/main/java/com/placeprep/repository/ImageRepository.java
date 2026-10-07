package com.placeprep.repository;

import com.placeprep.model.Image;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Repository
public class ImageRepository {

    private final JdbcTemplate jdbcTemplate;

    public ImageRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<Image> rowMapper = (rs, rowNum) -> {
        Image img = new Image();
        img.setId(rs.getObject("id", UUID.class));
        img.setUserId(rs.getObject("user_id", UUID.class));
        img.setTaskId(rs.getObject("task_id", UUID.class));
        img.setDailyLogId(rs.getObject("daily_log_id", UUID.class));
        img.setSecureUrl(rs.getString("secure_url"));
        img.setPublicId(rs.getString("public_id"));
        img.setAssetId(rs.getString("asset_id"));
        img.setMimeType(rs.getString("mime_type"));
        img.setFormat(rs.getString("format"));
        img.setBytes(rs.getInt("bytes"));

        int w = rs.getInt("width");
        if (!rs.wasNull()) img.setWidth(w);
        int h = rs.getInt("height");
        if (!rs.wasNull()) img.setHeight(h);

        img.setStorageProvider(rs.getString("storage_provider"));

        Date pd = rs.getDate("proof_date");
        if (pd != null) img.setProofDate(pd.toLocalDate());

        img.setCaption(rs.getString("caption"));

        Timestamp c = rs.getTimestamp("created_at");
        if (c != null) img.setCreatedAt(c.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp u = rs.getTimestamp("updated_at");
        if (u != null) img.setUpdatedAt(u.toInstant().atOffset(ZoneOffset.UTC));

        return img;
    };

    public Image createImage(Image payload) {
        UUID id = payload.getId() != null ? payload.getId() : UUID.randomUUID();

        String sql = """
            INSERT INTO images (
                id, user_id, task_id, daily_log_id, secure_url, public_id, asset_id,
                mime_type, format, bytes, width, height, storage_provider, proof_date, caption
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            RETURNING *
        """;

        Date proofDate = payload.getProofDate() != null ? Date.valueOf(payload.getProofDate()) : Date.valueOf(LocalDate.now());

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                id,
                payload.getUserId(),
                payload.getTaskId(),
                payload.getDailyLogId(),
                payload.getSecureUrl(),
                payload.getPublicId(),
                payload.getAssetId(),
                payload.getMimeType(),
                payload.getFormat(),
                payload.getBytes() != null ? payload.getBytes() : 0,
                payload.getWidth(),
                payload.getHeight(),
                payload.getStorageProvider() != null ? payload.getStorageProvider() : "local",
                proofDate,
                payload.getCaption()
        );
    }

    public List<Image> listImages(UUID userId, LocalDate date, Integer limit) {
        StringBuilder sql = new StringBuilder("SELECT * FROM images WHERE user_id = ? AND COALESCE(caption, '') <> 'profile-avatar'");
        List<Object> params = new ArrayList<>();
        params.add(userId);

        if (date != null) {
            sql.append(" AND proof_date = ?");
            params.add(Date.valueOf(date));
        }

        int lim = limit != null && limit > 0 ? limit : 30;
        sql.append(" ORDER BY created_at DESC LIMIT ?");
        params.add(lim);

        return jdbcTemplate.query(sql.toString(), rowMapper, params.toArray());
    }

    public int deleteByUser(UUID userId) {
        return jdbcTemplate.update("DELETE FROM images WHERE user_id = ? AND COALESCE(caption, '') <> 'profile-avatar'", userId);
    }

    public int deleteByIdAndUser(UUID id, UUID userId) {
        return jdbcTemplate.update("DELETE FROM images WHERE id = ? AND user_id = ?", id, userId);
    }
}
