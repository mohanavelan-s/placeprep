package com.placeprep;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class OAuthDiscoveryTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void testProtectedResourceDiscovery() throws Exception {
        mockMvc.perform(get("/.well-known/oauth-protected-resource"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resource").exists())
                .andExpect(jsonPath("$.authorization_servers").isArray())
                .andExpect(jsonPath("$.bearer_methods_supported[0]").value("header"))
                .andExpect(jsonPath("$.scopes_supported").isArray());
    }

    @Test
    void testProtectedResourceMcpDiscovery() throws Exception {
        mockMvc.perform(get("/.well-known/oauth-protected-resource/mcp"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resource").exists())
                .andExpect(jsonPath("$.authorization_servers").isArray());
    }

    @Test
    void testAuthorizationServerDiscovery() throws Exception {
        mockMvc.perform(get("/.well-known/oauth-authorization-server"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.issuer").exists())
                .andExpect(jsonPath("$.authorization_endpoint").exists())
                .andExpect(jsonPath("$.token_endpoint").exists())
                .andExpect(jsonPath("$.jwks_uri").exists())
                .andExpect(jsonPath("$.code_challenge_methods_supported[0]").value("S256"));
    }

    @Test
    void testOpenIdConfigurationDiscovery() throws Exception {
        mockMvc.perform(get("/.well-known/openid-configuration"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.issuer").exists())
                .andExpect(jsonPath("$.authorization_endpoint").exists());
    }

    @Test
    void testJwksEndpoint() throws Exception {
        mockMvc.perform(get("/oauth/jwks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keys").isArray())
                .andExpect(jsonPath("$.keys[0].kty").value("RSA"))
                .andExpect(jsonPath("$.keys[0].alg").value("RS256"))
                .andExpect(jsonPath("$.keys[0].use").value("sig"));
    }

    @Test
    void testWellKnownJwksEndpoint() throws Exception {
        mockMvc.perform(get("/.well-known/jwks.json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keys").isArray())
                .andExpect(jsonPath("$.keys[0].kty").value("RSA"));
    }

    @Test
    void testPersistentRsaKeyGenerationAndSigning() throws Exception {
        java.security.KeyPairGenerator kpg = java.security.KeyPairGenerator.getInstance("RSA");
        kpg.initialize(2048);
        java.security.KeyPair kp = kpg.generateKeyPair();
        String pem = com.placeprep.security.OAuthKeyProvider.formatPkcs8Pem(kp.getPrivate());

        com.placeprep.security.OAuthKeyProvider provider = new com.placeprep.security.OAuthKeyProvider(
                "test-persistent-key",
                pem,
                null
        );

        org.junit.jupiter.api.Assertions.assertTrue(provider.isPersistent());
        org.junit.jupiter.api.Assertions.assertEquals("test-persistent-key", provider.getKeyId());
        org.junit.jupiter.api.Assertions.assertNotNull(provider.getJwks().get("keys"));

        String token = provider.signToken("https://placeprep.test", "user-123", "mcp", "client-1", "mcp:read", "tok-1", 60000);
        io.jsonwebtoken.Claims claims = provider.verifyToken(token);
        org.junit.jupiter.api.Assertions.assertEquals("user-123", claims.getSubject());
        org.junit.jupiter.api.Assertions.assertEquals("client-1", claims.get("client_id"));
    }
}
