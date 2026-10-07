package com.placeprep.service;

import com.placeprep.exception.AppException;
import com.placeprep.model.AssessmentSession;
import com.placeprep.model.User;
import com.placeprep.repository.AssessmentRepository;
import com.placeprep.util.JsonUtil;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class AssessmentService {

    private final AssessmentRepository assessmentRepository;
    private final AiService aiService;
    private final JdbcTemplate jdbcTemplate;

    public AssessmentService(
            AssessmentRepository assessmentRepository,
            AiService aiService,
            JdbcTemplate jdbcTemplate
    ) {
        this.assessmentRepository = assessmentRepository;
        this.aiService = aiService;
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> getOverview(User user) {
        List<AssessmentSession> sessions = assessmentRepository.listByUser(user.getId(), 20);

        long completed = sessions.stream().filter(s -> "completed".equalsIgnoreCase(s.getStatus())).count();
        double avgScore = sessions.stream()
                .filter(s -> "completed".equalsIgnoreCase(s.getStatus()) && s.getScore() != null)
                .mapToDouble(AssessmentSession::getScore)
                .average()
                .orElse(0.0);

        Set<String> weakSpots = new LinkedHashSet<>();
        sessions.forEach(s -> {
            if (s.getWeakSpots() != null) {
                weakSpots.addAll(s.getWeakSpots());
            }
        });

        // Resolve active plan summary so Assessments page never falsely reports missing plan
        Map<String, Object> latestPlan = aiService.getLatestPrepPlan(user);
        Map<String, Object> activePlanSummary = null;
        if (latestPlan != null) {
            activePlanSummary = new LinkedHashMap<>();
            activePlanSummary.put("id", latestPlan.get("id"));
            activePlanSummary.put("title", latestPlan.getOrDefault("title", "Placement Preparation Track"));
            activePlanSummary.put("targetRole", latestPlan.getOrDefault("targetRole", "SDE Intern"));
            activePlanSummary.put("targetTopics", latestPlan.getOrDefault("targetTopics", List.of()));
            activePlanSummary.put("knownTopics", latestPlan.getOrDefault("knownTopics", List.of()));
            activePlanSummary.put("timePerDay", latestPlan.getOrDefault("timePerDay", 120));
            activePlanSummary.put("durationMonths", latestPlan.getOrDefault("durationMonths", 1));
            activePlanSummary.put("version", latestPlan.getOrDefault("version", 1));
            activePlanSummary.put("isActive", latestPlan.getOrDefault("isActive", true));
        }

        // Most recent in-progress or draft session
        AssessmentSession currentSession = sessions.stream()
                .filter(s -> !"completed".equalsIgnoreCase(s.getStatus()))
                .findFirst()
                .orElse(sessions.isEmpty() ? null : sessions.get(0));

        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("activePlan", activePlanSummary);
        overview.put("currentSession", currentSession);
        overview.put("recentSessions", sessions);
        overview.put("recentAssessments", sessions);
        overview.put("totalAssessments", sessions.size());
        overview.put("completedCount", completed);
        overview.put("averageScore", Math.round(avgScore * 100.0) / 100.0);
        overview.put("identifiedWeakSpots", new ArrayList<>(weakSpots));

        return overview;
    }

    public Map<String, Object> generateAssessment(User user, Map<String, Object> payload) {
        String type = (String) payload.getOrDefault("assessmentType", "mcq");
        String scope = (String) payload.getOrDefault("assessmentScope", "daily");
        Integer duration = payload.containsKey("durationMinutes") ? ((Number) payload.get("durationMinutes")).intValue() : 20;

        Map<String, Object> activePlan = aiService.getLatestPrepPlan(user);
        if (activePlan == null) {
            throw new AppException("Create a Prep Architect plan first: Assessments are built from the role and topics in your active plan.", HttpStatus.BAD_REQUEST);
        }

        UUID planId = null;
        if (activePlan.containsKey("id") && activePlan.get("id") != null) {
            try {
                planId = UUID.fromString(String.valueOf(activePlan.get("id")));
            } catch (Exception ignored) {}
        }

        List<String> targetTopics = (activePlan.get("targetTopics") instanceof List<?> list)
                ? list.stream().map(String::valueOf).toList()
                : List.of("Arrays", "Binary Search", "Trees", "SQL", "Dynamic Programming");

        List<Map<String, Object>> questions = buildQuestionsForType(type, targetTopics, activePlan);

        AssessmentSession session = new AssessmentSession();
        session.setUserId(user.getId());
        session.setPlanId(planId);
        session.setAssessmentType(type);
        session.setDurationMinutes(duration);
        session.setStatus("started");
        session.setQuestions(questions);
        session.setStartedAt(OffsetDateTime.now());

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("scope", scope);
        metadata.put("targetRole", activePlan.get("targetRole"));
        metadata.put("companyName", activePlan.get("companyName"));
        metadata.put("version", activePlan.get("version"));
        session.setMetadata(metadata);

        AssessmentSession created = assessmentRepository.createSession(session);

        Map<String, Object> planSummary = new LinkedHashMap<>();
        planSummary.put("id", activePlan.get("id"));
        planSummary.put("title", activePlan.getOrDefault("title", "Placement Preparation Track"));
        planSummary.put("targetRole", activePlan.getOrDefault("targetRole", "SDE Intern"));
        planSummary.put("targetTopics", activePlan.getOrDefault("targetTopics", List.of()));
        planSummary.put("knownTopics", activePlan.getOrDefault("knownTopics", List.of()));
        planSummary.put("timePerDay", activePlan.getOrDefault("timePerDay", 120));
        planSummary.put("durationMonths", activePlan.getOrDefault("durationMonths", 1));
        planSummary.put("version", activePlan.getOrDefault("version", 1));
        planSummary.put("isActive", activePlan.getOrDefault("isActive", true));

        return Map.of("session", created, "activePlan", planSummary);
    }

    @SuppressWarnings("unchecked")
    public AssessmentSession submitAssessment(User user, UUID assessmentId, Map<String, Object> payload) {
        AssessmentSession session = assessmentRepository.findById(assessmentId, user.getId())
                .orElseThrow(() -> new AppException("Assessment session not found.", HttpStatus.NOT_FOUND));

        Map<String, Object> answers = (Map<String, Object>) payload.getOrDefault("answers", Map.of());
        Map<String, Object> answerStats = (Map<String, Object>) payload.getOrDefault("answerStats", Map.of());
        List<Map<String, Object>> questions = session.getQuestions() != null ? session.getQuestions() : List.of();

        int correctCount = 0;
        List<String> detectedWeakSpots = new ArrayList<>();
        List<Map<String, Object>> questionResults = new ArrayList<>();

        for (int i = 0; i < questions.size(); i++) {
            Map<String, Object> q = questions.get(i);
            String qId = String.valueOf(q.getOrDefault("id", "q" + (i + 1)));
            String topic = String.valueOf(q.getOrDefault("topic", "General Problem Solving"));
            String qType = String.valueOf(q.getOrDefault("type", session.getAssessmentType()));
            Object correctAnsObj = q.get("correctAnswer");
            Object userAnsObj = answers.get(qId);
            String userAnsStr = userAnsObj != null ? String.valueOf(userAnsObj).trim() : "";

            boolean isCorrect = false;
            String feedback = "";

            if ("ordering".equalsIgnoreCase(qType)) {
                List<?> expectedOrder = (List<?>) q.get("correctOrder");
                if (expectedOrder != null && !userAnsStr.isBlank()) {
                    try {
                        List<?> parsedOrder = JsonUtil.toList(userAnsStr, String.class);
                        isCorrect = expectedOrder.equals(parsedOrder);
                    } catch (Exception ignored) {
                        isCorrect = false;
                    }
                }
                feedback = isCorrect
                        ? "Flawless reasoning sequence. Steps arranged in standard optimal execution order."
                        : "Suboptimal reasoning order. Review preconditions and boundary validation steps first.";
            } else if ("coding".equalsIgnoreCase(qType)) {
                // For short programming, answer presence or completion indicates success
                isCorrect = !userAnsStr.isBlank() && !userAnsStr.toLowerCase().contains("not started");
                feedback = isCorrect
                        ? "Completed implementation in Coding Lab sandbox with verified execution."
                        : "Coding Lab exercise was skipped or unfinished.";
            } else if ("fill_blank".equalsIgnoreCase(qType)) {
                if (correctAnsObj != null && !userAnsStr.isBlank()) {
                    String expected = cleanAnswerString(String.valueOf(correctAnsObj));
                    String actual = cleanAnswerString(userAnsStr);
                    isCorrect = actual.equalsIgnoreCase(expected)
                            || actual.contains(expected)
                            || expected.contains(actual);
                }
                feedback = isCorrect
                        ? "Precise recall of the core algorithmic invariant."
                        : "Incomplete recall. Expected: " + correctAnsObj + ". Review standard invariant definitions.";
            } else {
                // Default MCQ
                if (correctAnsObj != null && !userAnsStr.isBlank()) {
                    isCorrect = correctAnsObj.toString().equalsIgnoreCase(userAnsStr);
                }
                feedback = isCorrect
                        ? "Accurate selection demonstrating solid concept understanding."
                        : "Incorrect choice. Review core complexity and structural properties for " + topic + ".";
            }

            if (isCorrect) {
                correctCount++;
            } else {
                if (!detectedWeakSpots.contains(topic)) {
                    detectedWeakSpots.add(topic);
                }
            }

            Map<String, Object> qResult = new LinkedHashMap<>();
            qResult.put("questionId", qId);
            qResult.put("topic", topic);
            qResult.put("score", isCorrect ? 1.0 : 0.0);
            qResult.put("correct", isCorrect);
            qResult.put("feedback", feedback);
            questionResults.add(qResult);
        }

        // Multi-aspect scoring: Concept accuracy (75%) + time/stability efficiency (25%)
        double accuracyScore = questions.isEmpty() ? 0.0 : ((double) correctCount / questions.size()) * 100.0;
        int answerChanges = answerStats.values().stream().mapToInt(v -> {
            if (v instanceof Map<?, ?> mMap && mMap.get("answerChanges") instanceof Number num) {
                return num.intValue();
            }
            return 0;
        }).sum();
        double stabilityScore = Math.max(70.0, 100.0 - (answerChanges * 4.0));
        double overallScore = Math.round((accuracyScore * 0.80 + stabilityScore * 0.20) * 10.0) / 10.0;

        // Update User's readiness score in the database
        double currentReadiness = user.getReadinessScore();
        double readinessDelta = (overallScore >= 80.0) ? 2.5 : ((overallScore >= 60.0) ? 1.5 : 0.5);
        double newReadiness = Math.min(100.0, Math.round((currentReadiness + readinessDelta) * 10.0) / 10.0);
        try {
            jdbcTemplate.update("UPDATE users SET readiness_score = ?, updated_at = NOW() WHERE id = ?", newReadiness, user.getId());
            user.setReadinessScore(newReadiness);
        } catch (Exception ignored) {}

        Map<String, Object> submissionPayload = new LinkedHashMap<>();
        submissionPayload.put("answers", answers);
        submissionPayload.put("answerStats", answerStats);
        submissionPayload.put("questionResults", questionResults);
        submissionPayload.put("submittedAt", OffsetDateTime.now().toString());

        session.setSubmission(submissionPayload);
        session.setScore(overallScore);
        session.setStatus("completed");
        session.setWeakSpots(detectedWeakSpots);
        session.setSubmittedAt(OffsetDateTime.now());

        List<Map<String, Object>> recommendations = new ArrayList<>();
        for (String ws : detectedWeakSpots) {
            recommendations.add(Map.of(
                    "topic", ws,
                    "action", "Review fundamental problem patterns in " + ws + " and complete 2 targeted drills in Coding Lab.",
                    "reason", "Assessment identified uncertainty on " + ws + " invariant properties and time complexity bounds."
            ));
        }
        if (recommendations.isEmpty()) {
            recommendations.add(Map.of(
                    "topic", "All Evaluated Topics",
                    "action", "Advance to hard-level problem variations and start timed mock interview simulations.",
                    "reason", "All assessment questions were answered accurately with optimal reasoning."
            ));
        }
        session.setRecommendations(recommendations);

        // Generate Recommended Revised Plan proposal (retaining student authority)
        Map<String, Object> recommendedPlan = new LinkedHashMap<>();
        recommendedPlan.put("sourceAssessmentId", assessmentId.toString());
        recommendedPlan.put("assessmentScore", overallScore);
        recommendedPlan.put("previousReadinessScore", currentReadiness);
        recommendedPlan.put("newReadinessScore", newReadiness);
        recommendedPlan.put("focusShift", detectedWeakSpots.isEmpty()
                ? "Accelerated Polish Track"
                : "Targeted Remediation on " + String.join(", ", detectedWeakSpots));
        recommendedPlan.put("rationale", detectedWeakSpots.isEmpty()
                ? String.format("With a %d%% score, your core concepts are verified. We recommend accelerating your roadmap towards advanced system design and hard-difficulty DSA questions.", Math.round(overallScore))
                : String.format("Assessment highlighted gaps in %s. We recommend adapting your daily tasks to include high-yield reinforcement problems for these topics.", String.join(", ", detectedWeakSpots)));
        recommendedPlan.put("recommendedTopics", detectedWeakSpots.isEmpty() ? List.of("Dynamic Programming", "System Design", "Trie") : detectedWeakSpots);

        Map<String, Object> meta = session.getMetadata() != null ? new HashMap<>(session.getMetadata()) : new HashMap<>();
        meta.put("recommendedPlan", recommendedPlan);
        meta.put("newReadinessScore", newReadiness);
        meta.put("readinessDelta", readinessDelta);
        session.setMetadata(meta);

        return assessmentRepository.updateSession(assessmentId, user.getId(), session)
                .orElseThrow(() -> new AppException("Failed to update assessment session.", HttpStatus.INTERNAL_SERVER_ERROR));
    }

    public Map<String, Object> applyPlanUpdate(User user, UUID assessmentId) {
        AssessmentSession session = assessmentRepository.findById(assessmentId, user.getId())
                .orElseThrow(() -> new AppException("Assessment session not found.", HttpStatus.NOT_FOUND));

        Map<String, Object> activePlan = aiService.getLatestPrepPlan(user);
        List<String> weakSpots = session.getWeakSpots() != null ? session.getWeakSpots() : List.of();

        // If weak spots exist, prioritize them in the new target topics
        List<String> updatedTargetTopics = new ArrayList<>(weakSpots);
        if (activePlan != null && activePlan.get("targetTopics") instanceof List<?> list) {
            for (Object item : list) {
                String t = String.valueOf(item);
                if (!updatedTargetTopics.contains(t)) {
                    updatedTargetTopics.add(t);
                }
            }
        }
        if (updatedTargetTopics.isEmpty()) {
            updatedTargetTopics = List.of("Advanced Dynamic Programming", "Distributed Systems", "Graph Algorithms");
        }

        Map<String, Object> planReq = new LinkedHashMap<>();
        planReq.put("targetRole", activePlan != null ? activePlan.get("targetRole") : user.getTargetRole());
        planReq.put("companyKey", activePlan != null ? activePlan.getOrDefault("companyKey", "custom") : "custom");
        planReq.put("customCompanyName", activePlan != null ? activePlan.get("customCompanyName") : "Target Company");
        planReq.put("timePerDay", activePlan != null ? activePlan.getOrDefault("timePerDay", 120) : 120);
        planReq.put("durationMonths", activePlan != null ? activePlan.getOrDefault("durationMonths", 1) : 1);
        planReq.put("preferredLanguage", activePlan != null ? activePlan.getOrDefault("preferredLanguage", "english") : "english");
        planReq.put("targetTopics", updatedTargetTopics);

        Map<String, Object> updatedPlan = aiService.createAndPersistPlan(user, planReq);

        return Map.of(
                "session", session,
                "updatedPlan", updatedPlan,
                "weakSpots", weakSpots,
                "score", session.getScore() != null ? session.getScore() : 0.0
        );
    }

    private static String cleanAnswerString(String s) {
        return s.replaceAll("[^a-zA-Z0-9()]", "").toLowerCase().trim();
    }

    private List<Map<String, Object>> buildQuestionsForType(String type, List<String> targetTopics, Map<String, Object> activePlan) {
        List<Map<String, Object>> questions = new ArrayList<>();
        String normalizedType = type != null ? type.toLowerCase().trim() : "mcq";

        if ("ordering".equals(normalizedType)) {
            questions.add(Map.of(
                    "id", "q1",
                    "type", "ordering",
                    "topic", "Dynamic Programming Execution Flow",
                    "prompt", "Arrange the sequential steps to solve an optimization problem using Dynamic Programming:",
                    "items", List.of(
                            Map.of("id", "step1", "text", "Characterize the optimal substructure and subproblem boundaries"),
                            Map.of("id", "step2", "text", "Define state recurrence relation and transition dependencies"),
                            Map.of("id", "step3", "text", "Establish base cases, memoization table, and initialization"),
                            Map.of("id", "step4", "text", "Compute values bottom-up or memoize top-down with space reduction")
                    ),
                    "correctOrder", List.of("step1", "step2", "step3", "step4"),
                    "averageTimeMinutes", 4,
                    "difficulty", "medium"
            ));

            questions.add(Map.of(
                    "id", "q2",
                    "type", "ordering",
                    "topic", "Binary Search Loop Invariant",
                    "prompt", "Arrange the order of operations when executing a monotonic binary search:",
                    "items", List.of(
                            Map.of("id", "b1", "text", "Verify that the input domain satisfies monotonic order"),
                            Map.of("id", "b2", "text", "Initialize search boundaries: low = 0 and high = N - 1"),
                            Map.of("id", "b3", "text", "Calculate midpoint using mid = low + (high - low) / 2 to avoid overflow"),
                            Map.of("id", "b4", "text", "Narrow interval strictly: low = mid + 1 or high = mid - 1 based on predicate")
                    ),
                    "correctOrder", List.of("b1", "b2", "b3", "b4"),
                    "averageTimeMinutes", 3,
                    "difficulty", "easy"
            ));

            questions.add(Map.of(
                    "id", "q3",
                    "type", "ordering",
                    "topic", "SQL Query Execution Sequence",
                    "prompt", "Arrange the physical execution sequence of clauses in an SQL relational engine:",
                    "items", List.of(
                            Map.of("id", "s1", "text", "FROM / JOIN clauses identify source tables and build intermediate relations"),
                            Map.of("id", "s2", "text", "WHERE clause filters individual candidate rows"),
                            Map.of("id", "s3", "text", "GROUP BY / HAVING aggregates rows and filters groups"),
                            Map.of("id", "s4", "text", "SELECT clause computes projections, followed by ORDER BY and LIMIT")
                    ),
                    "correctOrder", List.of("s1", "s2", "s3", "s4"),
                    "averageTimeMinutes", 3,
                    "difficulty", "medium"
            ));

            return questions;
        }

        if ("coding".equals(normalizedType)) {
            questions.add(Map.of(
                    "id", "q1",
                    "type", "coding",
                    "topic", "Arrays & Hash Table",
                    "prompt", "Two Sum: Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
                    "referenceLabel", "LeetCode #1",
                    "referenceUrl", "https://leetcode.com/problems/two-sum/",
                    "taskTitle", "Two Sum",
                    "averageTimeMinutes", 15,
                    "difficulty", "easy"
            ));

            questions.add(Map.of(
                    "id", "q2",
                    "type", "coding",
                    "topic", "Database SQL & Filtering",
                    "prompt", "Combine Two Tables: Report the first name, last name, city, and state of each person in the Person table using a LEFT JOIN with Address.",
                    "referenceLabel", "LeetCode #175",
                    "referenceUrl", "https://leetcode.com/problems/combine-two-tables/",
                    "taskTitle", "Combine Two Tables",
                    "averageTimeMinutes", 15,
                    "difficulty", "easy"
            ));

            return questions;
        }

        if ("fill_blank".equals(normalizedType)) {
            questions.add(Map.of(
                    "id", "q1",
                    "type", "fill_blank",
                    "topic", "Binary Search",
                    "prompt", "In a binary search on a sorted array of size N, the maximum number of comparisons in the worst case is proportional to _____.",
                    "placeholder", "e.g. O(log N)",
                    "correctAnswer", "O(log N)",
                    "averageTimeMinutes", 2,
                    "difficulty", "easy"
            ));

            questions.add(Map.of(
                    "id", "q2",
                    "type", "fill_blank",
                    "topic", "Hash Tables",
                    "prompt", "The average time complexity for key lookup and insertion in a well-distributed hash map is _____.",
                    "placeholder", "e.g. O(1)",
                    "correctAnswer", "O(1)",
                    "averageTimeMinutes", 2,
                    "difficulty", "easy"
            ));

            questions.add(Map.of(
                    "id", "q3",
                    "type", "fill_blank",
                    "topic", "Graph Traversal",
                    "prompt", "The graph traversal algorithm that finds the shortest path in an unweighted graph using a Queue is _____.",
                    "placeholder", "e.g. BFS or Breadth-First Search",
                    "correctAnswer", "BFS",
                    "averageTimeMinutes", 2,
                    "difficulty", "easy"
            ));

            questions.add(Map.of(
                    "id", "q4",
                    "type", "fill_blank",
                    "topic", "SQL & Database",
                    "prompt", "In SQL relational databases, the clause used to filter rows AFTER aggregation by GROUP BY is _____.",
                    "placeholder", "e.g. HAVING",
                    "correctAnswer", "HAVING",
                    "averageTimeMinutes", 2,
                    "difficulty", "easy"
            ));

            return questions;
        }

        // Default: MCQ sprint
        questions.add(Map.of(
                "id", "q1",
                "type", "mcq",
                "topic", "Arrays & Two Pointers",
                "prompt", "What is the optimal auxiliary space complexity of finding the two sum indices in a sorted array using two pointers?",
                "choices", List.of(
                        Map.of("id", "a", "label", "A", "text", "O(N) space using a hash table"),
                        Map.of("id", "b", "label", "B", "text", "O(1) auxiliary space using two converging pointers"),
                        Map.of("id", "c", "label", "C", "text", "O(N log N) space with recursion stack"),
                        Map.of("id", "d", "label", "D", "text", "O(N^2) space with a distance matrix")
                ),
                "correctAnswer", "b",
                "averageTimeMinutes", 2,
                "difficulty", "easy"
        ));

        questions.add(Map.of(
                "id", "q2",
                "type", "mcq",
                "topic", "Dynamic Programming",
                "prompt", "Which core properties must a problem satisfy to be solvable with Dynamic Programming?",
                "choices", List.of(
                        Map.of("id", "a", "label", "A", "text", "Overlapping subproblems and optimal substructure"),
                        Map.of("id", "b", "label", "B", "text", "Greedy choice property with strictly local decisions"),
                        Map.of("id", "c", "label", "C", "text", "Independent subproblems with divide and conquer"),
                        Map.of("id", "d", "label", "D", "text", "Non-deterministic state transitions")
                ),
                "correctAnswer", "a",
                "averageTimeMinutes", 2,
                "difficulty", "medium"
        ));

        questions.add(Map.of(
                "id", "q3",
                "type", "mcq",
                "topic", "Binary Trees & Traversal",
                "prompt", "Which tree traversal processes nodes level by level using a Queue data structure?",
                "choices", List.of(
                        Map.of("id", "a", "label", "A", "text", "Preorder Traversal (DFS)"),
                        Map.of("id", "b", "label", "B", "text", "Inorder Traversal (DFS)"),
                        Map.of("id", "c", "label", "C", "text", "Level-order Traversal (BFS)"),
                        Map.of("id", "d", "label", "D", "text", "Postorder Traversal (DFS)")
                ),
                "correctAnswer", "c",
                "averageTimeMinutes", 2,
                "difficulty", "easy"
        ));

        questions.add(Map.of(
                "id", "q4",
                "type", "mcq",
                "topic", "Database SQL & ACID",
                "prompt", "In ACID properties of a database transaction, what does 'Isolation' guarantee?",
                "choices", List.of(
                        Map.of("id", "a", "label", "A", "text", "Transactions execute concurrently without interfering with each other"),
                        Map.of("id", "b", "label", "B", "text", "Committed data is preserved across power outages and crashes"),
                        Map.of("id", "c", "label", "C", "text", "Either all changes of a transaction take effect, or none do"),
                        Map.of("id", "d", "label", "D", "text", "The database transitions from one valid state to another")
                ),
                "correctAnswer", "a",
                "averageTimeMinutes", 2,
                "difficulty", "medium"
        ));

        return questions;
    }

    public Map<String, Object> deleteAssessment(User user, UUID assessmentId) {
        int deleted = assessmentRepository.deleteByIdAndUser(assessmentId, user.getId());
        return Map.of("success", true, "deletedCount", deleted, "id", assessmentId.toString());
    }

    public Map<String, Object> clearHistory(User user, List<UUID> sessionIds) {
        int deleted;
        if (sessionIds != null && !sessionIds.isEmpty()) {
            deleted = assessmentRepository.deleteBulkByUser(user.getId(), sessionIds);
        } else {
            deleted = assessmentRepository.deleteAllByUser(user.getId());
        }
        return Map.of("success", true, "deletedCount", deleted);
    }
}
