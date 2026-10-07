package com.placeprep;

import com.placeprep.model.User;
import com.placeprep.repository.OAuthRepository;
import com.placeprep.repository.UserRepository;
import com.placeprep.security.OAuthKeyProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class McpToolsExecutionTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OAuthRepository oAuthRepository;

    @Autowired
    private OAuthKeyProvider oAuthKeyProvider;

    private User testUser;
    private String validToken;

    @BeforeEach
    void setup() throws Exception {
        testUser = userRepository.findByEmail("mcp_test_student@example.com").orElseGet(() -> {
            User u = new User();
            u.setName("MCP Student");
            u.setEmail("mcp_test_student@example.com");
            u.setUsername("mcp_student_" + UUID.randomUUID().toString().substring(0, 8));
            u.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz123456");
            u.setRole("user");
            u.setTier("free");
            u.setTargetRole("Backend Engineer");
            return userRepository.createUser(u);
        });

        UUID tokenId = UUID.randomUUID();
        String issuer = "http://localhost:5000";
        String resource = "http://localhost:5000/mcp";
        String clientId = "test-ai-client";
        String scope = "placeprep.profile.read placeprep.tasks.read placeprep.tasks.write placeprep.progress.read";

        validToken = oAuthKeyProvider.signToken(
                issuer,
                testUser.getId().toString(),
                resource,
                clientId,
                scope,
                tokenId.toString(),
                3600000L
        );

        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] hash = md.digest(validToken.getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder();
        for (byte b : hash) {
            hex.append(String.format("%02x", b));
        }

        oAuthRepository.insertAccessToken(
                tokenId,
                hex.toString(),
                testUser.getId(),
                clientId,
                resource,
                List.of("placeprep.profile.read", "placeprep.tasks.read", "placeprep.tasks.write", "placeprep.progress.read"),
                Instant.now().plusSeconds(3600)
        );
    }

    @Test
    void testInitializeReturnsServerInfoWithLogo() throws Exception {
        String mcpBody = """
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize"
            }
        """;

        mockMvc.perform(post("/mcp")
                .header("Authorization", "Bearer " + validToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mcpBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.protocolVersion").value("2024-11-05"))
                .andExpect(jsonPath("$.result.serverInfo.name").value("PlacePrep MCP"))
                .andExpect(jsonPath("$.result.serverInfo.icon").value(containsString("/logo.png")))
                .andExpect(jsonPath("$.result.capabilities.tools").exists());
    }

    @Test
    void testToolsListReturnsAllDomainTools() throws Exception {
        String mcpBody = """
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list"
            }
        """;

        mockMvc.perform(post("/mcp")
                .header("Authorization", "Bearer " + validToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mcpBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.tools", hasSize(7)))
                .andExpect(jsonPath("$.result.tools[*].name", hasItems(
                        "get_profile",
                        "get_progress_summary",
                        "get_tasks",
                        "get_task",
                        "create_task",
                        "update_task_status",
                        "delete_task"
                )));
    }

    @Test
    void testToolCallGetProfileExecutes() throws Exception {
        String mcpBody = """
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "get_profile",
                    "arguments": {}
                }
            }
        """;

        mockMvc.perform(post("/mcp")
                .header("Authorization", "Bearer " + validToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(mcpBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.isError").value(false))
                .andExpect(jsonPath("$.result.content[0].type").value("text"))
                .andExpect(jsonPath("$.result.content[0].text").value(containsString("MCP Student")))
                .andExpect(jsonPath("$.result.content[0].text").value(containsString("Backend Engineer")));
    }

    @Test
    void testToolCallCreateTaskAndList() throws Exception {
        String createBody = """
            {
                "jsonrpc": "2.0",
                "id": 4,
                "method": "tools/call",
                "params": {
                    "name": "create_task",
                    "arguments": {
                        "title": "Practice Dynamic Programming LCS",
                        "category": "DSA",
                        "difficulty": 4,
                        "estimatedMinutes": 45,
                        "priority": "high"
                    }
                }
            }
        """;

        mockMvc.perform(post("/mcp")
                .header("Authorization", "Bearer " + validToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(createBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.isError").value(false))
                .andExpect(jsonPath("$.result.content[0].text").value(containsString("Practice Dynamic Programming LCS")));

        String listBody = """
            {
                "jsonrpc": "2.0",
                "id": 5,
                "method": "tools/call",
                "params": {
                    "name": "get_tasks",
                    "arguments": {
                        "category": "DSA"
                    }
                }
            }
        """;

        mockMvc.perform(post("/mcp")
                .header("Authorization", "Bearer " + validToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(listBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.isError").value(false))
                .andExpect(jsonPath("$.result.content[0].text").value(containsString("Practice Dynamic Programming LCS")));
    }
}
