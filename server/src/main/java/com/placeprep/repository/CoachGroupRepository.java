package com.placeprep.repository;

import com.placeprep.model.CoachGroup;
import com.placeprep.util.JsonUtil;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.ZoneOffset;
import java.util.*;

@Repository
public class CoachGroupRepository {

    private final JdbcTemplate jdbcTemplate;

    public CoachGroupRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<CoachGroup> groupRowMapper = (rs, rowNum) -> {
        CoachGroup g = new CoachGroup();
        g.setId(rs.getObject("id", UUID.class));
        g.setName(rs.getString("name"));
        g.setDescription(rs.getString("description"));
        g.setCreatedBy(rs.getObject("created_by", UUID.class));
        try {
            g.setCreatedByName(rs.getString("created_by_name"));
        } catch (Exception ignored) {}

        g.setMetadata(JsonUtil.toMap(rs.getString("metadata")));

        Timestamp c = rs.getTimestamp("created_at");
        if (c != null) g.setCreatedAt(c.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp u = rs.getTimestamp("updated_at");
        if (u != null) g.setUpdatedAt(u.toInstant().atOffset(ZoneOffset.UTC));

        return g;
    };

    public CoachGroup createGroup(CoachGroup payload) {
        UUID id = payload.getId() != null ? payload.getId() : UUID.randomUUID();

        String sql = """
            INSERT INTO coach_groups (id, name, description, created_by, metadata)
            VALUES (?, ?, ?, ?, ?::jsonb)
            RETURNING *
        """;

        return jdbcTemplate.queryForObject(
                sql,
                groupRowMapper,
                id,
                payload.getName(),
                payload.getDescription(),
                payload.getCreatedBy(),
                JsonUtil.toJson(payload.getMetadata())
        );
    }

    public Optional<CoachGroup> findGroupById(UUID groupId) {
        String sql = """
            SELECT cg.*, u.name AS created_by_name
            FROM coach_groups cg
            LEFT JOIN users u ON u.id = cg.created_by
            WHERE cg.id = ?
        """;
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, groupRowMapper, groupId));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<CoachGroup> findGroupByNormalizedName(String name) {
        String sql = """
            SELECT cg.*, u.name AS created_by_name
            FROM coach_groups cg
            LEFT JOIN users u ON u.id = cg.created_by
            WHERE LOWER(cg.name) = LOWER(?)
            LIMIT 1
        """;
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, groupRowMapper, name.trim()));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public List<CoachGroup> listGroups() {
        String sql = """
            SELECT cg.*, u.name AS created_by_name
            FROM coach_groups cg
            LEFT JOIN users u ON u.id = cg.created_by
            ORDER BY cg.created_at DESC, LOWER(cg.name) ASC
        """;
        return jdbcTemplate.query(sql, groupRowMapper);
    }

    public void addMembers(UUID groupId, List<UUID> userIds, UUID addedBy) {
        if (userIds == null || userIds.isEmpty()) return;

        String sql = """
            INSERT INTO coach_group_members (group_id, user_id, added_by)
            VALUES (?, ?, ?)
            ON CONFLICT (group_id, user_id) DO NOTHING
        """;

        List<Object[]> batch = new ArrayList<>();
        for (UUID uId : userIds) {
            batch.add(new Object[]{groupId, uId, addedBy});
        }
        jdbcTemplate.batchUpdate(sql, batch);
    }

    public boolean removeMember(UUID groupId, UUID userId) {
        int updated = jdbcTemplate.update(
                "DELETE FROM coach_group_members WHERE group_id = ? AND user_id = ?",
                groupId, userId
        );
        return updated > 0;
    }

    public List<Map<String, Object>> listMembers(List<UUID> groupIds) {
        if (groupIds == null || groupIds.isEmpty()) return List.of();

        String sql = """
            SELECT
                cgm.group_id AS "groupId",
                cgm.user_id AS "userId",
                s.name,
                s.username,
                s.role,
                s.email,
                s.target_role AS "targetRole",
                s.readiness_score AS "readinessScore",
                COALESCE(s.coach_metadata->>'accessTier', 'standard') AS "accessTier",
                cgm.added_by AS "addedBy",
                a.name AS "addedByName",
                cgm.created_at AS "createdAt"
            FROM coach_group_members cgm
            JOIN users s ON s.id = cgm.user_id
            LEFT JOIN users a ON a.id = cgm.added_by
            WHERE cgm.group_id = ANY(?)
            ORDER BY cgm.group_id ASC, LOWER(s.name) ASC
        """;

        try {
            java.sql.Array array = jdbcTemplate.getDataSource().getConnection().createArrayOf("uuid", groupIds.toArray());
            return jdbcTemplate.queryForList(sql, array);
        } catch (Exception e) {
            // Fallback using IN clause
            String inSql = String.format("""
                SELECT
                    cgm.group_id AS "groupId",
                    cgm.user_id AS "userId",
                    s.name,
                    s.username,
                    s.role,
                    s.email,
                    s.target_role AS "targetRole",
                    s.readiness_score AS "readinessScore",
                    COALESCE(s.coach_metadata->>'accessTier', 'standard') AS "accessTier",
                    cgm.added_by AS "addedBy",
                    a.name AS "addedByName",
                    cgm.created_at AS "createdAt"
                FROM coach_group_members cgm
                JOIN users s ON s.id = cgm.user_id
                LEFT JOIN users a ON a.id = cgm.added_by
                WHERE cgm.group_id IN (%s)
                ORDER BY cgm.group_id ASC, LOWER(s.name) ASC
            """, String.join(",", Collections.nCopies(groupIds.size(), "?")));
            return jdbcTemplate.queryForList(inSql, groupIds.toArray());
        }
    }
}
