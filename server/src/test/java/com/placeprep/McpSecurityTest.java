package com.placeprep;

import com.placeprep.security.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class McpSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void testRejectsUnauthenticatedMcpRequestWithChallenge() throws Exception {
        String mcpBody = """
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "test-client", "version": "1.0.0"}
                }
            }
        """;

        mockMvc.perform(post("/mcp")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mcpBody))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("WWW-Authenticate", containsString("Bearer")))
                .andExpect(header().string("WWW-Authenticate", containsString("resource_metadata=")))
                .andExpect(jsonPath("$.jsonrpc").value("2.0"))
                .andExpect(jsonPath("$.error.code").value(-32001));
    }

    @Test
    void testRejectsInvalidTokenWithInvalidTokenError() throws Exception {
        String mcpBody = """
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "initialize"
            }
        """;

        mockMvc.perform(post("/mcp")
                .header("Authorization", "Bearer invalid.opaque.or.tampered.token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(mcpBody))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("WWW-Authenticate", containsString("error=\"invalid_token\"")))
                .andExpect(jsonPath("$.error.code").value(-32001));
    }

    @Test
    void testRejectsInternalPlacePrepHS256JwtAtMcp() throws Exception {
        // PlacePrep internal login JWT uses HS256 symmetric signing
        com.placeprep.model.User user = new com.placeprep.model.User();
        user.setId(UUID.randomUUID());
        user.setEmail("test@placeprep.com");
        user.setRole("user");
        String internalToken = jwtTokenProvider.generateToken(user);

        String mcpBody = """
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "initialize"
            }
        """;

        mockMvc.perform(post("/mcp")
                .header("Authorization", "Bearer " + internalToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mcpBody))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("WWW-Authenticate", containsString("error=\"invalid_token\"")))
                .andExpect(jsonPath("$.error.code").value(-32001));
    }
}
