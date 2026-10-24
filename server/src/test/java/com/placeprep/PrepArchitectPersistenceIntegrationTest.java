package com.placeprep;

import com.placeprep.model.CodingSubmission;
import com.placeprep.model.Task;
import com.placeprep.model.User;
import com.placeprep.repository.CodingSubmissionRepository;
import com.placeprep.repository.TaskRepository;
import com.placeprep.repository.UserRepository;
import com.placeprep.service.AiService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.SQLException;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class PrepArchitectPersistenceIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private AiService aiService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private CodingSubmissionRepository submissionRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User testUser;

    @BeforeEach
    void setup() throws SQLException {
        assertSafeActiveConnection(jdbcTemplate.getDataSource());

        testUser = userRepository.findByEmail("persistence_grounding_student@placeprep.test").orElseGet(() -> {
            User u = new User();
            u.setName("Persistence Verification Student");
            u.setUsername("persistence_student");
            u.setEmail("persistence_grounding_student@placeprep.test");
            u.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz1234567890");
            u.setRole("user");
            return userRepository.createUser(u);
        });

        // Clean up test data for this dedicated test user only
        jdbcTemplate.update("DELETE FROM coding_submissions WHERE user_id = ?", testUser.getId());
        jdbcTemplate.update("DELETE FROM assessment_sessions WHERE user_id = ?", testUser.getId());
        jdbcTemplate.update("DELETE FROM tasks WHERE user_id = ?", testUser.getId());
        jdbcTemplate.update("DELETE FROM prep_plans WHERE user_id = ?", testUser.getId());
    }

    @AfterEach
    void tearDown() {
        if (testUser != null && testUser.getId() != null) {
            jdbcTemplate.update("DELETE FROM coding_submissions WHERE user_id = ?", testUser.getId());
            jdbcTemplate.update("DELETE FROM assessment_sessions WHERE user_id = ?", testUser.getId());
            jdbcTemplate.update("DELETE FROM tasks WHERE user_id = ?", testUser.getId());
            jdbcTemplate.update("DELETE FROM prep_plans WHERE user_id = ?", testUser.getId());
            jdbcTemplate.update("DELETE FROM users WHERE id = ?", testUser.getId());
        }
    }

    @Test
    @DisplayName("Multiple plan configurations (60m/1mo, 90m/2mo, 120m/3mo) persist to DB with exact schedule invariants")
    void testMultipleConfigurationsPersistence() {
        // Config A: 60 mins/day, 1 month -> 4 weeks, 5.0 hrs/week
        Map<String, Object> reqA = Map.of(
                "companyKey", "msft",
                "targetRole", "SDE Intern",
                "timePerDay", 60,
                "durationMonths", 1
        );
        Map<String, Object> planA = aiService.createAndPersistPlan(testUser, reqA);
        assertNotNull(planA.get("id"));
        assertEquals(1, planA.get("version"));
        List<Map<String, Object>> roadmapA = (List<Map<String, Object>>) planA.get("roadmap");
        assertEquals(4, roadmapA.size(), "1 month must be 4 weeks");
        for (Map<String, Object> w : roadmapA) {
            assertEquals(5.0, ((Number) w.get("estimatedHours")).doubleValue(), 0.01);
        }
        List<Map<String, Object>> tasksA = (List<Map<String, Object>>) planA.get("tasks");
        assertEquals(5, tasksA.size());
        for (Map<String, Object> d : tasksA) {
            List<Map<String, Object>> items = (List<Map<String, Object>>) d.get("items");
            assertEquals(1, items.size(), "60-minute day must have exactly 1 deliberate 60-min focus block");
            assertEquals(60, ((Number) items.get(0).get("estimatedMinutes")).intValue());
        }

        // Config B: 90 mins/day, 2 months -> 8 weeks, 7.5 hrs/week
        Map<String, Object> reqB = Map.of(
                "companyKey", "msft",
                "targetRole", "SDE II",
                "timePerDay", 90,
                "durationMonths", 2
        );
        Map<String, Object> planB = aiService.createAndPersistPlan(testUser, reqB);
        assertEquals(2, planB.get("version"), "Plan version must increment to 2");
        List<Map<String, Object>> roadmapB = (List<Map<String, Object>>) planB.get("roadmap");
        assertEquals(8, roadmapB.size(), "2 months must be 8 weeks");
        for (Map<String, Object> w : roadmapB) {
            assertEquals(7.5, ((Number) w.get("estimatedHours")).doubleValue(), 0.01);
        }
        List<Map<String, Object>> tasksB = (List<Map<String, Object>>) planB.get("tasks");
        assertEquals(5, tasksB.size());
        for (Map<String, Object> d : tasksB) {
            List<Map<String, Object>> items = (List<Map<String, Object>>) d.get("items");
            assertEquals(2, items.size(), "90-minute day must have exactly 2 deliberate 45-min focus blocks");
            assertEquals(45, ((Number) items.get(0).get("estimatedMinutes")).intValue());
            assertEquals(45, ((Number) items.get(1).get("estimatedMinutes")).intValue());
            assertEquals(90, items.stream().mapToInt(it -> ((Number) it.get("estimatedMinutes")).intValue()).sum());
        }

        // Config C: 120 mins/day, 3 months -> 12 weeks, 10.0 hrs/week
        Map<String, Object> reqC = Map.of(
                "companyKey", "msft",
                "targetRole", "Senior SDE",
                "timePerDay", 120,
                "durationMonths", 3
        );
        Map<String, Object> planC = aiService.createAndPersistPlan(testUser, reqC);
        assertEquals(3, planC.get("version"), "Plan version must increment to 3");
        List<Map<String, Object>> roadmapC = (List<Map<String, Object>>) planC.get("roadmap");
        assertEquals(12, roadmapC.size(), "3 months must be 12 weeks");
        for (Map<String, Object> w : roadmapC) {
            assertEquals(10.0, ((Number) w.get("estimatedHours")).doubleValue(), 0.01);
        }
        List<Map<String, Object>> tasksC = (List<Map<String, Object>>) planC.get("tasks");
        assertEquals(5, tasksC.size());
        for (Map<String, Object> d : tasksC) {
            List<Map<String, Object>> items = (List<Map<String, Object>>) d.get("items");
            assertEquals(2, items.size(), "120-minute day must have exactly 2 deliberate 60-min focus blocks");
            assertEquals(60, ((Number) items.get(0).get("estimatedMinutes")).intValue());
            assertEquals(60, ((Number) items.get(1).get("estimatedMinutes")).intValue());
            assertEquals(120, items.stream().mapToInt(it -> ((Number) it.get("estimatedMinutes")).intValue()).sum());
        }

        // Verify database state: Only the latest plan (v3) is active, v1 and v2 are inactive
        List<Map<String, Object>> allPlans = jdbcTemplate.queryForList(
                "SELECT version, is_active FROM prep_plans WHERE user_id = ? ORDER BY version ASC",
                testUser.getId()
        );
        assertEquals(3, allPlans.size());
        assertEquals(false, allPlans.get(0).get("is_active"));
        assertEquals(false, allPlans.get(1).get("is_active"));
        assertEquals(true, allPlans.get(2).get("is_active"));
    }

    @Test
    @DisplayName("Prior completed tasks and submissions are preserved during plan regeneration and baseline recalibration")
    void testTaskAndSubmissionHistoryPreserved() {
        // 1. Seed prior completed task
        Task completedTask = new Task();
        completedTask.setUserId(testUser.getId());
        completedTask.setTitle("Two Sum Optimization (LeetCode #1)");
        completedTask.setDescription("Solved using single-pass hash map in O(N).");
        completedTask.setCategory("DSA");
        completedTask.setPriority("high");
        completedTask.setStatus("completed");
        completedTask.setEstimatedMinutes(30);
        completedTask.setActualMinutes(25);
        completedTask.setScheduledFor(LocalDate.now().minusDays(2));
        completedTask = taskRepository.createTask(completedTask);
        UUID completedTaskId = completedTask.getId();

        // 2. Seed prior coding submission
        CodingSubmission sub = new CodingSubmission();
        sub.setUserId(testUser.getId());
        sub.setProblem(Map.of("number", "1", "title", "Two Sum"));
        sub.setLanguage("java");
        sub.setSourceCode("class Solution { public int[] twoSum(int[] nums, int target) { return new int[]{0,1}; } }");
        sub.setStatus("accepted");
        sub = submissionRepository.create(sub);
        UUID subId = sub.getId();

        // 3. Create plan
        Map<String, Object> plan = aiService.createAndPersistPlan(testUser, Map.of(
                "companyKey", "msft",
                "timePerDay", 120,
                "durationMonths", 1
        ));
        UUID planId = UUID.fromString((String) plan.get("id"));

        // 4. Recalibrate plan via finalizePlanAfterBaseline
        aiService.finalizePlanAfterBaseline(
                testUser,
                planId,
                UUID.randomUUID(),
                Map.of("Dynamic Programming", 40.0, "Trees", 90.0),
                List.of("Dynamic Programming")
        );

        // 5. Verify prior task is untouched and remains completed
        Task preservedTask = taskRepository.findById(completedTaskId, testUser.getId()).orElseThrow();
        assertEquals("completed", preservedTask.getStatus());
        assertEquals(25, preservedTask.getActualMinutes());
        assertEquals("Two Sum Optimization (LeetCode #1)", preservedTask.getTitle());

        // 6. Verify submission is untouched
        CodingSubmission preservedSub = submissionRepository.findById(subId).orElseThrow();
        assertEquals("accepted", preservedSub.getStatus());
        assertEquals("Two Sum", preservedSub.getProblem().get("title"));

        // 7. Verify plan update does not duplicate pending tasks
        long pendingTaskCountBefore = taskRepository.listTasks(testUser.getId(), "today", "pending", null, null).size();
        aiService.finalizePlanAfterBaseline(
                testUser,
                planId,
                UUID.randomUUID(),
                Map.of("Dynamic Programming", 50.0),
                List.of("Dynamic Programming")
        );
        long pendingTaskCountAfter = taskRepository.listTasks(testUser.getId(), "today", "pending", null, null).size();
        assertEquals(pendingTaskCountBefore, pendingTaskCountAfter, "Repeated finalization must not create duplicate tasks");
    }

    @Test
    @DisplayName("Persisted plan JSON matches frontend (api.ts) and Android (ApiModels.kt) contracts")
    void testContractCompatibility() {
        Map<String, Object> plan = aiService.createAndPersistPlan(testUser, Map.of(
                "companyKey", "msft",
                "targetRole", "Software Engineer",
                "timePerDay", 120,
                "durationMonths", 1
        ));

        // Required top-level keys
        for (String key : List.of("id", "userId", "roadmap", "tasks", "resources", "flashcards", "timePerDay", "durationMonths", "targetRole", "version", "status", "metadata")) {
            assertTrue(plan.containsKey(key), "Missing top-level contract key: " + key);
        }

        // Roadmap week contract
        List<Map<String, Object>> roadmap = (List<Map<String, Object>>) plan.get("roadmap");
        assertFalse(roadmap.isEmpty());
        Map<String, Object> w1 = roadmap.get(0);
        assertTrue(w1.containsKey("week"));
        assertTrue(w1.containsKey("title"));
        assertTrue(w1.containsKey("focusTopics"));
        assertTrue(w1.containsKey("estimatedHours"));
        assertTrue(w1.containsKey("goals"));

        // Task day & item contract
        List<Map<String, Object>> tasks = (List<Map<String, Object>>) plan.get("tasks");
        assertFalse(tasks.isEmpty());
        Map<String, Object> d1 = tasks.get(0);
        assertTrue(d1.containsKey("day"));
        assertTrue(d1.containsKey("theme"));
        assertTrue(d1.containsKey("totalEstimatedMinutes"));
        assertTrue(d1.containsKey("items"));

        List<Map<String, Object>> items = (List<Map<String, Object>>) d1.get("items");
        assertFalse(items.isEmpty());
        Map<String, Object> item1 = items.get(0);
        assertTrue(item1.containsKey("title"));
        assertTrue(item1.containsKey("type"));
        assertTrue(item1.containsKey("difficulty"));
        assertTrue(item1.containsKey("estimatedMinutes"));
        assertTrue(item1.containsKey("summary"));
        assertTrue(item1.containsKey("referenceLabel"));
        assertTrue(item1.containsKey("codingLabUrl"));
        assertTrue(item1.containsKey("leetcodeId"));
    }

    @Test
    @DisplayName("Request intake with non-positive or zero timePerDay defaults to 120 minutes in persisted plan")
    void testRequestIntakeNonPositiveTimePerDayDefaultsTo120() {
        Map<String, Object> reqZero = Map.of(
                "companyKey", "msft",
                "targetRole", "SDE",
                "timePerDay", 0,
                "durationMonths", 1
        );
        Map<String, Object> planZero = aiService.createAndPersistPlan(testUser, reqZero);
        assertEquals(120, ((Number) planZero.get("timePerDay")).intValue());
        Map<String, Object> metaZero = (Map<String, Object>) planZero.get("metadata");
        assertEquals(120, ((Number) metaZero.get("timePerDay")).intValue());

        Map<String, Object> reqNeg = Map.of(
                "companyKey", "msft",
                "targetRole", "SDE",
                "timePerDay", -60,
                "durationMonths", 1
        );
        Map<String, Object> planNeg = aiService.createAndPersistPlan(testUser, reqNeg);
        assertEquals(120, ((Number) planNeg.get("timePerDay")).intValue());
    }
}
