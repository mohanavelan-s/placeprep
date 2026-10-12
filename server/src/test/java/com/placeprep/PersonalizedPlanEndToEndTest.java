package com.placeprep;

import com.placeprep.model.AssessmentSession;
import com.placeprep.model.Task;
import com.placeprep.model.User;
import com.placeprep.repository.AssessmentRepository;
import com.placeprep.repository.TaskRepository;
import com.placeprep.repository.UserRepository;
import com.placeprep.service.AiService;
import com.placeprep.service.AssessmentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class PersonalizedPlanEndToEndTest {

    @Autowired
    private AiService aiService;

    @Autowired
    private AssessmentService assessmentService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private AssessmentRepository assessmentRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User testUser;

    @BeforeEach
    void setup() {
        testUser = userRepository.findByEmail("e2e_amazon_sde_student@placeprep.test").orElseGet(() -> {
            User u = new User();
            u.setName("Amazon SDE Candidate");
            u.setUsername("amazon_e2e_student");
            u.setEmail("e2e_amazon_sde_student@placeprep.test");
            u.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz1234567890");
            u.setRole("user");
            return userRepository.createUser(u);
        });

        // Clean up previous runs for this test user
        jdbcTemplate.update("DELETE FROM assessment_sessions WHERE user_id = ?", testUser.getId());
        jdbcTemplate.update("DELETE FROM tasks WHERE user_id = ?", testUser.getId());
        jdbcTemplate.update("DELETE FROM prep_plans WHERE user_id = ?", testUser.getId());
    }

    @Test
    void testEndToEndAmazonSdeInternWorkflow() {
        // ---------------------------------------------------------------------
        // STEP 0: Seed an existing completed task to verify user history preservation
        // ---------------------------------------------------------------------
        Task priorCompletedTask = new Task();
        priorCompletedTask.setUserId(testUser.getId());
        priorCompletedTask.setTitle("Implement LRU Cache in Java (LeetCode 146)");
        priorCompletedTask.setDescription("Designed doubly linked list + hashmap structure.");
        priorCompletedTask.setCategory("DSA");
        priorCompletedTask.setPriority("high");
        priorCompletedTask.setStatus("completed");
        priorCompletedTask.setEstimatedMinutes(45);
        priorCompletedTask.setActualMinutes(40);
        priorCompletedTask.setScheduledFor(LocalDate.now().minusDays(1));
        priorCompletedTask = taskRepository.createTask(priorCompletedTask);
        UUID priorTaskId = priorCompletedTask.getId();

        // ---------------------------------------------------------------------
        // STEP 1 & 2: Generate plan for Amazon SDE Intern with verifiable research
        // ---------------------------------------------------------------------
        Map<String, Object> intake = new LinkedHashMap<>();
        intake.put("companyKey", "amazon");
        intake.put("customCompanyName", "Amazon");
        intake.put("targetRole", "SDE Intern");
        intake.put("seniority", "internship");
        intake.put("durationMonths", 3);
        intake.put("timePerDay", 120);

        Map<String, Object> plan = aiService.createAndPersistPlan(testUser, intake);
        assertNotNull(plan, "Plan must be created");
        assertEquals("assessment_pending", plan.get("status"), "Initial plan status must be assessment_pending");

        // Verify source provenance is persisted
        @SuppressWarnings("unchecked")
        Map<String, Object> researchReport = (Map<String, Object>) plan.get("researchReport");
        assertNotNull(researchReport, "Research report must be present");
        assertEquals("Amazon", researchReport.get("companyName"));
        assertEquals("SDE Intern", researchReport.get("targetRole"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sources = (List<Map<String, Object>>) researchReport.get("sources");
        assertNotNull(sources, "Verified sources must be present");
        assertFalse(sources.isEmpty(), "At least one source must be recorded");

        System.out.println("=== ACTUAL VERIFIED SOURCES RETRIEVED FOR AMAZON SDE INTERN ===");
        for (Map<String, Object> s : sources) {
            System.out.println("- Title: " + s.get("title"));
            System.out.println("  URL: " + s.get("url"));
            System.out.println("  Category/Tier: " + s.get("category"));
            System.out.println("  Confidence: " + s.get("confidence"));
            System.out.println("  Date Checked: " + s.get("dateChecked"));
            System.out.println("  Supported Claims: " + s.get("supportedClaims"));
        }

        // ---------------------------------------------------------------------
        // STEP 3 & 4: Verify pending baseline diagnostic appears in Assessments
        // ---------------------------------------------------------------------
        Map<String, Object> pending = assessmentService.getPendingBaseline(testUser);
        assertTrue(Boolean.TRUE.equals(pending.get("hasPending")), "Pending baseline must be active");
        assertEquals("SDE Intern", pending.get("targetRole"));
        assertEquals("Amazon", pending.get("companyName"));

        String sessionIdStr = (String) pending.get("id");
        assertNotNull(sessionIdStr, "Session ID must be returned");
        UUID baselineSessionId = UUID.fromString(sessionIdStr);

        AssessmentSession baselineSession = assessmentRepository.findById(baselineSessionId, testUser.getId())
                .orElseThrow(() -> new AssertionError("Session not found in DB"));
        assertEquals("started", baselineSession.getStatus());
        assertTrue(baselineSession.getQuestions().size() >= 7, "Diagnostic must contain at least 7 questions");

        // ---------------------------------------------------------------------
        // STEP 5: Complete the MCQ and coding questions
        // Induce targeted skill gaps in Dynamic Programming and Graphs
        // ---------------------------------------------------------------------
        Map<String, String> candidateAnswers = new HashMap<>();
        for (Map<String, Object> q : baselineSession.getQuestions()) {
            String qId = String.valueOf(q.getOrDefault("id", "q1"));
            String topic = String.valueOf(q.getOrDefault("topic", "")).toLowerCase();
            if (topic.contains("dynamic") || topic.contains("graph")) {
                // Intentionally answer incorrectly to generate skill gap
                candidateAnswers.put(qId, "WRONG_ANSWER_CHOICE");
            } else {
                Object ca = q.get("correctAnswer");
                if (ca != null) {
                    candidateAnswers.put(qId, String.valueOf(ca));
                } else {
                    candidateAnswers.put(qId, "Hash map invariant solution");
                }
            }
        }

        Map<String, Object> submitPayload = new HashMap<>();
        submitPayload.put("answers", candidateAnswers);
        AssessmentSession resultSession = assessmentService.submitAssessment(testUser, baselineSessionId, submitPayload);

        // ---------------------------------------------------------------------
        // STEP 6: Verify scoring and topic-level skill gaps
        // ---------------------------------------------------------------------
        assertNotNull(resultSession);
        assertEquals("completed", resultSession.getStatus());
        List<String> weakSpots = resultSession.getWeakSpots();
        assertNotNull(weakSpots);
        assertFalse(weakSpots.isEmpty(), "Weak spots must be identified from incorrect answers");

        @SuppressWarnings("unchecked")
        Map<String, Double> topicScores = (Map<String, Double>) resultSession.getMetadata().get("topicScores");
        assertNotNull(topicScores, "Topic level breakdown must be computed");
        System.out.println("=== TOPIC LEVEL SKILL GAP BREAKDOWN ===");
        topicScores.forEach((t, score) -> {
            System.out.println(t + " -> score: " + score + "%");
        });

        // ---------------------------------------------------------------------
        // STEP 7 & 8: Verify personalized plan finalization and roadmap calibration
        // ---------------------------------------------------------------------
        Map<String, Object> finalizedPlan = aiService.getLatestPrepPlan(testUser);
        assertNotNull(finalizedPlan);
        assertEquals("plan_ready", finalizedPlan.get("status"), "Status must now be plan_ready");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> roadmap = (List<Map<String, Object>>) finalizedPlan.get("roadmap");
        assertNotNull(roadmap);
        assertFalse(roadmap.isEmpty());

        Map<String, Object> week1 = roadmap.get(0);
        @SuppressWarnings("unchecked")
        List<String> week1Topics = (List<String>) week1.get("focusTopics");
        assertNotNull(week1Topics);
        System.out.println("Week 1 Focus Topics: " + week1Topics);

        // ---------------------------------------------------------------------
        // STEP 9: Confirm completed tasks and user history are preserved
        // ---------------------------------------------------------------------
        Optional<Task> preservedTask = taskRepository.findById(priorTaskId, testUser.getId());
        assertTrue(preservedTask.isPresent(), "Prior completed task must survive plan finalization");
        assertEquals("completed", preservedTask.get().getStatus(), "Prior task must remain completed");
        assertEquals("Implement LRU Cache in Java (LeetCode 146)", preservedTask.get().getTitle());

        // Also check newly generated tasks
        List<Task> currentTasks = taskRepository.listTasks(testUser.getId(), null, null, null, null);
        assertTrue(currentTasks.size() >= 2, "New personalized tasks should have been generated alongside prior tasks");

        // ---------------------------------------------------------------------
        // STEP 10: Verify retaking assessments does not erase completed tasks
        // ---------------------------------------------------------------------
        Map<String, Object> secondAssessmentPayload = new HashMap<>();
        secondAssessmentPayload.put("assessmentType", "mcq");
        secondAssessmentPayload.put("assessmentScope", "daily");
        secondAssessmentPayload.put("durationMinutes", 15);
        Map<String, Object> secondGen = assessmentService.generateAssessment(testUser, secondAssessmentPayload);
        assertNotNull(secondGen.get("session"));

        AssessmentSession secondSession = (AssessmentSession) secondGen.get("session");
        assessmentService.submitAssessment(testUser, secondSession.getId(), Map.of("answers", Map.of()));

        // Confirm again that prior task is still completed and safe
        Optional<Task> postRetakeTask = taskRepository.findById(priorTaskId, testUser.getId());
        assertTrue(postRetakeTask.isPresent());
        assertEquals("completed", postRetakeTask.get().getStatus());
        System.out.println("=== END-TO-END VALIDATION PASSED: ALL 10 STEPS VERIFIED CLEANLY ===");
    }
}
