package com.placeprep.repository;

import com.placeprep.model.PushSubscription;
import com.placeprep.util.JsonUtil;
import jakarta.annotation.PostConstruct;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Repository
public class PushSubscriptionRepository {

    private final JdbcTemplate jdbcTemplate;

    public PushSubscriptionRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<PushSubscription> rowMapper = (rs, rowNum) -> {
        PushSubscription sub = new PushSubscription();
        sub.setId(rs.getObject("id", UUID.class));
        sub.setUserId(rs.getObject("user_id", UUID.class));
        sub.setEndpoint(rs.getString("endpoint"));
        sub.setP256dh(rs.getString("p256dh"));
        sub.setAuth(rs.getString("auth"));

        Timestamp exp = rs.getTimestamp("expiration_time");
        if (exp != null) sub.setExpirationTime(exp.toInstant().atOffset(ZoneOffset.UTC));

        sub.setUserAgent(rs.getString("user_agent"));
        sub.setMetadata(JsonUtil.toMap(rs.getString("metadata")));

        Timestamp c = rs.getTimestamp("created_at");
        if (c != null) sub.setCreatedAt(c.toInstant().atOffset(ZoneOffset.UTC));

        Timestamp u = rs.getTimestamp("updated_at");
        if (u != null) sub.setUpdatedAt(u.toInstant().atOffset(ZoneOffset.UTC));

        Timestamp l = rs.getTimestamp("last_used_at");
        if (l != null) sub.setLastUsedAt(l.toInstant().atOffset(ZoneOffset.UTC));

        return sub;
    };

    @PostConstruct
    public void initTable() {
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS push_subscriptions (
                    id UUID PRIMARY KEY,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    endpoint TEXT NOT NULL UNIQUE,
                    p256dh TEXT NOT NULL,
                    auth TEXT NOT NULL,
                    expiration_time TIMESTAMPTZ,
                    user_agent TEXT,
                    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    last_used_at TIMESTAMPTZ
                );
                CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id, updated_at DESC);
            """);
        } catch (Exception e) {
            // Log and allow running if table already exists or permission restricted
        }
    }

    public PushSubscription upsertSubscription(PushSubscription sub) {
        UUID id = sub.getId() != null ? sub.getId() : UUID.randomUUID();
        Timestamp exp = sub.getExpirationTime() != null ? Timestamp.from(sub.getExpirationTime().toInstant()) : null;

        String sql = """
            INSERT INTO push_subscriptions (
                id, user_id, endpoint, p256dh, auth, expiration_time, user_agent, metadata, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?::jsonb, NOW(), NOW()
            )
            ON CONFLICT (endpoint) DO UPDATE SET
                user_id = EXCLUDED.user_id,
                p256dh = EXCLUDED.p256dh,
                auth = EXCLUDED.auth,
                expiration_time = EXCLUDED.expiration_time,
                user_agent = COALESCE(EXCLUDED.user_agent, push_subscriptions.user_agent),
                updated_at = NOW()
            RETURNING *
        """;

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                id,
                sub.getUserId(),
                sub.getEndpoint(),
                sub.getP256dh(),
                sub.getAuth(),
                exp,
                sub.getUserAgent(),
                JsonUtil.toJson(sub.getMetadata())
        );
    }

    public boolean deleteByEndpoint(UUID userId, String endpoint) {
        int rows = jdbcTemplate.update("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?", userId, endpoint);
        return rows > 0;
    }

    public boolean deleteByEndpointAnyUser(String endpoint) {
        int rows = jdbcTemplate.update("DELETE FROM push_subscriptions WHERE endpoint = ?", endpoint);
        return rows > 0;
    }

    public List<PushSubscription> listByUserId(UUID userId) {
        return jdbcTemplate.query(
                "SELECT * FROM push_subscriptions WHERE user_id = ? ORDER BY updated_at DESC",
                rowMapper,
                userId
        );
    }

    public void touchSubscription(String endpoint) {
        jdbcTemplate.update("UPDATE push_subscriptions SET last_used_at = NOW() WHERE endpoint = ?", endpoint);
    }
}
