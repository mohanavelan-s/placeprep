package com.placeprep;

import com.placeprep.model.User;
import com.placeprep.repository.UserRepository;
import com.placeprep.security.JwtTokenProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class CoachControllerSecurityTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User adminUser;
    private User regularUser;
    private String adminToken;
    private String userToken;
    private final List<UUID> createdUserIds = new ArrayList<>();

    @BeforeEach
    void setup() throws SQLException {
        assertSafeActiveConnection(jdbcTemplate.getDataSource());

        adminUser = createSyntheticUser("Coach Admin", "coach_sec_admin@placeprep.test", "admin");
        regularUser = createSyntheticUser("Coach Student", "coach_sec_student@placeprep.test", "user");

        adminToken = jwtTokenProvider.generateToken(adminUser);
        userToken = jwtTokenProvider.generateToken(regularUser);
    }

    @AfterEach
    void tearDown() {
        for (UUID uid : createdUserIds) {
            try {
                jdbcTemplate.update("UPDATE invites SET created_by = NULL WHERE created_by = ?", uid);
                jdbcTemplate.update("UPDATE invites SET used_by = NULL WHERE used_by = ?", uid);
                jdbcTemplate.update("UPDATE coach_groups SET created_by = NULL WHERE created_by = ?", uid);
                jdbcTemplate.update("UPDATE coach_group_members SET added_by = NULL WHERE added_by = ?", uid);
                jdbcTemplate.update("DELETE FROM coach_group_members WHERE user_id = ?", uid);
                jdbcTemplate.update("DELETE FROM tasks WHERE user_id = ?", uid);
                jdbcTemplate.update("DELETE FROM prep_plans WHERE user_id = ?", uid);
                jdbcTemplate.update("DELETE FROM coding_submissions WHERE user_id = ?", uid);
                jdbcTemplate.update("DELETE FROM assessment_sessions WHERE user_id = ?", uid);
                jdbcTemplate.update("DELETE FROM progress_stats WHERE user_id = ?", uid);
                jdbcTemplate.update("DELETE FROM user_profiles WHERE user_id = ?", uid);
                jdbcTemplate.update("DELETE FROM notifications WHERE user_id = ?", uid);
                jdbcTemplate.update("DELETE FROM users WHERE id = ?", uid);
            } catch (Exception ignored) {}
        }
        createdUserIds.clear();
    }

    private User createSyntheticUser(String name, String email, String role) {
        jdbcTemplate.update("DELETE FROM users WHERE email = ?", email);
        User u = new User();
        u.setName(name);
        u.setUsername(email.split("@")[0]);
        u.setEmail(email);
        u.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz1234567890");
        u.setRole(role);
        User created = userRepository.createUser(u);
        createdUserIds.add(created.getId());
        return created;
    }

    @Test
    @DisplayName("Security: Regular USER role is strictly forbidden (HTTP 403) from all CoachController endpoints")
    void testRegularUserForbiddenFromAllCoachEndpoints() throws Exception {
        UUID sampleId = UUID.randomUUID();

        // 1. GET /api/coach/students
        mockMvc.perform(get("/api/coach/students")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());

        // 2. GET /api/coach/groups
        mockMvc.perform(get("/api/coach/groups")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());

        // 3. GET /api/coach/group-candidates
        mockMvc.perform(get("/api/coach/group-candidates")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());

        // 4. POST /api/coach/groups
        mockMvc.perform(post("/api/coach/groups")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Unauthorized Group\"}"))
                .andExpect(status().isForbidden());

        // 5. POST /api/coach/groups/{groupId}/members
        mockMvc.perform(post("/api/coach/groups/" + sampleId + "/members")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"studentUserIds\":[\"" + sampleId + "\"]}"))
                .andExpect(status().isForbidden());

        // 6. DELETE /api/coach/groups/{groupId}/members/{studentUserId}
        mockMvc.perform(delete("/api/coach/groups/" + sampleId + "/members/" + sampleId)
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());

        // 7. POST /api/coach/practice-capsules
        mockMvc.perform(post("/api/coach/practice-capsules")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Unauthorized Capsule\"}"))
                .andExpect(status().isForbidden());

        // 8. DELETE /api/coach/students/{studentUserId}/proofs
        mockMvc.perform(delete("/api/coach/students/" + sampleId + "/proofs")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());

        // 9. DELETE /api/coach/progress/history
        mockMvc.perform(delete("/api/coach/progress/history")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"studentUserId\":\"" + sampleId + "\"}"))
                .andExpect(status().isForbidden());

        // 10. DELETE /api/coach/practice-capsules/history
        mockMvc.perform(delete("/api/coach/practice-capsules/history")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assignmentIds\":[\"" + sampleId + "\"]}"))
                .andExpect(status().isForbidden());

        // 11. DELETE /api/coach/students/{studentUserId}
        mockMvc.perform(delete("/api/coach/students/" + sampleId)
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());

        // 12. DELETE /api/coach/students
        mockMvc.perform(delete("/api/coach/students")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"studentUserIds\":[\"" + sampleId + "\"]}"))
                .andExpect(status().isForbidden());

        // 13. DELETE /api/coach/groups/{groupId}
        mockMvc.perform(delete("/api/coach/groups/" + sampleId)
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security: Unauthenticated request to coach endpoints is rejected (HTTP 401 or 403)")
    void testUnauthenticatedRequestRejected() throws Exception {
        mockMvc.perform(get("/api/coach/students"))
                .andExpect(result -> {
                    int sc = result.getResponse().getStatus();
                    org.junit.jupiter.api.Assertions.assertTrue(sc == 401 || sc == 403,
                            "Expected 401 or 403 for unauthenticated request, got: " + sc);
                });
    }

    @Test
    @DisplayName("Security: ADMIN role can successfully invoke authorized CoachController operations")
    void testAdminRoleCanInvokeCoachEndpoints() throws Exception {
        // GET /api/coach/students
        mockMvc.perform(get("/api/coach/students")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // GET /api/coach/groups
        mockMvc.perform(get("/api/coach/groups")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // GET /api/coach/group-candidates
        mockMvc.perform(get("/api/coach/group-candidates")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }
}
