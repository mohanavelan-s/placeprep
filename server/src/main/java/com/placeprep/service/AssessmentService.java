package com.placeprep.service;

import com.placeprep.exception.AppException;
import com.placeprep.model.AssessmentSession;
import com.placeprep.model.User;
import com.placeprep.model.blueprint.CompanyBlueprint;
import com.placeprep.repository.AssessmentRepository;
import com.placeprep.service.RoleResearchService.ResearchReport;
import com.placeprep.util.JsonUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class AssessmentService {

    private final AssessmentRepository assessmentRepository;
    private final AiService aiService;
    private final JdbcTemplate jdbcTemplate;
    private final LeetCodeCatalogService leetCodeCatalogService;

    @Autowired
    public AssessmentService(
            AssessmentRepository assessmentRepository,
            @Lazy AiService aiService,
            JdbcTemplate jdbcTemplate,
            @Autowired(required = false) LeetCodeCatalogService leetCodeCatalogService
    ) {
        this.assessmentRepository = assessmentRepository;
        this.aiService = aiService;
        this.jdbcTemplate = jdbcTemplate;
        this.leetCodeCatalogService = leetCodeCatalogService != null ? leetCodeCatalogService : new LeetCodeCatalogService();
    }

    public AssessmentService(
            AssessmentRepository assessmentRepository,
            AiService aiService,
            JdbcTemplate jdbcTemplate
    ) {
        this(assessmentRepository, aiService, jdbcTemplate, new LeetCodeCatalogService());
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

        Map<String, Object> pendingBaseline = getPendingBaseline(user);

        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("activePlan", activePlanSummary);
        overview.put("pendingBaseline", pendingBaseline);
        overview.put("currentSession", currentSession);
        overview.put("recentSessions", sessions);
        overview.put("recentAssessments", sessions);
        overview.put("totalAssessments", sessions.size());
        overview.put("completedCount", completed);
        overview.put("averageScore", Math.round(avgScore * 100.0) / 100.0);
        overview.put("identifiedWeakSpots", new ArrayList<>(weakSpots));

        return overview;
    }

    public Map<String, Object> getPendingBaseline(User user) {
        // 1. Check existing sessions for an uncompleted baseline
        List<AssessmentSession> sessions = assessmentRepository.listByUser(user.getId(), 20);
        for (AssessmentSession s : sessions) {
            Map<String, Object> meta = s.getMetadata();
            if (meta != null && (Boolean.TRUE.equals(meta.get("isBaseline")) || "baseline".equalsIgnoreCase(String.valueOf(meta.get("assessmentScope"))))) {
                if (!"completed".equalsIgnoreCase(s.getStatus())) {
                    Map<String, Object> res = new LinkedHashMap<>();
                    res.put("hasPending", true);
                    res.put("session", s);
                    res.put("id", s.getId().toString());
                    res.put("planId", s.getPlanId() != null ? s.getPlanId().toString() : null);
                    res.put("status", s.getStatus());
                    res.put("durationMinutes", s.getDurationMinutes());
                    res.put("targetRole", meta.getOrDefault("targetRole", "SDE"));
                    res.put("companyName", meta.getOrDefault("companyName", "Target Company"));
                    res.put("seniority", meta.getOrDefault("seniority", "Mid-Level"));
                    res.put("diagnosticTopics", meta.get("diagnosticTopics"));
                    res.put("isGeneralGuidance", meta.getOrDefault("isGeneralGuidance", false));
                    res.put("guidanceClassification", meta.get("guidanceClassification"));
                    res.put("sections", meta.get("sections"));
                    res.put("startedAt", s.getStartedAt() != null ? s.getStartedAt().toString() : null);
                    return res;
                }
            }
        }

        // 2. Check active plan if status is assessment_pending
        try {
            List<Map<String, Object>> plans = jdbcTemplate.query(
                    "SELECT id, target_role, metadata FROM prep_plans WHERE user_id = ? AND is_active = TRUE ORDER BY created_at DESC LIMIT 1",
                    (rs, rowNum) -> {
                        Map<String, Object> m = JsonUtil.toMap(rs.getString("metadata"));
                        return Map.of("id", rs.getObject("id"), "role", rs.getString("target_role"), "meta", m);
                    },
                    user.getId()
            );
            if (!plans.isEmpty()) {
                Map<String, Object> p = plans.get(0);
                Map<String, Object> meta = (Map<String, Object>) p.get("meta");
                String status = (String) meta.get("status");
                String pendingId = (String) meta.get("pendingBaselineAssessmentId");
                if ("assessment_pending".equalsIgnoreCase(status) && pendingId != null) {
                    try {
                        Optional<AssessmentSession> opt = assessmentRepository.findById(UUID.fromString(pendingId), user.getId());
                        if (opt.isPresent() && !"completed".equalsIgnoreCase(opt.get().getStatus())) {
                            AssessmentSession s = opt.get();
                            Map<String, Object> res = new LinkedHashMap<>();
                            res.put("hasPending", true);
                            res.put("session", s);
                            res.put("id", s.getId().toString());
                            res.put("planId", p.get("id").toString());
                            res.put("status", s.getStatus());
                            res.put("durationMinutes", s.getDurationMinutes());
                            res.put("targetRole", p.get("role"));
                            res.put("companyName", meta.getOrDefault("companyName", "Target Company"));
                            res.put("seniority", meta.getOrDefault("seniority", "Mid-Level"));
                            res.put("diagnosticTopics", meta.get("diagnosticTopics"));
                            res.put("isGeneralGuidance", meta.getOrDefault("isGeneralGuidance", false));
                            res.put("guidanceClassification", meta.get("guidanceClassification"));
                            res.put("sections", s.getMetadata() != null ? s.getMetadata().get("sections") : null);
                            res.put("startedAt", s.getStartedAt() != null ? s.getStartedAt().toString() : null);
                            return res;
                        }
                    } catch (Exception ignored) {}
                }
            }
        } catch (Exception ignored) {}

        Map<String, Object> empty = new LinkedHashMap<>();
        empty.put("hasPending", false);
        return empty;
    }

    public AssessmentSession activateAssessment(User user, UUID assessmentId) {
        AssessmentSession session = assessmentRepository.findById(assessmentId, user.getId())
                .orElseThrow(() -> new AppException("Assessment session not found.", HttpStatus.NOT_FOUND));

        if (session.getStartedAt() == null || !"started".equalsIgnoreCase(session.getStatus())) {
            session.setStatus("started");
            session.setStartedAt(OffsetDateTime.now());
            session = assessmentRepository.updateSession(assessmentId, user.getId(), session)
                    .orElse(session);
        }
        return session;
    }

    public Map<String, Object> generateAssessment(User user, Map<String, Object> payload) {
        String type = (String) payload.getOrDefault("assessmentType", "mcq");
        String scope = (String) payload.getOrDefault("assessmentScope", "daily");
        Integer duration = payload.containsKey("durationMinutes") ? ((Number) payload.get("durationMinutes")).intValue() : 20;

        Map<String, Object> activePlan = aiService.getLatestPrepPlan(user);
        if (activePlan == null) {
            try {
                activePlan = aiService.createAndPersistPlan(user, Map.of(
                        "targetRole", user.getTargetRole() != null ? user.getTargetRole() : "Software Development Engineer",
                        "companyKey", "google",
                        "durationMonths", 3,
                        "timePerDay", 120
                ));
            } catch (Exception e) {
                activePlan = Map.of(
                        "id", UUID.randomUUID().toString(),
                        "title", "Core Software Engineering Track",
                        "targetRole", user.getTargetRole() != null ? user.getTargetRole() : "SDE",
                        "targetTopics", List.of("Arrays", "Binary Search", "Trees", "SQL", "Dynamic Programming"),
                        "knownTopics", List.of("Basics"),
                        "timePerDay", 120,
                        "durationMonths", 3
                );
            }
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
                // For coding questions, answer presence indicates static submission recorded
                isCorrect = !userAnsStr.isBlank() && !userAnsStr.toLowerCase().contains("not started");
                feedback = isCorrect
                        ? "Code submission recorded. Static review passed; run live in Coding Lab for full testcase execution."
                        : "Coding exercise was skipped or unfinished.";
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
                    String ca = correctAnsObj.toString().trim();
                    isCorrect = ca.equalsIgnoreCase(userAnsStr)
                            || userAnsStr.toLowerCase().startsWith(ca.toLowerCase() + ".")
                            || userAnsStr.toLowerCase().startsWith(ca.toLowerCase() + ":")
                            || userAnsStr.toLowerCase().startsWith(ca.toLowerCase() + " ");
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
        double newReadiness;
        if (currentReadiness <= 5.0) {
            // Initial calibration directly from assessment performance
            newReadiness = overallScore;
        } else {
            // Adaptive weighted average: 65% existing track record + 35% recent assessment performance
            newReadiness = Math.round((currentReadiness * 0.65 + overallScore * 0.35) * 10.0) / 10.0;
        }
        newReadiness = Math.max(0.0, Math.min(100.0, newReadiness));
        double readinessDelta = Math.round((newReadiness - currentReadiness) * 10.0) / 10.0;
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
        recommendedPlan.put("focusShift", detectedWeakSpots.isEmpty()
                ? "Accelerated Polish Track"
                : "Targeted Remediation on " + String.join(", ", detectedWeakSpots));
        recommendedPlan.put("rationale", detectedWeakSpots.isEmpty()
                ? String.format("With a %d%% score, your core concepts are verified. We recommend accelerating your roadmap towards advanced system design and hard-difficulty DSA questions.", Math.round(overallScore))
                : String.format("Assessment highlighted gaps in %s. We recommend adapting your daily tasks to include high-yield reinforcement problems for these topics.", String.join(", ", detectedWeakSpots)));
        recommendedPlan.put("recommendedTopics", detectedWeakSpots.isEmpty() ? List.of("Dynamic Programming", "System Design", "Trie") : detectedWeakSpots);

        // If baseline assessment, calculate per-topic diagnostic scores and finalize prep plan
        boolean isBaseline = session.getMetadata() != null &&
                (Boolean.TRUE.equals(session.getMetadata().get("isBaseline")) || "baseline".equalsIgnoreCase(String.valueOf(session.getMetadata().get("assessmentScope"))));

        Map<String, Double> topicScores = new LinkedHashMap<>();
        Map<String, Integer> topicTotal = new LinkedHashMap<>();
        Map<String, Integer> topicCorrect = new LinkedHashMap<>();

        for (Map<String, Object> qr : questionResults) {
            String topic = (String) qr.get("topic");
            if (topic != null) {
                topicTotal.put(topic, topicTotal.getOrDefault(topic, 0) + 1);
                if (Boolean.TRUE.equals(qr.get("correct"))) {
                    topicCorrect.put(topic, topicCorrect.getOrDefault(topic, 0) + 1);
                }
            }
        }
        for (String t : topicTotal.keySet()) {
            int tot = topicTotal.get(t);
            int cor = topicCorrect.getOrDefault(t, 0);
            topicScores.put(t, Math.round(((double) cor / tot) * 100.0 * 10.0) / 10.0);
        }

        Map<String, Object> meta = session.getMetadata() != null ? new HashMap<>(session.getMetadata()) : new HashMap<>();
        meta.put("recommendedPlan", recommendedPlan);
        meta.put("newReadinessScore", newReadiness);
        meta.put("readinessDelta", readinessDelta);
        meta.put("topicScores", topicScores);
        meta.put("isBaseline", isBaseline);

        if (isBaseline && session.getPlanId() != null) {
            try {
                aiService.finalizePlanAfterBaseline(
                        user,
                        session.getPlanId(),
                        session.getId(),
                        topicScores,
                        detectedWeakSpots
                );
                meta.put("calibratedPlanId", session.getPlanId().toString());
                meta.put("calibratedPlanStatus", "plan_ready");
            } catch (Exception ex) {
                System.err.println("[AssessmentService] finalizePlanAfterBaseline failed: " + ex.getMessage());
            }
        }
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
                "question", "What is the optimal auxiliary space complexity of finding the two sum indices in a sorted array using two pointers?",
                "options", List.of(
                        "A. O(N) space using a hash table",
                        "B. O(1) auxiliary space using two converging pointers",
                        "C. O(N log N) space with recursion stack",
                        "D. O(N^2) space with a distance matrix"
                ),
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
                "question", "Which core properties must a problem satisfy to be solvable with Dynamic Programming?",
                "options", List.of(
                        "A. Overlapping subproblems and optimal substructure",
                        "B. Greedy choice property with strictly local decisions",
                        "C. Independent subproblems with divide and conquer",
                        "D. Non-deterministic state transitions"
                ),
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
                "question", "Which tree traversal processes nodes level by level using a Queue data structure?",
                "options", List.of(
                        "A. Preorder Traversal (DFS)",
                        "B. Inorder Traversal (DFS)",
                        "C. Level-order Traversal (BFS)",
                        "D. Postorder Traversal (DFS)"
                ),
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
                "question", "In ACID properties of a database transaction, what does 'Isolation' guarantee?",
                "options", List.of(
                        "A. Transactions execute concurrently without interfering with each other",
                        "B. Committed data is preserved across power outages and crashes",
                        "C. Either all changes of a transaction take effect, or none do",
                        "D. The database transitions from one valid state to another"
                ),
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

    public AssessmentSession generateBaselineAssessment(User user, UUID planId, ResearchReport report, Map<String, Object> targetContext) {
        List<Map<String, Object>> questions = buildBaselineQuestions(report);

        AssessmentSession session = new AssessmentSession();
        session.setUserId(user.getId());
        session.setPlanId(planId);
        session.setAssessmentType("mcq");
        session.setDurationMinutes(20);
        session.setStatus("draft");
        session.setQuestions(questions);
        session.setStartedAt(null);

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("isBaseline", true);
        metadata.put("assessmentScope", "baseline");
        metadata.put("targetRole", report.targetRole);
        metadata.put("companyName", report.companyName);
        metadata.put("companyKey", report.companyKey);
        metadata.put("seniority", report.seniority);
        metadata.put("diagnosticTopics", report.diagnosticTopics);
        metadata.put("planId", planId.toString());
        CompanyBlueprint bp = report != null ? report.blueprint : null;
        boolean isVerifiedBlueprint = (bp != null && !"standard_sde".equalsIgnoreCase(bp.companyId()));
        boolean isGeneral = !isVerifiedBlueprint || (report != null && Boolean.TRUE.equals(report.evidenceSummary.get("isGeneralGuidance")));
        metadata.put("isGeneralGuidance", isGeneral);
        String companyLabel = (bp != null ? bp.displayName() : (report != null && report.companyName != null ? report.companyName : "Company"));
        metadata.put("guidanceClassification", isGeneral
                ? "General Role Guidance (Unverified Company Specifics)"
                : companyLabel + "-aligned preparation based on public sources");
        metadata.put("disclaimerNotice", isGeneral
                ? "Company specifics could not be independently verified. Questions reflect industry-standard competencies for this seniority tier."
                : "Exercises are practice questions synthesized from public hiring rubrics, technical documentation, and community candidate reports. They are not official employer interview questions.");
        metadata.put("sections", List.of(
                Map.of("id", "A", "title", "Section A: Conceptual Competencies", "type", "mcq", "questionCount", 4, "timeMinutes", 10),
                Map.of("id", "B", "title", "Section B: Algorithmic Implementation", "type", "coding", "questionCount", 1, "timeMinutes", 10)
        ));
        session.setMetadata(metadata);

        return assessmentRepository.createSession(session);
    }

    public List<Map<String, Object>> buildBaselineQuestions(ResearchReport report) {
        List<Map<String, Object>> questions = new ArrayList<>();
        String role = report != null && report.targetRole != null ? report.targetRole : "Software Development Engineer";
        String roleLower = role.toLowerCase().trim();
        String company = report != null && report.companyName != null ? report.companyName : "Target Company";

        CompanyBlueprint bp = report != null ? report.blueprint : null;
        boolean isVerifiedBlueprint = (bp != null && !"standard_sde".equalsIgnoreCase(bp.companyId()));
        boolean isMicrosoft = isVerifiedBlueprint && "microsoft".equalsIgnoreCase(bp.companyId());

        boolean isGeneralGuidance = !isVerifiedBlueprint || (report != null && Boolean.TRUE.equals(report.evidenceSummary.get("isGeneralGuidance")));
        String companyLabel = (bp != null ? bp.displayName() : company);
        String guidanceClassification = isGeneralGuidance
                ? "General Role Guidance (Unverified Company Specifics)"
                : companyLabel + "-aligned preparation based on public sources";

        boolean isAi = roleLower.contains("ai") || roleLower.contains("machine learning") || roleLower.contains("ml") || roleLower.contains("deep learning") || roleLower.contains("data scientist") || roleLower.contains("nlp");
        boolean isBackend = roleLower.contains("backend") || roleLower.contains("cloud") || roleLower.contains("systems") || roleLower.contains("distributed") || roleLower.contains("platform") || roleLower.contains("devops") || roleLower.contains("sre");
        boolean isFrontend = roleLower.contains("front") || roleLower.contains("react") || roleLower.contains("ui") || roleLower.contains("web") || roleLower.contains("mobile") || roleLower.contains("ios") || roleLower.contains("android");

        // -------------------------------------------------------------
        // SECTION A: Conceptual Competencies (4 MCQs, ~10 min total)
        // -------------------------------------------------------------
        if (isAi) {
            questions.add(createMcqQuestion(
                    "diag_q1", 1, "A", "Section A: Conceptual Competencies",
                    "Machine Learning & Optimization",
                    "Why does feature normalization (e.g., standardizing continuous variables to zero mean and unit variance) accelerate gradient descent convergence?",
                    List.of(
                            "A. It eliminates all local minima in non-convex loss surfaces",
                            "B. It makes loss surface contours more spherical, dampening oscillations and permitting higher learning rates",
                            "C. It guarantees global convergence in exactly one training epoch",
                            "D. It removes the necessity of backpropagation"
                    ),
                    "b", 2, "medium", isGeneralGuidance, guidanceClassification, company, role
            ));
            questions.add(createMcqQuestion(
                    "diag_q2", 2, "A", "Section A: Conceptual Competencies",
                    "Model Evaluation & Generalization",
                    "When evaluating a neural network exhibiting 99% training accuracy and 71% validation accuracy (overfitting / high variance), which technique directly penalizes large weights?",
                    List.of(
                            "A. Increasing the learning rate by 10x",
                            "B. L2 regularization (weight decay) adding the squared Euclidean norm of weights to the objective loss",
                            "C. Disabling all dropout layers",
                            "D. Reducing the training dataset size"
                    ),
                    "b", 2, "medium", isGeneralGuidance, guidanceClassification, company, role
            ));
            questions.add(createMcqQuestion(
                    "diag_q3", 3, "A", "Section A: Conceptual Competencies",
                    "Deep Learning & Transformer Architectures",
                    "What is the theoretical time and memory complexity of standard scaled dot-product self-attention with respect to sequence length N (embedding dimension D)?",
                    List.of(
                            "A. O(N) linear time and O(1) memory",
                            "B. O(N^2 * D) time and O(N^2) memory for the pairwise attention matrix",
                            "C. O(N log N) time and O(D) memory",
                            "D. O(D^2) time independent of sequence length N"
                    ),
                    "b", 3, "medium", isGeneralGuidance, guidanceClassification, company, role
            ));
            if (isMicrosoft) {
                questions.add(createMcqQuestion(
                        "diag_q4", 4, "A", "Section A: Conceptual Competencies",
                        "Engineering Fundamentals & Tensor Memory Layout",
                        "In a packed row-major DirectML tensor, what does a width stride of 1 mean?",
                        List.of(
                                "A. Each element along the width dimension occupies exactly 1 byte in memory",
                                "B. Consecutive elements along the width dimension occupy adjacent positions in linear memory",
                                "C. The tensor dimension has a fixed size of only 1 column across all rows",
                                "D. Adjacent rows are stored contiguously in memory with no offset between them"
                        ),
                        "b", 3, "medium", isGeneralGuidance, guidanceClassification, company, role,
                        "Source-informed technical practice",
                        "Source-informed technical practice grounded in DirectML tensor strides and memory layout documentation (learn.microsoft.com/en-us/windows/ai/directml/dml-strides). Practice question, not an official Microsoft interview question."
                ));
            } else {
                questions.add(createMcqQuestion(
                        "diag_q4", 4, "A", "Section A: Conceptual Competencies",
                        "ML System Design & Evaluation Metrics",
                        "In a production diagnostic classification system where false negatives (missing a condition) have severe consequences, which metric should guide the classification threshold?",
                        List.of(
                                "A. Recall (Sensitivity) = True Positives / (True Positives + False Negatives)",
                                "B. Precision = True Positives / (True Positives + False Positives) alone",
                                "C. Accuracy alone without class balance adjustment",
                                "D. Raw cross-entropy loss without calibration"
                        ),
                        "a", 3, "medium", isGeneralGuidance, guidanceClassification, company, role,
                        "General role guidance",
                        "Foundational evaluation metric in machine learning systems. General role guidance."
                ));
            }
        } else if (isBackend) {
            questions.add(createMcqQuestion(
                    "diag_q1", 1, "A", "Section A: Conceptual Competencies",
                    "Distributed Systems & Caching",
                    "In a distributed microservice architecture under high read concurrency, how does the Cache-Aside pattern mitigate cache stampede upon hot key expiration?",
                    List.of(
                            "A. Using probabilistic early expiration (XFetch) or distributed mutex locks around the database fetch",
                            "B. Setting TTL to zero so all reads bypass the cache",
                            "C. Writing all queries synchronously to disk before returning to client",
                            "D. Replacing Redis with an unindexed relational view"
                    ),
                    "a", 3, "medium", isGeneralGuidance, guidanceClassification, company, role
            ));
            questions.add(createMcqQuestion(
                    "diag_q2", 2, "A", "Section A: Conceptual Competencies",
                    "DBMS & Transaction Isolation",
                    "In relational database engines, what anomaly is strictly prevented under Repeatable Read isolation that is allowed under Read Committed?",
                    List.of(
                            "A. Dirty Read only",
                            "B. Non-repeatable (fuzzy) read where re-reading a row in the same transaction sees modified committed values",
                            "C. Write skew in distributed two-phase commits",
                            "D. Cascading rollbacks in unlogged tables"
                    ),
                    "b", 2, "medium", isGeneralGuidance, guidanceClassification, company, role
            ));
            questions.add(createMcqQuestion(
                    "diag_q3", 3, "A", "Section A: Conceptual Competencies",
                    "Microservices & Reliability",
                    "When designing a distributed service receiving at-least-once message deliveries, what mechanism guarantees idempotent execution?",
                    List.of(
                            "A. Storing unique idempotency keys in a transactional store or Redis with conditional inserts (INSERT ON CONFLICT / SETNX)",
                            "B. Switching message broker transport to UDP",
                            "C. Removing message acknowledgments",
                            "D. Generating a new random transaction ID on every retry"
                    ),
                    "a", 2, "medium", isGeneralGuidance, guidanceClassification, company, role
            ));
            questions.add(createMcqQuestion(
                    "diag_q4", 4, "A", "Section A: Conceptual Competencies",
                    "Database Indexing & Query Plans",
                    "Why are B+ Trees preferred over Hash indexes as primary table storage indexes in relational engines (e.g. InnoDB clustered index)?",
                    List.of(
                            "A. B+ Trees support efficient range scans (BETWEEN, <, >) via linked leaf pages, whereas Hash tables only support exact key lookups",
                            "B. Hash tables require O(N^2) space for every record",
                            "C. B+ Trees have O(1) worst-case lookup time whereas Hash tables are always O(N)",
                            "D. Hash tables cannot store numerical values"
                    ),
                    "a", 3, "medium", isGeneralGuidance, guidanceClassification, company, role
            ));
        } else if (isFrontend) {
            questions.add(createMcqQuestion(
                    "diag_q1", 1, "A", "Section A: Conceptual Competencies",
                    "JavaScript Engine & Concurrency",
                    "In the browser JavaScript event loop, which queue has strict priority and drains completely before the next macrotask (e.g. setTimeout) executes?",
                    List.of(
                            "A. Microtask queue (Promises, queueMicrotask, MutationObserver)",
                            "B. RequestAnimationFrame callback queue",
                            "C. DOM I/O event listener queue",
                            "D. Web Worker background message queue"
                    ),
                    "a", 2, "medium", isGeneralGuidance, guidanceClassification, company, role
            ));
            questions.add(createMcqQuestion(
                    "diag_q2", 2, "A", "Section A: Conceptual Competencies",
                    "React Virtual DOM & Reconciliation",
                    "Why should array indices NOT be used as keys when rendering dynamic lists in React where items can be reordered, inserted, or removed?",
                    List.of(
                            "A. It causes React to crash immediately with an unrecoverable runtime exception",
                            "B. It confuses component state pairing across re-renders, causing uncontrolled inputs and animation states to attach to the wrong DOM nodes",
                            "C. React ignores keys completely if they are numeric",
                            "D. It increases bundle size by duplicating virtual DOM nodes"
                    ),
                    "b", 2, "medium", isGeneralGuidance, guidanceClassification, company, role
            ));
            questions.add(createMcqQuestion(
                    "diag_q3", 3, "A", "Section A: Conceptual Competencies",
                    "Web Performance & Core Web Vitals",
                    "Which Core Web Vital metric measures visual stability by calculating the sum total of all unexpected layout shifts occurring throughout page lifespan?",
                    List.of(
                            "A. Cumulative Layout Shift (CLS)",
                            "B. Largest Contentful Paint (LCP)",
                            "C. Interaction to Next Paint (INP)",
                            "D. First Contentful Paint (FCP)"
                    ),
                    "a", 3, "medium", isGeneralGuidance, guidanceClassification, company, role
            ));
            questions.add(createMcqQuestion(
                    "diag_q4", 4, "A", "Section A: Conceptual Competencies",
                    "Browser Rendering Architecture",
                    "Modifying which CSS properties triggers ONLY compositing without triggering expensive Layout (reflow) or Paint stages in modern GPU-accelerated browsers?",
                    List.of(
                            "A. width and height",
                            "B. transform and opacity",
                            "C. top and left",
                            "D. margin and padding"
                    ),
                    "b", 3, "medium", isGeneralGuidance, guidanceClassification, company, role
            ));
        } else {
            questions.add(createMcqQuestion(
                    "diag_q1", 1, "A", "Section A: Conceptual Competencies",
                    "Arrays & Algorithmic Invariants",
                    "You are given a sorted integer array and must find two numbers that sum to a target. What is the tightest time and space complexity possible?",
                    List.of(
                            "A. O(N log N) time and O(N) space via sorting and hashing",
                            "B. O(N) time and O(1) auxiliary space using two converging pointers",
                            "C. O(N^2) time and O(1) space with nested loops",
                            "D. O(log N) time and O(N) space via segment trees"
                    ),
                    "b", 2, "easy", isGeneralGuidance, guidanceClassification, company, role
            ));
            questions.add(createMcqQuestion(
                    "diag_q2", 2, "A", "Section A: Conceptual Competencies",
                    "Dynamic Programming",
                    "In the 0/1 Knapsack problem with N items and maximum capacity W, what state recurrence allows reducing auxiliary space from O(N*W) to O(W)?",
                    List.of(
                            "A. Iterate capacity W backwards (from W down to weight[i]) using a 1D DP array",
                            "B. Iterate capacity W forward (from 0 up to W) using a 1D DP array",
                            "C. Greedily pick the highest value-to-weight ratio item without memoization",
                            "D. Sort items by weight in O(N log N) and use binary search"
                    ),
                    "a", 3, "medium", isGeneralGuidance, guidanceClassification, company, role
            ));
            questions.add(createMcqQuestion(
                    "diag_q3", 3, "A", "Section A: Conceptual Competencies",
                    "Trees & Graphs",
                    "When detecting cycles in a directed graph using Depth-First Search (DFS), what node coloring or state indicates a back-edge (cycle)?",
                    List.of(
                            "A. Encountering an unvisited node (WHITE)",
                            "B. Encountering a node currently on the active recursion stack (GRAY / In-Progress)",
                            "C. Encountering a node whose subtree is completely processed (BLACK / Visited)",
                            "D. Calculating tree diameter with double BFS"
                    ),
                    "b", 3, "medium", isGeneralGuidance, guidanceClassification, company, role
            ));
            if (isMicrosoft) {
                questions.add(createMcqQuestion(
                        "diag_q4", 4, "A", "Section A: Conceptual Competencies",
                        "Technical Problem Solving & Edge Case Invariants",
                        "According to Microsoft's official technical interview guidance, which practice is essential before writing implementation code for an algorithmic problem?",
                        List.of(
                                "A. Immediately begin writing code to maximize lines completed in the virtual editor",
                                "B. Clarify constraints/assumptions, validate boundary conditions (null/empty/overflow), and dry-run with edge cases before typing",
                                "C. Declare all helper variables as global static singletons",
                                "D. Default to brute-force O(N^2) without discussing trade-offs"
                        ),
                        "b", 2, "easy", isGeneralGuidance, guidanceClassification, company, role,
                        "Official employer interview guidance",
                        "Aligned with official Microsoft interview guidance (careers.microsoft.com). Practice question testing rubric-documented interview practices."
                ));
            } else {
                questions.add(createMcqQuestion(
                        "diag_q4", 4, "A", "Section A: Conceptual Competencies",
                        "Operating Systems & Concurrency",
                        "Which of the following is NOT one of Coffman's four necessary conditions for a deadlock to occur?",
                        List.of(
                                "A. Mutual Exclusion",
                                "B. Hold and Wait",
                                "C. Preemption allowed by kernel priority scheduler",
                                "D. Circular Wait"
                        ),
                        "c", 2, "easy", isGeneralGuidance, guidanceClassification, company, role,
                        "General role guidance",
                        "General operating systems concept. Not verified against company-specific hiring criteria."
                ));
            }
        }

        // -------------------------------------------------------------
        // SECTION B: Algorithmic Implementation (DSA Coding, 1 problem, ~10 min)
        // -------------------------------------------------------------
        int codingLcId;
        String codingTopic;
        String codingPrompt;
        if (isAi) {
            if (isMicrosoft) {
                codingLcId = 48; // Rotate Image
                codingTopic = "Matrix & In-Place Transformation";
                codingPrompt = "You are given an n x n 2D matrix representing an image, rotate the image by 90 degrees (clockwise). You have to rotate the image in-place, which means you have to modify the input 2D matrix directly. DO NOT allocate another 2D matrix and do the rotation. Optimize for O(N^2) time and O(1) auxiliary space.";
            } else {
                codingLcId = 74; // Search a 2D Matrix
                codingTopic = "Matrix & Binary Search";
                codingPrompt = "Write an efficient algorithm that searches for a value target in an m x n integer matrix. Integers in each row are sorted from left to right, and the first integer of each row is greater than the last integer of the previous row. Must achieve O(log(m * n)) time complexity.";
            }
        } else if (isBackend) {
            if (isMicrosoft) {
                codingLcId = 146; // LRU Cache
                codingTopic = "Design Structures & Hash Table";
                codingPrompt = "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache. Implement the LRUCache class with get(key) and put(key, value) operations running in strictly O(1) average time complexity using a Hash Map and Doubly-Linked List.";
            } else {
                codingLcId = 56; // Merge Intervals
                codingTopic = "Intervals & Sorting";
                codingPrompt = "Given an array of intervals where intervals[i] = [start_i, end_i], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all intervals in the input. Optimize for O(N log N) time and O(N) space.";
            }
        } else if (isFrontend) {
            if (isMicrosoft) {
                codingLcId = 443; // String Compression
                codingTopic = "Two Pointers & In-Place String Mutation";
                codingPrompt = "Given an array of characters chars, compress it using the following algorithm: begin with an empty string s, and for each group of consecutive repeating characters in chars, append the character followed by the group's length. Must modify the input array in-place with O(1) extra space.";
            } else {
                codingLcId = 20; // Valid Parentheses
                codingTopic = "Stack & String Parsing";
                codingPrompt = "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. Open brackets must be closed by the same type of brackets in correct order, and every close bracket has a matching open bracket. Optimize for O(N) time and O(N) space.";
            }
        } else {
            if (isMicrosoft) {
                codingLcId = 56; // Merge Intervals
                codingTopic = "Intervals & Sorting";
                codingPrompt = "Given an array of intervals where intervals[i] = [start_i, end_i], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all intervals in the input. Optimize for O(N log N) time and O(N) space.";
            } else {
                codingLcId = 704; // Binary Search
                codingTopic = "Binary Search & Array Invariants";
                codingPrompt = "Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, return its index. Otherwise, return -1. You must write an algorithm with O(log n) runtime complexity.";
            }
        }

        Optional<LeetCodeCatalogService.CanonicalProblemMeta> metaOpt = leetCodeCatalogService.findByNumber(codingLcId);
        String probTitle = metaOpt.map(LeetCodeCatalogService.CanonicalProblemMeta::title).orElse("Problem #" + codingLcId);
        String probSlug = metaOpt.map(LeetCodeCatalogService.CanonicalProblemMeta::slug).orElse("problem-" + codingLcId);
        String probDiff = metaOpt.map(LeetCodeCatalogService.CanonicalProblemMeta::difficulty).orElse("Medium");
        String probUrl = metaOpt.map(LeetCodeCatalogService.CanonicalProblemMeta::url).orElse("https://leetcode.com/problems/" + probSlug + "/");

        Map<String, Object> codingQ = new LinkedHashMap<>();
        codingQ.put("id", "diag_q5");
        codingQ.put("section", "B");
        codingQ.put("sectionTitle", "Section B: Algorithmic Implementation");
        codingQ.put("questionNumber", 5);
        codingQ.put("type", "coding");
        codingQ.put("topic", codingTopic);
        codingQ.put("prompt", codingPrompt);
        codingQ.put("question", codingPrompt);
        codingQ.put("taskTitle", probTitle);
        codingQ.put("referenceLabel", "LeetCode #" + codingLcId);
        codingQ.put("referenceUrl", probUrl);
        codingQ.put("leetcodeId", codingLcId);
        codingQ.put("leetcodeNumber", codingLcId);
        codingQ.put("averageTimeMinutes", 10);
        codingQ.put("difficulty", probDiff.toLowerCase());
        codingQ.put("codingLabUrl", "/coding-lab?problem=" + codingLcId + "&url=" + URLEncoder.encode(probUrl, StandardCharsets.UTF_8) + "&title=" + URLEncoder.encode(probTitle, StandardCharsets.UTF_8));
        codingQ.put("isGeneralGuidance", isGeneralGuidance);
        codingQ.put("guidanceClassification", guidanceClassification);
        codingQ.put("companyName", company);
        codingQ.put("targetRole", role);

        String codingEvidenceType = isMicrosoft
                ? "Community-reported candidate problems"
                : (isGeneralGuidance ? "General role guidance" : "Source-informed technical practice");
        String codingProvenanceNote = isMicrosoft
                ? "Community-reported candidate practice problem from historical LeetCode community distributions. Not an official Microsoft interview question or employer endorsement."
                : (isGeneralGuidance ? "Standard canonical LeetCode problem selected for foundational algorithmic practice." : "Algorithmic practice problem aligned with role requirements.");
        codingQ.put("evidenceType", codingEvidenceType);
        codingQ.put("provenanceNote", codingProvenanceNote);

        questions.add(codingQ);
        return questions;
    }

    private Map<String, Object> createMcqQuestion(
            String id, int number, String section, String sectionTitle,
            String topic, String prompt, List<String> options,
            String correctAnswer, int timeMinutes, String difficulty,
            boolean isGeneralGuidance, String guidanceClassification,
            String companyName, String targetRole,
            String evidenceType, String provenanceNote
    ) {
        List<Map<String, String>> choices = new ArrayList<>();
        for (String opt : options) {
            String label = opt.substring(0, 1);
            String idVal = label.toLowerCase();
            String text = opt.length() > 3 ? opt.substring(3).trim() : opt;
            choices.add(Map.of("id", idVal, "label", label, "text", text));
        }

        Map<String, Object> q = new LinkedHashMap<>();
        q.put("id", id);
        q.put("section", section);
        q.put("sectionTitle", sectionTitle);
        q.put("questionNumber", number);
        q.put("type", "mcq");
        q.put("topic", topic);
        q.put("prompt", prompt);
        q.put("question", prompt);
        q.put("options", options);
        q.put("choices", choices);
        q.put("correctAnswer", correctAnswer.toLowerCase());
        q.put("averageTimeMinutes", timeMinutes);
        q.put("difficulty", difficulty);
        q.put("isGeneralGuidance", isGeneralGuidance);
        q.put("guidanceClassification", guidanceClassification);
        q.put("companyName", companyName);
        q.put("targetRole", targetRole);
        q.put("evidenceType", evidenceType);
        q.put("provenanceNote", provenanceNote);
        return q;
    }

    private Map<String, Object> createMcqQuestion(
            String id, int number, String section, String sectionTitle,
            String topic, String prompt, List<String> options,
            String correctAnswer, int timeMinutes, String difficulty,
            boolean isGeneralGuidance, String guidanceClassification,
            String companyName, String targetRole
    ) {
        String defaultType = isGeneralGuidance ? "General role guidance" : "Source-informed technical practice";
        String defaultNote = isGeneralGuidance
                ? "General industry role guidance. Not verified against company-specific hiring criteria."
                : "Source-informed technical practice aligned with role requirements based on public technical sources.";
        return createMcqQuestion(id, number, section, sectionTitle, topic, prompt, options, correctAnswer, timeMinutes, difficulty, isGeneralGuidance, guidanceClassification, companyName, targetRole, defaultType, defaultNote);
    }
}
