package com.placeprep;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.placeprep.model.User;
import com.placeprep.model.UserProfile;
import com.placeprep.repository.UserProfileRepository;
import com.placeprep.repository.UserRepository;
import com.placeprep.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class UserProfileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserProfileRepository userProfileRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private ObjectMapper objectMapper;

    private User testUser;
    private String authToken;

    @BeforeEach
    void setup() {
        testUser = userRepository.findByEmail("profile_regression_test@placeprep.test").orElseGet(() -> {
            User u = new User();
            u.setName("Profile Candidate");
            u.setUsername("profile_candidate");
            u.setEmail("profile_regression_test@placeprep.test");
            u.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz1234567890");
            u.setRole("user");
            return userRepository.createUser(u);
        });

        authToken = jwtTokenProvider.generateToken(testUser);
    }

    @Test
    void testUnauthenticatedProfileAccessRejected() throws Exception {
        mockMvc.perform(get("/api/profile"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void testLegacyUserProfileEndpointReturns404NotFound() throws Exception {
        // Proves that /api/user-profile is NOT a registered resource and catches regressions
        mockMvc.perform(get("/api/user-profile")
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(patch("/api/user-profile")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void testGetProfileReachesCanonicalEndpointAndReturnsOwnership() throws Exception {
        mockMvc.perform(get("/api/profile")
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data", notNullValue()))
                .andExpect(jsonPath("$.data.userId", is(testUser.getId().toString())));
    }

    @Test
    void testPostProfileUpdatesAndPreservesUserOwnership() throws Exception {
        UUID maliciousOrForeignUserId = UUID.randomUUID();
        Map<String, Object> update = Map.of(
                "userId", maliciousOrForeignUserId.toString(),
                "githubUrl", "https://github.com/placeprep-student",
                "notificationsEnabled", true
        );

        mockMvc.perform(post("/api/profile")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.userId", is(testUser.getId().toString())))
                .andExpect(jsonPath("$.data.githubUrl", is("https://github.com/placeprep-student")));

        UserProfile saved = userProfileRepository.findByUserId(testUser.getId()).orElseThrow();
        assertEquals(testUser.getId(), saved.getUserId());
        assertEquals("https://github.com/placeprep-student", saved.getGithubUrl());
    }

    @Test
    void testPatchProfilePartiallyUpdatesWithoutOverwritingUnspecifiedFields() throws Exception {
        // First establish known state
        UserProfile initial = new UserProfile();
        initial.setUserId(testUser.getId());
        initial.setLinkedinUrl("https://linkedin.com/in/initial-profile");
        initial.setNotificationsEnabled(true);
        initial.setNotificationEmailEnabled(false);
        userProfileRepository.upsertProfile(initial);

        // Send PATCH with only notificationsEnabled toggle
        Map<String, Object> patch = Map.of("notificationsEnabled", false);

        mockMvc.perform(patch("/api/profile")
                        .header("Authorization", "Bearer " + authToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(patch)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.notificationsEnabled", is(false)))
                .andExpect(jsonPath("$.data.notificationEmailEnabled", is(false)))
                .andExpect(jsonPath("$.data.linkedinUrl", is("https://linkedin.com/in/initial-profile")));

        UserProfile updated = userProfileRepository.findByUserId(testUser.getId()).orElseThrow();
        assertEquals(false, updated.isNotificationsEnabled());
        assertEquals(false, updated.isNotificationEmailEnabled());
        assertEquals("https://linkedin.com/in/initial-profile", updated.getLinkedinUrl());
    }

    @Test
    void testNotificationTestPushReturnsFcmStatusAndEnvelopes() throws Exception {
        mockMvc.perform(post("/api/notifications/test-push")
                        .header("Authorization", "Bearer " + authToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.fcmReady", notNullValue()))
                .andExpect(jsonPath("$.fcmAttempted", notNullValue()))
                .andExpect(jsonPath("$.fcmReason", notNullValue()))
                .andExpect(jsonPath("$.data.fcmReady", notNullValue()))
                .andExpect(jsonPath("$.data.fcmReason", notNullValue()));
    }
}
