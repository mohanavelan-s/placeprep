package com.placeprep.repository;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Array;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Repository
public class OAuthRepository {

    private final JdbcTemplate jdbcTemplate;

    public OAuthRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public static class Transaction {
        public UUID id;
        public String clientId;
        public UUID userId;
        public String redirectUri;
        public List<String> scopes;
        public String resource;
        public String codeChallenge;
        public String externalState;
        public String status;
        public Instant expiresAt;
    }

    public static class AuthCode {
        public UUID id;
        public UUID transactionId;
        public String codeHash;
        public UUID userId;
        public String clientId;
        public String redirectUri;
        public String resource;
        public List<String> scopes;
        public String codeChallenge;
        public Instant expiresAt;
        public Instant usedAt;
    }

    public static class AccessToken {
        public UUID id;
        public String tokenHash;
        public UUID userId;
        public String clientId;
        public String resource;
        public List<String> scopes;
        public Instant expiresAt;
        public Instant revokedAt;
    }

    public void insertTransaction(UUID id, String clientId, String redirectUri, List<String> scopes, String resource, String codeChallenge, String externalState, Instant expiresAt) {
        String sql = """
            INSERT INTO oauth_authorization_transactions (
                id, client_id, redirect_uri, scopes, resource, code_challenge, external_state, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """;
        jdbcTemplate.update(
                sql,
                id,
                clientId,
                redirectUri,
                scopes.toArray(new String[0]),
                resource,
                codeChallenge,
                externalState,
                Timestamp.from(expiresAt)
        );
    }

    public Optional<Transaction> findTransactionById(UUID id) {
        String sql = "SELECT * FROM oauth_authorization_transactions WHERE id = ?";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, (rs, rowNum) -> {
                Transaction t = new Transaction();
                t.id = rs.getObject("id", UUID.class);
                t.clientId = rs.getString("client_id");
                t.userId = rs.getObject("user_id", UUID.class);
                t.redirectUri = rs.getString("redirect_uri");

                Array sc = rs.getArray("scopes");
                if (sc != null) t.scopes = Arrays.asList((String[]) sc.getArray());

                t.resource = rs.getString("resource");
                t.codeChallenge = rs.getString("code_challenge");
                t.externalState = rs.getString("external_state");
                t.status = rs.getString("status");

                Timestamp exp = rs.getTimestamp("expires_at");
                if (exp != null) t.expiresAt = exp.toInstant();

                return t;
            }, id));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public boolean authenticateTransaction(UUID id, UUID userId) {
        String sql = """
            UPDATE oauth_authorization_transactions
            SET user_id = ?, status = 'pending_consent'
            WHERE id = ? AND (status = 'pending_authentication' OR status = 'pending_consent')
        """;
        return jdbcTemplate.update(sql, userId, id) > 0;
    }

    public void updateTransactionStatus(UUID id, String status) {
        jdbcTemplate.update(
                "UPDATE oauth_authorization_transactions SET status = ?, completed_at = NOW() WHERE id = ?",
                status, id
        );
    }

    public void insertAuthCode(UUID id, UUID txId, String codeHash, UUID userId, String clientId, String redirectUri, String resource, List<String> scopes, String codeChallenge, Instant expiresAt) {
        String sql = """
            INSERT INTO oauth_authorization_codes (
                id, transaction_id, code_hash, user_id, client_id, redirect_uri, resource, scopes, code_challenge, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """;
        jdbcTemplate.update(
                sql,
                id,
                txId,
                codeHash,
                userId,
                clientId,
                redirectUri,
                resource,
                scopes.toArray(new String[0]),
                codeChallenge,
                Timestamp.from(expiresAt)
        );
    }

    public Optional<AuthCode> findAuthCodeByHash(String codeHash) {
        String sql = "SELECT * FROM oauth_authorization_codes WHERE code_hash = ?";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, (rs, rowNum) -> {
                AuthCode c = new AuthCode();
                c.id = rs.getObject("id", UUID.class);
                c.transactionId = rs.getObject("transaction_id", UUID.class);
                c.codeHash = rs.getString("code_hash");
                c.userId = rs.getObject("user_id", UUID.class);
                c.clientId = rs.getString("client_id");
                c.redirectUri = rs.getString("redirect_uri");
                c.resource = rs.getString("resource");

                Array sc = rs.getArray("scopes");
                if (sc != null) c.scopes = Arrays.asList((String[]) sc.getArray());

                c.codeChallenge = rs.getString("code_challenge");

                Timestamp exp = rs.getTimestamp("expires_at");
                if (exp != null) c.expiresAt = exp.toInstant();

                Timestamp used = rs.getTimestamp("used_at");
                if (used != null) c.usedAt = used.toInstant();

                return c;
            }, codeHash));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public void markAuthCodeUsed(UUID id) {
        jdbcTemplate.update("UPDATE oauth_authorization_codes SET used_at = NOW() WHERE id = ?", id);
    }

    public void insertAccessToken(UUID id, String tokenHash, UUID userId, String clientId, String resource, List<String> scopes, Instant expiresAt) {
        String sql = """
            INSERT INTO oauth_access_tokens (
                id, token_hash, user_id, client_id, resource, scopes, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """;
        jdbcTemplate.update(
                sql,
                id,
                tokenHash,
                userId,
                clientId,
                resource,
                scopes.toArray(new String[0]),
                Timestamp.from(expiresAt)
        );
    }

    public Optional<AccessToken> findAccessToken(UUID tokenId, String tokenHash) {
        String sql = """
            SELECT * FROM oauth_access_tokens
            WHERE (id = ? OR token_hash = ?) AND revoked_at IS NULL AND expires_at > NOW()
        """;
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, (rs, rowNum) -> {
                AccessToken t = new AccessToken();
                t.id = rs.getObject("id", UUID.class);
                t.tokenHash = rs.getString("token_hash");
                t.userId = rs.getObject("user_id", UUID.class);
                t.clientId = rs.getString("client_id");
                t.resource = rs.getString("resource");

                Array sc = rs.getArray("scopes");
                if (sc != null) t.scopes = Arrays.asList((String[]) sc.getArray());

                Timestamp exp = rs.getTimestamp("expires_at");
                if (exp != null) t.expiresAt = exp.toInstant();

                return t;
            }, tokenId, tokenHash));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public void revokeAccessToken(UUID tokenId, String tokenHash) {
        if (tokenId != null) {
            jdbcTemplate.update(
                    "UPDATE oauth_access_tokens SET revoked_at = NOW() WHERE (id = ? OR token_hash = ?) AND revoked_at IS NULL",
                    tokenId, tokenHash
            );
        } else {
            jdbcTemplate.update(
                    "UPDATE oauth_access_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL",
                    tokenHash
            );
        }
    }
}
