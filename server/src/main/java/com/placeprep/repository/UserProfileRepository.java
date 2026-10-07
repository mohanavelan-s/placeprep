package com.placeprep.repository;

import com.placeprep.model.UserProfile;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

@Repository
public class UserProfileRepository {

    private final JdbcTemplate jdbcTemplate;

    public UserProfileRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<UserProfile> rowMapper = (rs, rowNum) -> {
        UserProfile p = new UserProfile();
        p.setId(rs.getObject("id", UUID.class));
        p.setUserId(rs.getObject("user_id", UUID.class));
        p.setLinkedinUrl(rs.getString("linkedin_url"));
        p.setGithubUrl(rs.getString("github_url"));
        p.setLeetcodeUrl(rs.getString("leetcode_url"));
        p.setPortfolioUrl(rs.getString("portfolio_url"));
        p.setResumeUrl(rs.getString("resume_url"));
        p.setAvatarUrl(rs.getString("avatar_url"));
        p.setNotificationsEnabled(rs.getBoolean("notifications_enabled"));
        p.setNotificationEmailEnabled(rs.getBoolean("notification_email_enabled"));
        p.setNotificationBrowserEnabled(rs.getBoolean("notification_browser_enabled"));
        p.setNotificationBrowserPermission(rs.getString("notification_browser_permission"));

        Timestamp created = rs.getTimestamp("created_at");
        if (created != null) p.setCreatedAt(created.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp updated = rs.getTimestamp("updated_at");
        if (updated != null) p.setUpdatedAt(updated.toInstant().atOffset(ZoneOffset.UTC));

        return p;
    };

    public Optional<UserProfile> findByUserId(UUID userId) {
        String sql = "SELECT * FROM user_profiles WHERE user_id = ?";
        try {
            UserProfile profile = jdbcTemplate.queryForObject(sql, rowMapper, userId);
            return Optional.ofNullable(profile);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public UserProfile createProfile(UUID userId) {
        UUID id = UUID.randomUUID();
        String sql = """
            INSERT INTO user_profiles (
                id, user_id, notifications_enabled, notification_email_enabled, notification_browser_enabled, notification_browser_permission
            ) VALUES (?, ?, true, true, false, 'default')
            RETURNING *
        """;
        return jdbcTemplate.queryForObject(sql, rowMapper, id, userId);
    }

    public UserProfile upsertProfile(UserProfile p) {
        Optional<UserProfile> existing = findByUserId(p.getUserId());
        if (existing.isEmpty()) {
            UUID id = UUID.randomUUID();
            String sql = """
                INSERT INTO user_profiles (
                    id, user_id, linkedin_url, github_url, leetcode_url, portfolio_url, resume_url, avatar_url,
                    notifications_enabled, notification_email_enabled, notification_browser_enabled, notification_browser_permission
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING *
            """;
            return jdbcTemplate.queryForObject(
                    sql,
                    rowMapper,
                    id,
                    p.getUserId(),
                    p.getLinkedinUrl(),
                    p.getGithubUrl(),
                    p.getLeetcodeUrl(),
                    p.getPortfolioUrl(),
                    p.getResumeUrl(),
                    p.getAvatarUrl(),
                    p.isNotificationsEnabled(),
                    p.isNotificationEmailEnabled(),
                    p.isNotificationBrowserEnabled(),
                    p.getNotificationBrowserPermission() != null ? p.getNotificationBrowserPermission() : "default"
            );
        } else {
            String sql = """
                UPDATE user_profiles SET
                    linkedin_url = COALESCE(?, linkedin_url),
                    github_url = COALESCE(?, github_url),
                    leetcode_url = COALESCE(?, leetcode_url),
                    portfolio_url = COALESCE(?, portfolio_url),
                    resume_url = COALESCE(?, resume_url),
                    avatar_url = COALESCE(?, avatar_url),
                    notifications_enabled = COALESCE(?, notifications_enabled),
                    notification_email_enabled = COALESCE(?, notification_email_enabled),
                    notification_browser_enabled = COALESCE(?, notification_browser_enabled),
                    notification_browser_permission = COALESCE(?, notification_browser_permission),
                    updated_at = NOW()
                WHERE user_id = ?
                RETURNING *
            """;
            return jdbcTemplate.queryForObject(
                    sql,
                    rowMapper,
                    p.getLinkedinUrl(),
                    p.getGithubUrl(),
                    p.getLeetcodeUrl(),
                    p.getPortfolioUrl(),
                    p.getResumeUrl(),
                    p.getAvatarUrl(),
                    p.isNotificationsEnabled(),
                    p.isNotificationEmailEnabled(),
                    p.isNotificationBrowserEnabled(),
                    p.getNotificationBrowserPermission(),
                    p.getUserId()
            );
        }
    }
}
