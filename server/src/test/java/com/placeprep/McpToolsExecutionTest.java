package com.placeprep;

import com.placeprep.model.Task;
import com.placeprep.model.User;
import com.placeprep.repository.OAuthRepository;
import com.placeprep.repository.TaskRepository;
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
import java.time.LocalDate;
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

    @Autowired
    private TaskRepository taskRepository;

    private User testUser;
    private User otherUser;
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

        otherUser = userRepository.findByEmail("other_student@example.com").orElseGet(() -> {
            User u = new User();
            u.setName("Other Student");
            u.setEmail("other_student@example.com");
            u.setUsername("other_stud_" + UUID.randomUUID().toString().substring(0, 8));
            u.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz123456");
            u.setRole("user");
            u.setTier("free");
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
                .andExpect(jsonPath("$.result.tools", hasSize(19)))
                .andExpect(jsonPath("$.result.tools[*].name", hasItems(
                        "get_profile",
                        "get_progress_summary",
                        "get_tasks",
                        "get_task",
                        "search_tasks",
                        "create_task",
                        "update_task_status",
                        "update_task",
                        "delete_task",
                        "bulk_delete_tasks",
                        "bulk_complete_tasks",
                        "bulk_update_tasks",
                        "get_prep_plan",
                        "list_prep_plans",
                        "get_daily_log",
                        "log_daily_reflection",
                        "get_notification_preferences",
                        "update_notification_preferences",
                        "send_test_notification"
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

    @Test
    void testBulkDeleteTasksHandlesExistingAndMissingIdempotently() throws Exception {
        // Create 2 tasks for testUser
        Task t1 = new Task();
        t1.setUserId(testUser.getId());
        t1.setTitle("Task to delete 1");
        t1.setScheduledFor(LocalDate.now());
        Task created1 = taskRepository.createTask(t1);

        Task t2 = new Task();
        t2.setUserId(testUser.getId());
        t2.setTitle("Task to delete 2");
        t2.setScheduledFor(LocalDate.now());
        Task created2 = taskRepository.createTask(t2);

        // Create 1 task for otherUser to verify unauthorized check
        Task otherT = new Task();
        otherT.setUserId(otherUser.getId());
        otherT.setTitle("Other user private task");
        otherT.setScheduledFor(LocalDate.now());
        Task otherCreated = taskRepository.createTask(otherT);

        UUID nonExistentId = UUID.randomUUID();

        String bulkDeleteBody = String.format("""
            {
                "jsonrpc": "2.0",
                "id": 6,
                "method": "tools/call",
                "params": {
                    "name": "bulk_delete_tasks",
                    "arguments": {
                        "taskIds": ["%s", "%s", "%s", "%s"]
                    }
                }
            }
        """, created1.getId(), created2.getId(), nonExistentId, otherCreated.getId());

        mockMvc.perform(post("/mcp")
                .header("Authorization", "Bearer " + validToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(bulkDeleteBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.isError").value(false))
                .andExpect(jsonPath("$.result.content[0].text").value(containsString("\"requestedCount\" : 4")))
                .andExpect(jsonPath("$.result.content[0].text").value(containsString("\"deletedCount\" : 2")))
                .andExpect(jsonPath("$.result.content[0].text").value(containsString("\"alreadyMissingCount\" : 1")))
                .andExpect(jsonPath("$.result.content[0].text").value(containsString("\"unauthorizedCount\" : 1")));

        // Verify otherUser's task was NOT deleted
        assert(taskRepository.findByUserAndId(otherUser.getId(), otherCreated.getId()).isPresent());
    }

    @Test
    void testSearchTasksAndBulkCompleteTasks() throws Exception {
        String uniqueMarker = "Marker_" + UUID.randomUUID().toString().substring(0, 6);
        Task t = new Task();
        t.setUserId(testUser.getId());
        t.setTitle("Complete Graph Search " + uniqueMarker);
        t.setDescription("Dijkstra and A* algorithm study");
        t.setCategory("DSA");
        t.setStatus("pending");
        t.setScheduledFor(LocalDate.now());
        Task created = taskRepository.createTask(t);

        // Search tool call
        String searchBody = String.format("""
            {
                "jsonrpc": "2.0",
                "id": 7,
                "method": "tools/call",
                "params": {
                    "name": "search_tasks",
                    "arguments": {
                        "query": "%s"
                    }
                }
            }
        """, uniqueMarker);

        mockMvc.perform(post("/mcp")
                .header("Authorization", "Bearer " + validToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(searchBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.isError").value(false))
                .andExpect(jsonPath("$.result.content[0].text").value(containsString(uniqueMarker)));

        // Bulk complete tool call
        String completeBody = String.format("""
            {
                "jsonrpc": "2.0",
                "id": 8,
                "method": "tools/call",
                "params": {
                    "name": "bulk_complete_tasks",
                    "arguments": {
                        "taskIds": ["%s"]
                    }
                }
            }
        """, created.getId());

        mockMvc.perform(post("/mcp")
                .header("Authorization", "Bearer " + validToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(completeBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.isError").value(false))
                .andExpect(jsonPath("$.result.content[0].text").value(containsString("Completed 1 task(s) successfully")));
    }

    @Test
    void testNotificationPreferencesAndDailyReflectionTools() throws Exception {
        // Notification preferences
        String notifBody = """
            {
                "jsonrpc": "2.0",
                "id": 9,
                "method": "tools/call",
                "params": {
                    "name": "get_notification_preferences",
                    "arguments": {}
                }
            }
        """;

        mockMvc.perform(post("/mcp")
                .header("Authorization", "Bearer " + validToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(notifBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.isError").value(false))
                .andExpect(jsonPath("$.result.content[0].text").value(containsString("notificationsEnabled")));

        // Daily reflection tool
        String logBody = """
            {
                "jsonrpc": "2.0",
                "id": 10,
                "method": "tools/call",
                "params": {
                    "name": "log_daily_reflection",
                    "arguments": {
                        "hoursStudied": 3.5,
                        "focusMinutes": 180,
                        "wins": "Mastered Tree traversals and DP knapsack",
                        "energy": 4,
                        "mood": 5
                    }
                }
            }
        """;

        mockMvc.perform(post("/mcp")
                .header("Authorization", "Bearer " + validToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(logBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.isError").value(false))
                .andExpect(jsonPath("$.result.content[0].text").value(containsString("Daily reflection saved successfully")));
    }
}
