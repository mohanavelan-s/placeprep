package com.placeprep.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.placeprep.exception.AppException;
import com.placeprep.repository.OAuthRepository;
import com.placeprep.security.OAuthKeyProvider;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class OAuthService {

    private final OAuthRepository oAuthRepository;
    private final OAuthKeyProvider oAuthKeyProvider;
    private final ObjectMapper objectMapper;

    private static final Set<String> SUPPORTED_SCOPES = Set.of(
            "placeprep.profile.read",
            "placeprep.tasks.read",
            "placeprep.tasks.write",
            "placeprep.progress.read"
    );

    private static final List<String> DEFAULT_SCOPES = List.of(
            "placeprep.profile.read",
            "placeprep.tasks.read"
    );

    private static final long TX_TTL_MS = 2 * 60 * 60 * 1000L; // 2 hours
    private static final long CODE_TTL_MS = 10 * 60 * 1000L; // 10 mins
    private static final long TOKEN_TTL_MS = 60 * 60 * 1000L; // 1 hour

    private static final Pattern PKCE_CHALLENGE_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{43,128}$");

    @Value("${placeprep.mcp.public-url:${placeprep.oauth.public-url:${MCP_PUBLIC_URL:}}}")
    private String configuredPublicUrl;

    @Value("${placeprep.mcp.oauth-issuer:${placeprep.oauth.issuer:${OAUTH_ISSUER:}}}")
    private String configuredIssuer;

    @Value("${placeprep.mcp.oauth-resource:${placeprep.oauth.resource:${OAUTH_RESOURCE:}}}")
    private String configuredResource;

    @Value("${placeprep.mcp.oauth-clients:${OAUTH_CLIENTS:}}")
    private String configuredClientsJson;

    public OAuthService(OAuthRepository oAuthRepository, OAuthKeyProvider oAuthKeyProvider, ObjectMapper objectMapper) {
        this.oAuthRepository = oAuthRepository;
        this.oAuthKeyProvider = oAuthKeyProvider;
        this.objectMapper = objectMapper;
    }

    public Set<String> getSupportedScopes() {
        return SUPPORTED_SCOPES;
    }

    public Map<String, Object> getJwks() {
        return oAuthKeyProvider.getJwks();
    }

    public String getPublicBaseUrl(HttpServletRequest req) {
        if (configuredPublicUrl != null && !configuredPublicUrl.isBlank()) {
            return configuredPublicUrl.replaceAll("/$", "");
        }
        String proto = req.getHeader("x-forwarded-proto");
        if (proto != null && !proto.isBlank()) {
            if (proto.contains(",")) proto = proto.split(",")[0].trim();
        } else {
            proto = req.getScheme();
        }

        String host = req.getHeader("x-forwarded-host");
        if (host != null && !host.isBlank()) {
            if (host.contains(",")) host = host.split(",")[0].trim();
        } else {
            host = req.getHeader("host");
        }

        if (host == null || host.isBlank()) {
            host = "localhost:5000";
        }
        return proto + "://" + host;
    }

    public String getIssuer(HttpServletRequest req) {
        if (configuredIssuer != null && !configuredIssuer.isBlank()) {
            return configuredIssuer.replaceAll("/$", "");
        }
        return getPublicBaseUrl(req);
    }

    public String getResource(HttpServletRequest req) {
        if (configuredResource != null && !configuredResource.isBlank()) {
            return configuredResource.replaceAll("/$", "");
        }
        return getPublicBaseUrl(req) + "/mcp";
    }

    public static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    public static String sha256Base64Url(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Set<String>> parseConfiguredClients() {
        if (configuredClientsJson == null || configuredClientsJson.isBlank()) {
            return Collections.emptyMap();
        }
        try {
            List<Map<String, Object>> list = objectMapper.readValue(configuredClientsJson, List.class);
            Map<String, Set<String>> map = new HashMap<>();
            for (Map<String, Object> item : list) {
                String cId = (String) item.get("clientId");
                List<String> uris = (List<String>) item.get("redirectUris");
                if (cId != null && uris != null) {
                    map.put(cId, new HashSet<>(uris));
                }
            }
            return map;
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    public void validateClient(String clientId, String redirectUri) {
        if (clientId == null || clientId.isBlank() || redirectUri == null || redirectUri.isBlank()) {
            throw new AppException("Missing client_id or redirect_uri.", HttpStatus.BAD_REQUEST);
        }

        // Check configured clients JSON allowlist first
        Map<String, Set<String>> allowedMap = parseConfiguredClients();
        if (allowedMap.containsKey(clientId)) {
            Set<String> allowedUris = allowedMap.get(clientId);
            if (allowedUris.contains(redirectUri)) {
                return;
            }
            throw new AppException("Redirect URI is not allowed for client \"" + clientId + "\".", HttpStatus.BAD_REQUEST);
        }

        // Predefined local development client
        if ("local-mcp-test".equals(clientId)) {
            List<String> allowed = List.of(
                    "http://127.0.0.1:3000/oauth/callback",
                    "http://localhost:3000/oauth/callback",
                    "https://oauth.pstmn.io/v1/callback"
            );
            if (allowed.contains(redirectUri)) return;
            throw new AppException("Redirect URI is not allowed for local-mcp-test.", HttpStatus.BAD_REQUEST);
        }

        // Reject unintended localhost / loopback redirects for non-local clients
        boolean isLoopback = redirectUri.contains("localhost") || redirectUri.contains("127.0.0.1") || redirectUri.contains("[::1]");
        if (isLoopback) {
            throw new AppException("Localhost redirect URIs are not permitted for external OAuth clients in production.", HttpStatus.BAD_REQUEST);
        }

        // Standard dynamic external clients (e.g. ChatGPT, Claude) and native mobile app (placeprep://)
        if (redirectUri.startsWith("https://") || redirectUri.startsWith("placeprep://")) {
            return;
        }

        throw new AppException("Invalid OAuth client or redirect URI. HTTPS redirect URI required.", HttpStatus.BAD_REQUEST);
    }

    public List<String> parseScopes(String scopeParam) {
        if (scopeParam == null || scopeParam.isBlank()) {
            return DEFAULT_SCOPES;
        }
        String[] parts = scopeParam.trim().split("\\s+");
        List<String> res = new ArrayList<>();
        for (String p : parts) {
            if (!SUPPORTED_SCOPES.contains(p)) {
                throw new AppException("Requested scope \"" + p + "\" is invalid.", HttpStatus.BAD_REQUEST);
            }
            res.add(p);
        }
        return res.isEmpty() ? DEFAULT_SCOPES : res;
    }

    public OAuthRepository.Transaction begin(
            HttpServletRequest req,
            String responseType,
            String clientId,
            String redirectUri,
            String state,
            String codeChallenge,
            String codeChallengeMethod,
            String resource
    ) {
        if (!"code".equals(responseType)) {
            throw new AppException("Unsupported response_type. Must be \"code\".", HttpStatus.BAD_REQUEST);
        }
        if (clientId == null || redirectUri == null || state == null) {
            throw new AppException("Missing required OAuth parameter: client_id, redirect_uri, or state.", HttpStatus.BAD_REQUEST);
        }

        validateClient(clientId, redirectUri);

        if (codeChallenge == null || !PKCE_CHALLENGE_PATTERN.matcher(codeChallenge).matches() || !"S256".equals(codeChallengeMethod)) {
            throw new AppException("PKCE code_challenge with method S256 is required.", HttpStatus.BAD_REQUEST);
        }

        String expectedResource = getResource(req);
        if (resource != null && !resource.replaceAll("/$", "").equals(expectedResource)) {
            throw new AppException("Requested resource \"" + resource + "\" does not match server resource \"" + expectedResource + "\".", HttpStatus.BAD_REQUEST);
        }

        UUID id = UUID.randomUUID();
        List<String> scopes = parseScopes(req.getParameter("scope"));
        Instant expiresAt = Instant.now().plusMillis(TX_TTL_MS);

        oAuthRepository.insertTransaction(
                id, clientId, redirectUri, scopes, expectedResource, codeChallenge, state, expiresAt
        );

        return oAuthRepository.findTransactionById(id).orElseThrow();
    }

    public OAuthRepository.Transaction getTransaction(UUID id) {
        OAuthRepository.Transaction tx = oAuthRepository.findTransactionById(id)
                .orElseThrow(() -> new AppException("Authorization transaction has expired or is invalid.", HttpStatus.BAD_REQUEST));

        if (tx.expiresAt.isBefore(Instant.now())) {
            throw new AppException("Authorization transaction has expired or is invalid.", HttpStatus.BAD_REQUEST);
        }
        return tx;
    }

    public void authenticateTransaction(UUID txId, UUID userId) {
        boolean ok = oAuthRepository.authenticateTransaction(txId, userId);
        if (!ok) {
            throw new AppException("Authorization transaction is expired or in an invalid state.", HttpStatus.BAD_REQUEST);
        }
    }

    public Map<String, String> approve(UUID txId, UUID userId, boolean approved) {
        OAuthRepository.Transaction tx = getTransaction(txId);

        if (!approved) {
            oAuthRepository.updateTransactionStatus(txId, "rejected");
            return Map.of("rejected", "true", "redirectUri", tx.redirectUri, "state", tx.externalState);
        }

        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        UUID codeId = UUID.randomUUID();
        Instant codeExpiresAt = Instant.now().plusMillis(CODE_TTL_MS);

        oAuthRepository.insertAuthCode(
                codeId, txId, sha256Hex(code), userId, tx.clientId, tx.redirectUri, tx.resource, tx.scopes, tx.codeChallenge, codeExpiresAt
        );

        oAuthRepository.updateTransactionStatus(txId, "code_issued");

        return Map.of("code", code, "redirectUri", tx.redirectUri, "state", tx.externalState);
    }

    public Map<String, Object> exchange(
            HttpServletRequest req,
            String grantType,
            String code,
            String clientId,
            String redirectUri,
            String codeVerifier,
            String resource
    ) {
        if (!"authorization_code".equals(grantType)) {
            throw new AppException("Unsupported grant_type. Must be \"authorization_code\".", HttpStatus.BAD_REQUEST);
        }
        if (code == null || clientId == null || redirectUri == null || codeVerifier == null) {
            throw new AppException("Token request is missing required parameters (code, client_id, redirect_uri, code_verifier).", HttpStatus.BAD_REQUEST);
        }

        validateClient(clientId, redirectUri);

        String verifierHash = sha256Base64Url(codeVerifier);

        OAuthRepository.AuthCode authCode = oAuthRepository.findAuthCodeByHash(sha256Hex(code))
                .orElseThrow(() -> new AppException("Authorization code is invalid.", HttpStatus.BAD_REQUEST));

        if (authCode.usedAt != null) {
            throw new AppException("Authorization code has already been used.", HttpStatus.BAD_REQUEST);
        }
        if (authCode.expiresAt.isBefore(Instant.now())) {
            throw new AppException("Authorization code has expired.", HttpStatus.BAD_REQUEST);
        }
        if (!clientId.equals(authCode.clientId) || !redirectUri.equals(authCode.redirectUri)) {
            throw new AppException("Client ID or redirect URI does not match authorization code.", HttpStatus.BAD_REQUEST);
        }
        if (resource != null && !resource.replaceAll("/$", "").equals(authCode.resource)) {
            throw new AppException("Target resource does not match authorized resource.", HttpStatus.BAD_REQUEST);
        }

        if (!authCode.codeChallenge.equals(verifierHash)) {
            throw new AppException("PKCE verification failed: invalid code_verifier.", HttpStatus.BAD_REQUEST);
        }

        // Mark code used
        oAuthRepository.markAuthCodeUsed(authCode.id);

        UUID tokenId = UUID.randomUUID();
        Instant expiresAt = Instant.now().plusMillis(TOKEN_TTL_MS);
        String issuer = getIssuer(req);
        String scopeStr = String.join(" ", authCode.scopes);

        String accessToken = oAuthKeyProvider.signToken(
                issuer,
                authCode.userId.toString(),
                authCode.resource,
                authCode.clientId,
                scopeStr,
                tokenId.toString(),
                TOKEN_TTL_MS
        );

        oAuthRepository.insertAccessToken(
                tokenId,
                sha256Hex(accessToken),
                authCode.userId,
                authCode.clientId,
                authCode.resource,
                authCode.scopes,
                expiresAt
        );

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("access_token", accessToken);
        resp.put("token_type", "Bearer");
        resp.put("expires_in", TOKEN_TTL_MS / 1000);
        resp.put("scope", scopeStr);

        return resp;
    }

    public static class OAuthPrincipal {
        public UUID userId;
        public String clientId;
        public List<String> scopes;
        public String resource;
        public UUID tokenId;
    }

    public OAuthPrincipal resolvePrincipal(String token, String expectedResource) {
        if (token == null || token.isBlank()) return null;

        try {
            Claims claims = oAuthKeyProvider.verifyToken(token);

            // Audience check
            Set<String> audiences = claims.getAudience();
            boolean audMatch = audiences != null && audiences.stream()
                    .anyMatch(a -> a.replaceAll("/$", "").equals(expectedResource.replaceAll("/$", "")));
            if (!audMatch) {
                return null;
            }

            UUID tokenId = claims.getId() != null ? UUID.fromString(claims.getId()) : null;
            String tokenHash = sha256Hex(token);

            Optional<OAuthRepository.AccessToken> stored = oAuthRepository.findAccessToken(tokenId, tokenHash);
            if (stored.isEmpty()) return null;

            OAuthRepository.AccessToken row = stored.get();
            OAuthPrincipal p = new OAuthPrincipal();
            p.userId = row.userId;
            p.clientId = row.clientId;
            p.scopes = row.scopes;
            p.resource = row.resource;
            p.tokenId = row.id;

            return p;
        } catch (Exception e) {
            return null;
        }
    }

    public void revoke(String token) {
        if (token == null || token.isBlank()) return;
        try {
            String tokenHash = sha256Hex(token);
            UUID tokenId = null;
            try {
                Claims claims = oAuthKeyProvider.verifyToken(token);
                if (claims.getId() != null) tokenId = UUID.fromString(claims.getId());
            } catch (Exception ignored) {}

            oAuthRepository.revokeAccessToken(tokenId, tokenHash);
        } catch (Exception ignored) {}
    }
}
