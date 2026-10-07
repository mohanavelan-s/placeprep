package com.placeprep.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.*;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.time.Instant;
import java.util.*;

@Component
public class OAuthKeyProvider {

    private static final Logger log = LoggerFactory.getLogger(OAuthKeyProvider.class);

    private final String keyId;
    private final KeyPair keyPair;
    private final Map<String, Object> jwk;

    public OAuthKeyProvider(
            @Value("${placeprep.oauth.key-id:placeprep-oauth-key-1}") String keyId,
            @Value("${placeprep.oauth.private-key-pem:${OAUTH_PRIVATE_KEY_PEM:}}") String privateKeyPem
    ) {
        this.keyId = keyId;
        try {
            if (privateKeyPem != null && !privateKeyPem.isBlank()) {
                this.keyPair = parsePrivateKeyPem(privateKeyPem);
                log.info("Loaded persistent RSA private key for OAuth from configuration (kid: {})", keyId);
            } else {
                KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
                kpg.initialize(2048);
                this.keyPair = kpg.generateKeyPair();
                log.info("No OAUTH_PRIVATE_KEY_PEM provided. Generated ephemeral in-memory RSA keypair for OAuth (kid: {})", keyId);
            }

            RSAPublicKey rsaPub = (RSAPublicKey) keyPair.getPublic();
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

    private static KeyPair parsePrivateKeyPem(String pem) throws Exception {
        String cleaned = pem
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replace("-----BEGIN RSA PRIVATE KEY-----", "")
                .replace("-----END RSA PRIVATE KEY-----", "")
                .replaceAll("\\s+", "");

        byte[] encoded = Base64.getDecoder().decode(cleaned);
        KeyFactory kf = KeyFactory.getInstance("RSA");
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
