package com.placeprep.repository;

import com.placeprep.model.Notification;
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
public class NotificationRepository {

    private final JdbcTemplate jdbcTemplate;

    public NotificationRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<Notification> rowMapper = (rs, rowNum) -> {
        Notification n = new Notification();
        n.setId(rs.getObject("id", UUID.class));
        n.setUserId(rs.getObject("user_id", UUID.class));
        n.setType(rs.getString("type"));
        n.setMessage(rs.getString("message"));

        Timestamp sent = rs.getTimestamp("sent_at");
        if (sent != null) n.setSentAt(sent.toInstant().atOffset(ZoneOffset.UTC));

        n.setRead(rs.getBoolean("read"));

        Timestamp rd = rs.getTimestamp("read_at");
        if (rd != null) n.setReadAt(rd.toInstant().atOffset(ZoneOffset.UTC));

        Array chArr = rs.getArray("delivery_channels");
        if (chArr != null) n.setDeliveryChannels(Arrays.asList((String[]) chArr.getArray()));

        n.setMetadata(JsonUtil.toMap(rs.getString("metadata")));
        n.setDedupeKey(rs.getString("dedupe_key"));

        Timestamp c = rs.getTimestamp("created_at");
        if (c != null) n.setCreatedAt(c.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp u = rs.getTimestamp("updated_at");
        if (u != null) n.setUpdatedAt(u.toInstant().atOffset(ZoneOffset.UTC));

        return n;
    };

    public Notification createNotification(Notification payload) {
        UUID id = payload.getId() != null ? payload.getId() : UUID.randomUUID();

        String sql = """
            INSERT INTO notifications (
                id, user_id, type, message, sent_at, read, delivery_channels, metadata, dedupe_key
            ) VALUES (
                ?, ?, ?, ?, ?, FALSE, ?, ?::jsonb, ?
            )
            ON CONFLICT (user_id, type, dedupe_key) DO NOTHING
            RETURNING *
        """;

        Timestamp sent = payload.getSentAt() != null
                ? Timestamp.from(payload.getSentAt().toInstant())
                : Timestamp.from(OffsetDateTime.now().toInstant());

        String[] channels = payload.getDeliveryChannels() != null ? payload.getDeliveryChannels().toArray(new String[0]) : new String[0];
        String dedupeKey = payload.getDedupeKey() != null ? payload.getDedupeKey() : UUID.randomUUID().toString();

        try {
            return jdbcTemplate.queryForObject(
                    sql,
                    rowMapper,
                    id,
                    payload.getUserId(),
                    payload.getType(),
                    payload.getMessage(),
                    sent,
                    channels,
                    JsonUtil.toJson(payload.getMetadata()),
                    dedupeKey
            );
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    public List<Notification> listNotifications(UUID userId, Boolean unreadOnly, int limit) {
        StringBuilder sql = new StringBuilder("SELECT * FROM notifications WHERE user_id = ?");
        List<Object> params = new ArrayList<>();
        params.add(userId);

        if (Boolean.TRUE.equals(unreadOnly)) {
            sql.append(" AND read = FALSE");
        }

        sql.append(" ORDER BY sent_at DESC LIMIT ?");
        params.add(Math.clamp(limit > 0 ? limit : 20, 1, 100));

        return jdbcTemplate.query(sql.toString(), rowMapper, params.toArray());
    }

    public Optional<Notification> markRead(UUID userId, UUID notificationId) {
        String sql = "UPDATE notifications SET read = TRUE, read_at = COALESCE(read_at, NOW()) WHERE user_id = ? AND id = ? RETURNING *";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, rowMapper, userId, notificationId));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public int markAllRead(UUID userId) {
        return jdbcTemplate.update("UPDATE notifications SET read = TRUE, read_at = COALESCE(read_at, NOW()) WHERE user_id = ? AND read = FALSE", userId);
    }

    public int deleteByUser(UUID userId) {
        return jdbcTemplate.update("DELETE FROM notifications WHERE user_id = ?", userId);
    }

    public int deleteByIdAndUser(UUID id, UUID userId) {
        return jdbcTemplate.update("DELETE FROM notifications WHERE id = ? AND user_id = ?", id, userId);
    }
}
