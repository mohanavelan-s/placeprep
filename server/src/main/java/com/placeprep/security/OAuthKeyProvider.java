package com.placeprep.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.*;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPrivateCrtKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.time.Instant;
import java.util.*;

@Component
public class OAuthKeyProvider {

    private static final Logger log = LoggerFactory.getLogger(OAuthKeyProvider.class);

    private final String keyId;
    private final KeyPair keyPair;
    private final Map<String, Object> jwk;
    private final boolean persistent;
    private final String keySource;

    public OAuthKeyProvider(
            @Value("${placeprep.oauth.key-id:placeprep-oauth-key-1}") String keyId,
            @Value("${placeprep.oauth.private-key-pem:${OAUTH_PRIVATE_KEY_PEM:}}") String privateKeyPem,
            @Value("${placeprep.oauth.key-file:${OAUTH_PRIVATE_KEY_FILE:./data/oauth_private_key.pem}}") String keyFilePath
    ) {
        this.keyId = keyId;
        KeyPair resolvedPair = null;
        boolean isKeyPersistent = false;
        String source = "ephemeral";

        try {
            // 1. Check environment variable / configured property PEM string
            if (privateKeyPem != null && !privateKeyPem.isBlank()) {
                resolvedPair = parsePrivateKeyPem(privateKeyPem);
                isKeyPersistent = true;
                source = "configuration_pem";
                log.info("Loaded persistent RSA private key for OAuth from configuration (kid: {}, bits: {})",
                        keyId, ((RSAPublicKey) resolvedPair.getPublic()).getModulus().bitLength());
            }

            // 2. Check explicitly configured or default key file path
            if (resolvedPair == null && keyFilePath != null && !keyFilePath.isBlank()) {
                Path filePath = Paths.get(keyFilePath);
                if (Files.exists(filePath) && Files.isReadable(filePath)) {
                    String fileContent = Files.readString(filePath);
                    if (!fileContent.isBlank()) {
                        resolvedPair = parsePrivateKeyPem(fileContent);
                        isKeyPersistent = true;
                        source = "file:" + keyFilePath;
                        log.info("Loaded persistent RSA private key for OAuth from file '{}' (kid: {})", keyFilePath, keyId);
                    }
                }
            }

            // 3. Fallback: Generate fresh RSA keypair and attempt to persist to keyFilePath
            if (resolvedPair == null) {
                KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
                kpg.initialize(2048);
                resolvedPair = kpg.generateKeyPair();

                boolean saved = false;
                if (keyFilePath != null && !keyFilePath.isBlank()) {
                    try {
                        Path filePath = Paths.get(keyFilePath);
                        if (filePath.getParent() != null) {
                            Files.createDirectories(filePath.getParent());
                        }
                        String pemString = formatPkcs8Pem(resolvedPair.getPrivate());
                        Files.writeString(filePath, pemString);
                        saved = true;
                        isKeyPersistent = true;
                        source = "generated_persisted:" + keyFilePath;
                        log.info("Generated new 2048-bit RSA keypair and persisted to '{}' for stable restarts (kid: {})", keyFilePath, keyId);
                    } catch (Exception fileEx) {
                        log.warn("Could not persist generated OAuth RSA key to '{}': {}. Key will remain in-memory for this instance.",
                                keyFilePath, fileEx.getMessage());
                    }
                }

                if (!saved) {
                    isKeyPersistent = false;
                    source = "ephemeral_in_memory";
                    log.warn("No persistent OAuth key configuration found and file save failed. Running with ephemeral in-memory RSA keypair (kid: {}).", keyId);
                }
            }

            this.keyPair = resolvedPair;
            this.persistent = isKeyPersistent;
            this.keySource = source;

            RSAPublicKey rsaPub = (RSAPublicKey) this.keyPair.getPublic();
            if (rsaPub.getModulus().bitLength() < 2048) {
                throw new IllegalStateException("RSA key modulus must be at least 2048 bits for OAuth signing.");
            }

            String n = Base64.getUrlEncoder().withoutPadding().encodeToString(rsaPub.getModulus().toByteArray());
            String e = Base64.getUrlEncoder().withoutPadding().encodeToString(rsaPub.getPublicExponent().toByteArray());

            this.jwk = Map.of(
                    "kty", "RSA",
                    "use", "sig",
                    "alg", "RS256",
                    "kid", keyId,
                    "n", n,
                    "e", e
            );
        } catch (Exception ex) {
            throw new RuntimeException("Failed to initialize RSA keypair for OAuth", ex);
        }
    }

