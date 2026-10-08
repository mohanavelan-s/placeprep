package com.placeprep.repository;

import com.placeprep.util.JsonUtil;
import jakarta.annotation.PostConstruct;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.Optional;

@Repository
public class AppSettingRepository {

    private final JdbcTemplate jdbcTemplate;

    public AppSettingRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void initTable() {
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value JSONB NOT NULL DEFAULT '{}'::JSONB,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """);
        } catch (Exception ignored) {
        }
    }

    public Optional<Map<String, Object>> findByKey(String key) {
        try {
            String json = jdbcTemplate.queryForObject(
                    "SELECT value::text FROM app_settings WHERE key = ?",
                    String.class,
                    key
            );
            return Optional.ofNullable(JsonUtil.toMap(json));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public void upsertSetting(String key, Map<String, Object> value) {
        String json = JsonUtil.toJson(value);
        jdbcTemplate.update("""
            INSERT INTO app_settings (key, value, created_at, updated_at)
            VALUES (?, ?::jsonb, NOW(), NOW())
            ON CONFLICT (key) DO UPDATE SET
                value = EXCLUDED.value,
                updated_at = NOW()
        """, key, json);
    }
}
