package com.placeprep.repository;

import com.placeprep.model.MobileDevice;
import jakarta.annotation.PostConstruct;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class MobileDeviceRepository {

    private final JdbcTemplate jdbcTemplate;

    public MobileDeviceRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<MobileDevice> rowMapper = (rs, rowNum) -> {
        MobileDevice device = new MobileDevice();
        device.setId(rs.getObject("id", UUID.class));
        device.setUserId(rs.getObject("user_id", UUID.class));
        device.setDeviceToken(rs.getString("device_token"));
        device.setPlatform(rs.getString("platform"));
        device.setDeviceName(rs.getString("device_name"));
        device.setAppVersion(rs.getString("app_version"));

        Timestamp c = rs.getTimestamp("created_at");
        if (c != null) device.setCreatedAt(c.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp u = rs.getTimestamp("updated_at");
        if (u != null) device.setUpdatedAt(u.toInstant().atOffset(ZoneOffset.UTC));

        return device;
    };

    @PostConstruct
    public void initTable() {
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS mobile_devices (
                    id UUID PRIMARY KEY,
                    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    device_token TEXT NOT NULL UNIQUE,
                    platform VARCHAR(20) NOT NULL DEFAULT 'android',
                    device_name VARCHAR(120),
                    app_version VARCHAR(40),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_mobile_devices_user_id ON mobile_devices(user_id, updated_at DESC);
            """);
        } catch (Exception e) {
            System.err.println("[mobile-devices] Warning creating mobile_devices table: " + e.getMessage());
        }
    }

    public MobileDevice registerDevice(UUID userId, String deviceToken, String platform, String deviceName, String appVersion) {
        String sql = """
            INSERT INTO mobile_devices (id, user_id, device_token, platform, device_name, app_version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON CONFLICT (device_token) DO UPDATE SET
                user_id = EXCLUDED.user_id,
                platform = EXCLUDED.platform,
                device_name = COALESCE(EXCLUDED.device_name, mobile_devices.device_name),
                app_version = COALESCE(EXCLUDED.app_version, mobile_devices.app_version),
                updated_at = NOW()
            RETURNING *
        """;

        UUID id = UUID.randomUUID();
        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                id,
                userId,
                deviceToken,
                platform != null ? platform : "android",
                deviceName,
                appVersion
        );
    }

    public boolean unregisterDevice(UUID userId, String deviceToken) {
        int rows = jdbcTemplate.update("DELETE FROM mobile_devices WHERE user_id = ? AND device_token = ?", userId, deviceToken);
        return rows > 0;
    }

    public List<MobileDevice> listByUserId(UUID userId) {
        return jdbcTemplate.query(
                "SELECT * FROM mobile_devices WHERE user_id = ? ORDER BY updated_at DESC",
                rowMapper,
                userId
        );
    }

    public Optional<MobileDevice> findByToken(String deviceToken) {
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(
                    "SELECT * FROM mobile_devices WHERE device_token = ?",
                    rowMapper,
                    deviceToken
            ));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }
}