    public static KeyPair parsePrivateKeyPem(String pem) throws Exception {
        if (pem == null || pem.isBlank()) {
            throw new IllegalArgumentException("Private key PEM string cannot be null or empty.");
        }

        // Normalize raw string (handle escaped newlines if passed through environment variables)
        String normalized = pem.replace("\\n", "\n").trim();

        boolean isPkcs1 = normalized.contains("BEGIN RSA PRIVATE KEY");

        String cleaned = normalized
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replace("-----BEGIN RSA PRIVATE KEY-----", "")
                .replace("-----END RSA PRIVATE KEY-----", "")
                .replaceAll("\\s+", "");

        byte[] encoded = Base64.getDecoder().decode(cleaned);
        KeyFactory kf = KeyFactory.getInstance("RSA");

        if (isPkcs1) {
            try {
                org.bouncycastle.asn1.pkcs.RSAPrivateKey rsaPriv = org.bouncycastle.asn1.pkcs.RSAPrivateKey.getInstance(encoded);
                RSAPrivateCrtKeySpec privSpec = new RSAPrivateCrtKeySpec(
                        rsaPriv.getModulus(),
                        rsaPriv.getPublicExponent(),
                        rsaPriv.getPrivateExponent(),
                        rsaPriv.getPrime1(),
                        rsaPriv.getPrime2(),
                        rsaPriv.getExponent1(),
                        rsaPriv.getExponent2(),
                        rsaPriv.getCoefficient()
                );
                PrivateKey privateKey = kf.generatePrivate(privSpec);
                PublicKey publicKey = kf.generatePublic(new RSAPublicKeySpec(rsaPriv.getModulus(), rsaPriv.getPublicExponent()));
                return new KeyPair(publicKey, privateKey);
            } catch (Exception ex) {
                log.warn("PKCS#1 parse via BouncyCastle failed ({}), trying PKCS#8 fallback.", ex.getMessage());
            }
        }

        PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(encoded);
        PrivateKey privateKey = kf.generatePrivate(keySpec);

        if (privateKey instanceof RSAPrivateCrtKey crt) {
            RSAPublicKeySpec pubSpec = new RSAPublicKeySpec(crt.getModulus(), crt.getPublicExponent());
            PublicKey publicKey = kf.generatePublic(pubSpec);
            return new KeyPair(publicKey, privateKey);
        } else {
            throw new IllegalArgumentException("Private key must be an RSA CRT private key to derive public key.");
        }
    }

    public static String formatPkcs8Pem(PrivateKey privateKey) {
        String base64 = Base64.getMimeEncoder(64, new byte[]{'\n'}).encodeToString(privateKey.getEncoded());
        return "-----BEGIN PRIVATE KEY-----\n" + base64 + "\n-----END PRIVATE KEY-----\n";
    }

    public boolean isPersistent() {
        return persistent;
    }

    public String getKeySource() {
        return keySource;
    }

    public String getKeyId() {
        return keyId;
    }

    public Map<String, Object> getJwks() {
        return Map.of("keys", List.of(jwk));
    }

    public String signToken(String issuer, String subject, String audience, String clientId, String scopes, String tokenId, long ttlMillis) {
        Instant now = Instant.now();
        Instant exp = now.plusMillis(ttlMillis);

        return Jwts.builder()
                .issuer(issuer)
                .subject(subject)
                .audience().add(audience).and()
                .id(tokenId)
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .claim("client_id", clientId)
                .claim("scope", scopes)
                .header().keyId(keyId).and()
                .signWith(keyPair.getPrivate(), Jwts.SIG.RS256)
                .compact();
    }

    public Claims verifyToken(String token) {
        return Jwts.parser()
                .verifyWith(keyPair.getPublic())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
