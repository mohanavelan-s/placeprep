package com.placeprep.repository;

import com.placeprep.model.User;
import com.placeprep.util.JsonUtil;
import com.placeprep.util.OwnerAccess;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Array;
import java.sql.Date;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.ZoneOffset;
import java.util.*;

@Repository
public class UserRepository {

    private final JdbcTemplate jdbcTemplate;
    private final OwnerAccess ownerAccess;
    private final RowMapper<User> rowMapper;

    public UserRepository(JdbcTemplate jdbcTemplate, OwnerAccess ownerAccess) {
        this.jdbcTemplate = jdbcTemplate;
        this.ownerAccess = ownerAccess;
        this.rowMapper = (rs, rowNum) -> {
        User u = new User();
        u.setId(rs.getObject("id", UUID.class));
        u.setName(rs.getString("name"));
        u.setUsername(rs.getString("username"));
        u.setRole(rs.getString("role"));
        u.setEmail(rs.getString("email"));

        try {
            u.setPasswordHash(rs.getString("password_hash"));
        } catch (SQLException ignored) {}

        try {
            Array weakArr = rs.getArray("weak_areas");
            if (weakArr != null) {
                String[] arr = (String[]) weakArr.getArray();
                u.setWeakAreas(Arrays.asList(arr));
            }
        } catch (SQLException ignored) {}

        try {
            Array strongArr = rs.getArray("strong_topics");
            if (strongArr != null) {
                String[] arr = (String[]) strongArr.getArray();
                u.setStrongTopics(Arrays.asList(arr));
            }
        } catch (SQLException ignored) {}

        u.setTargetRole(rs.getString("target_role"));
        Date pDate = rs.getDate("placement_date");
        if (pDate != null) u.setPlacementDate(pDate.toLocalDate());

        u.setTimezone(rs.getString("timezone"));
        u.setSolvedProblems(rs.getInt("solved_problems"));
        u.setAverageTimePerProblem(rs.getDouble("average_time_per_problem"));
        u.setFailedAttempts(rs.getInt("failed_attempts"));
        u.setMistakeCount(rs.getInt("mistake_count"));
        u.setConsistencyScore(rs.getDouble("consistency_score"));
        u.setCurrentStreak(rs.getInt("current_streak"));
        u.setReadinessScore(rs.getDouble("readiness_score"));
        u.setTier(rs.getString("tier"));
        u.setPlanGenerations(rs.getInt("plan_generations"));
        u.setMentorMessages(rs.getInt("mentor_messages"));

        String coachJson = rs.getString("coach_metadata");
        Map<String, Object> meta = JsonUtil.toMap(coachJson);
        u.setCoachMetadata(meta);
        u.setPreferredLanguage((String) meta.getOrDefault("preferredLanguage", "english"));
        u.setAccessTier((String) meta.getOrDefault("accessTier", "standard"));

        Timestamp lastLogin = rs.getTimestamp("last_login_at");
        if (lastLogin != null) u.setLastLoginAt(lastLogin.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp created = rs.getTimestamp("created_at");
        if (created != null) u.setCreatedAt(created.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp updated = rs.getTimestamp("updated_at");
        if (updated != null) u.setUpdatedAt(updated.toInstant().atOffset(ZoneOffset.UTC));

        return ownerAccess.applyOwnerAccess(u);
    };
    }

    public Optional<User> findById(UUID id) {
        String sql = "SELECT * FROM users WHERE id = ?";
        try {
            User user = jdbcTemplate.queryForObject(sql, rowMapper, id);
            return Optional.ofNullable(user);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<User> findByEmail(String email) {
        if (email == null) return Optional.empty();
        String sql = "SELECT * FROM users WHERE LOWER(email) = LOWER(?)";
        try {
            User user = jdbcTemplate.queryForObject(sql, rowMapper, email.trim());
            return Optional.ofNullable(user);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<User> findByUsername(String username) {
        if (username == null) return Optional.empty();
        String sql = "SELECT * FROM users WHERE LOWER(username) = LOWER(?)";
        try {
            User user = jdbcTemplate.queryForObject(sql, rowMapper, username.trim());
            return Optional.ofNullable(user);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<User> findByIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) return Optional.empty();
        String norm = identifier.trim();
        if (norm.contains("@")) {
            return findByEmail(norm);
        }
        return findByUsername(norm);
    }

    public User createUser(User user) {
        UUID id = user.getId() != null ? user.getId() : UUID.randomUUID();
        user.setId(id);

        boolean isOwner = ownerAccess.isOwnerEmail(user.getEmail());
        String role = isOwner ? "admin" : (user.getRole() != null ? user.getRole() : "user");
        String tier = isOwner ? "college" : (user.getTier() != null ? user.getTier() : "free");

        String sql = """
            INSERT INTO users (
                id, name, username, role, email, password_hash,
                weak_areas, strong_topics, target_role, placement_date,
                timezone, tier, plan_generations, mentor_messages, coach_metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?::text[], ?::text[], ?, ?, ?, ?, ?, ?, ?::jsonb)
            RETURNING *
        """;

        String weakAreasSql = "{" + String.join(",", user.getWeakAreas()) + "}";
        String strongTopicsSql = "{" + String.join(",", user.getStrongTopics()) + "}";
        String coachJson = JsonUtil.toJson(user.getCoachMetadata());

        Date pDate = user.getPlacementDate() != null ? Date.valueOf(user.getPlacementDate()) : null;

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                id,
                user.getName(),
                user.getUsername(),
                role,
                user.getEmail(),
                user.getPasswordHash(),
                weakAreasSql,
                strongTopicsSql,
                user.getTargetRole(),
                pDate,
                user.getTimezone() != null ? user.getTimezone() : "Asia/Calcutta",
                tier,
                user.getPlanGenerations(),
                user.getMentorMessages(),
                coachJson
        );
    }

    public void touchLastLogin(UUID id) {
        String sql = "UPDATE users SET last_login_at = NOW() WHERE id = ?";
        jdbcTemplate.update(sql, id);
    }

    public User updateProfile(User user) {
        String sql = """
            UPDATE users SET
                name = COALESCE(?, name),
                username = COALESCE(?, username),
                target_role = COALESCE(?, target_role),
                placement_date = COALESCE(?, placement_date),
                timezone = COALESCE(?, timezone),
                weak_areas = COALESCE(?::text[], weak_areas),
                strong_topics = COALESCE(?::text[], strong_topics),
                coach_metadata = COALESCE(?::jsonb, coach_metadata),
                updated_at = NOW()
            WHERE id = ?
            RETURNING *
        """;

        Date pDate = user.getPlacementDate() != null ? Date.valueOf(user.getPlacementDate()) : null;
        String weakAreasSql = user.getWeakAreas() != null ? "{" + String.join(",", user.getWeakAreas()) + "}" : null;
        String strongTopicsSql = user.getStrongTopics() != null ? "{" + String.join(",", user.getStrongTopics()) + "}" : null;
        String coachJson = user.getCoachMetadata() != null ? JsonUtil.toJson(user.getCoachMetadata()) : null;

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                user.getName(),
                user.getUsername(),
                user.getTargetRole(),
                pDate,
                user.getTimezone(),
                weakAreasSql,
                strongTopicsSql,
                coachJson,
                user.getId()
        );
    }

    public void deleteById(UUID id) {
        jdbcTemplate.update("DELETE FROM users WHERE id = ?", id);
    }

    public List<User> listUsers(int limit, int offset, String search) {
        if (search != null && !search.isBlank()) {
            String pattern = "%" + search.trim() + "%";
            String sql = "SELECT * FROM users WHERE name ILIKE ? OR email ILIKE ? OR username ILIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?";
            return jdbcTemplate.query(sql, rowMapper, pattern, pattern, pattern, limit, offset);
        } else {
            String sql = "SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?";
            return jdbcTemplate.query(sql, rowMapper, limit, offset);
        }
    }

    public List<User> listRecentActiveUsers(int limit) {
        String sql = "SELECT * FROM users ORDER BY last_login_at DESC NULLS LAST, created_at DESC LIMIT ?";
        return jdbcTemplate.query(sql, rowMapper, limit);
    }
}
