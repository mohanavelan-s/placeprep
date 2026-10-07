package com.placeprep.repository;

import com.placeprep.model.Invite;
import com.placeprep.util.JsonUtil;
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
public class InviteRepository {

    private final JdbcTemplate jdbcTemplate;

    public InviteRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<Invite> rowMapper = (rs, rowNum) -> {
        Invite inv = new Invite();
        inv.setId(rs.getObject("id", UUID.class));
        inv.setCode(rs.getString("code"));
        inv.setRole(rs.getString("role"));
        inv.setCreatedBy(rs.getObject("created_by", UUID.class));

        Timestamp expires = rs.getTimestamp("expires_at");
        if (expires != null) inv.setExpiresAt(expires.toInstant().atOffset(ZoneOffset.UTC));

        inv.setUsed(rs.getBoolean("used"));
        inv.setUsedBy(rs.getObject("used_by", UUID.class));

        Timestamp used = rs.getTimestamp("used_at");
        if (used != null) inv.setUsedAt(used.toInstant().atOffset(ZoneOffset.UTC));

        inv.setMetadata(JsonUtil.toMap(rs.getString("metadata")));

        Timestamp created = rs.getTimestamp("created_at");
        if (created != null) inv.setCreatedAt(created.toInstant().atOffset(ZoneOffset.UTC));
        Timestamp updated = rs.getTimestamp("updated_at");
        if (updated != null) inv.setUpdatedAt(updated.toInstant().atOffset(ZoneOffset.UTC));

        return inv;
    };

    public Optional<Invite> findByCode(String code) {
        if (code == null) return Optional.empty();
        String sql = "SELECT * FROM invites WHERE code = ?";
        try {
            Invite inv = jdbcTemplate.queryForObject(sql, rowMapper, code.trim());
            return Optional.ofNullable(inv);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Invite createInvite(Invite invite) {
        UUID id = invite.getId() != null ? invite.getId() : UUID.randomUUID();
        invite.setId(id);

        String sql = """
            INSERT INTO invites (id, code, role, created_by, expires_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?::jsonb)
            RETURNING *
        """;

        Timestamp exp = invite.getExpiresAt() != null ? Timestamp.from(invite.getExpiresAt().toInstant()) : null;
        String metaJson = JsonUtil.toJson(invite.getMetadata());

        return jdbcTemplate.queryForObject(
                sql,
                rowMapper,
                id,
                invite.getCode(),
                invite.getRole() != null ? invite.getRole() : "user",
                invite.getCreatedBy(),
                exp,
                metaJson
        );
    }

    public List<Invite> listInvites(int limit) {
        String sql = "SELECT * FROM invites ORDER BY created_at DESC LIMIT ?";
        return jdbcTemplate.query(sql, rowMapper, limit);
    }

    public Invite markInviteUsed(UUID inviteId, UUID userId) {
        String sql = """
            UPDATE invites SET used = TRUE, used_by = ?, used_at = NOW()
            WHERE id = ?
            RETURNING *
        """;
        return jdbcTemplate.queryForObject(sql, rowMapper, userId, inviteId);
    }

    public int deleteInactiveInvites() {
        return jdbcTemplate.update("DELETE FROM invites WHERE used = TRUE OR expires_at <= NOW()");
    }
}
