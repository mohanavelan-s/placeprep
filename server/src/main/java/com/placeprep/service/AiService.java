package com.placeprep.service;

import com.placeprep.exception.AppException;
import com.placeprep.model.AssessmentSession;
import com.placeprep.model.Task;
import com.placeprep.model.User;
import com.placeprep.model.blueprint.CompanyBlueprint;
import com.placeprep.repository.TaskRepository;
import com.placeprep.service.RoleResearchService.ResearchReport;
import com.placeprep.util.JsonUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
public class AiService {

    private final TaskRepository taskRepository;
    private final JdbcTemplate jdbcTemplate;
    private final RoleResearchService roleResearchService;
    private final LeetCodeCatalogService leetCodeCatalogService;
    private final AssessmentService assessmentService;
    private final RestClient restClient;
    private final RestClient geminiClient;
    private final String apiKey;
    private final String baseUrl;
    private final String model;
    private final String provider;

    private final String geminiApiKey;
    private final String geminiModel;
    private final String geminiBaseUrl;

    private volatile boolean openRouterExhausted = false;

    public AiService(
            TaskRepository taskRepository,
            JdbcTemplate jdbcTemplate,
            RoleResearchService roleResearchService,
            @Autowired(required = false) LeetCodeCatalogService leetCodeCatalogService,
            @Lazy AssessmentService assessmentService,
            @Value("${placeprep.ai.api-key:}") String apiKey,
            @Value("${placeprep.ai.base-url:https://openrouter.ai/api/v1}") String baseUrl,
            @Value("${placeprep.ai.model:openai/gpt-5.1}") String model,
            @Value("${placeprep.ai.provider:openrouter}") String provider,
            @Value("${placeprep.ai.gemini-api-key:}") String geminiApiKey,
            @Value("${placeprep.ai.gemini-model:gemini-3.5-flash-lite}") String geminiModel,
            @Value("${placeprep.ai.gemini-base-url:https://generativelanguage.googleapis.com/v1beta/openai}") String geminiBaseUrl
    ) {
        this.taskRepository = taskRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.roleResearchService = roleResearchService;
        this.leetCodeCatalogService = leetCodeCatalogService != null ? leetCodeCatalogService : new LeetCodeCatalogService();
        this.assessmentService = assessmentService;
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.baseUrl = baseUrl != null ? baseUrl.trim().replaceAll("/$", "") : "https://openrouter.ai/api/v1";
        this.model = model != null ? model.trim() : "openai/gpt-5.1";
        this.provider = provider != null ? provider.trim() : "openrouter";

        org.springframework.http.client.SimpleClientHttpRequestFactory factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(java.time.Duration.ofSeconds(3));
        factory.setReadTimeout(java.time.Duration.ofSeconds(6));
        this.restClient = RestClient.builder().requestFactory(factory).baseUrl(this.baseUrl).build();

        this.geminiApiKey = geminiApiKey != null ? geminiApiKey.trim() : "";
        this.geminiModel = geminiModel != null && !geminiModel.isBlank() ? geminiModel.trim() : "gemini-3.5-flash-lite";
        this.geminiBaseUrl = geminiBaseUrl != null && !geminiBaseUrl.isBlank() ? geminiBaseUrl.trim().replaceAll("/$", "") : "https://generativelanguage.googleapis.com/v1beta/openai";

        org.springframework.http.client.SimpleClientHttpRequestFactory geminiFactory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        geminiFactory.setConnectTimeout(java.time.Duration.ofSeconds(5));
        geminiFactory.setReadTimeout(java.time.Duration.ofSeconds(25));
        this.geminiClient = RestClient.builder().requestFactory(geminiFactory).baseUrl(this.geminiBaseUrl).build();
    }

    private List<String> getGeminiModelsToTry() {
        List<String> list = new ArrayList<>();
        if (geminiModel != null && !geminiModel.isBlank()) {
            list.add(geminiModel);
        }
        for (String m : List.of("gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash")) {
            if (!list.contains(m)) {
                list.add(m);
            }
        }
        return list;
    }

    public Map<String, Object> getStatus() {
        boolean openRouterConfigured = !apiKey.isBlank();
        boolean geminiConfigured = !geminiApiKey.isBlank();
        boolean aiEnabled = openRouterConfigured || geminiConfigured;
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("aiEnabled", aiEnabled);
        status.put("reason", aiEnabled ? "online" : "no_key");
        status.put("provider", openRouterConfigured ? provider : (geminiConfigured ? "gemini" : "none"));
        status.put("model", openRouterConfigured ? model : (geminiConfigured ? geminiModel : "none"));
        status.put("activeModel", openRouterConfigured ? model : (geminiConfigured ? geminiModel : null));
        status.put("fallbackMode", !openRouterConfigured && geminiConfigured);
        status.put("hasFallback", geminiConfigured);
        status.put("lastCheckedAt", Instant.now().toString());
        return status;
    }

    public String completePrompt(String systemPrompt, String userPrompt) {
        String result = null;

        // 1. Try OpenRouter first if configured and not exhausted
        if (!apiKey.isBlank() && !openRouterExhausted) {
            List<String> openRouterModels = new ArrayList<>();
            openRouterModels.add("openai/gpt-4o-mini");
            if (!model.equals("openai/gpt-4o-mini")) {
                openRouterModels.add(model);
            }
            openRouterModels.add("meta-llama/llama-3.3-70b-instruct");
            for (String targetModel : openRouterModels) {
                try {
                    Map<String, Object> requestBody = Map.of(
                            "model", targetModel,
                            "messages", List.of(
                                    Map.of("role", "system", "content", systemPrompt),
                                    Map.of("role", "user", "content", userPrompt)
                            ),
                            "temperature", 0.7,
                            "max_tokens", 1000
                    );

                    String raw = restClient.post()
                            .uri("/chat/completions")
                            .header("Authorization", "Bearer " + apiKey)
                            .header("Accept", "application/json")
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(requestBody)
                            .retrieve()
                            .body(String.class);

                    Map response = JsonUtil.toMap(raw);

                    if (response != null && response.containsKey("choices")) {
                        List<?> choices = (List<?>) response.get("choices");
                        if (!choices.isEmpty()) {
                            Map<?, ?> firstChoice = (Map<?, ?>) choices.get(0);
                            Map<?, ?> msg = (Map<?, ?>) firstChoice.get("message");
                            if (msg != null && msg.containsKey("content")) {
                                result = (String) msg.get("content");
                                if (result != null && !result.isBlank()) {
                                    openRouterExhausted = false;
                                    return result;
                                }
                            }
                        }
                    }
                } catch (Exception ex) {
                    System.err.println("[AiService] OpenRouter request failed (" + targetModel + "): " + ex.getMessage());
                }
            }
        }

        // 2. Fallback to Gemini AI if configured
        if (!geminiApiKey.isBlank()) {
            for (String targetModel : getGeminiModelsToTry()) {
                for (int attempt = 1; attempt <= 2; attempt++) {
                    try {
                        Map<String, Object> requestBody = Map.of(
                                "model", targetModel,
                                "messages", List.of(
                                        Map.of("role", "system", "content", systemPrompt),
                                        Map.of("role", "user", "content", userPrompt)
                                ),
                                "temperature", 0.7
                        );

                        String rawBody = geminiClient.post()
                                .uri("/chat/completions")
                                .header("Authorization", "Bearer " + geminiApiKey)
                                .header("Accept", "application/json")
                                .contentType(MediaType.APPLICATION_JSON)
                                .body(requestBody)
                                .retrieve()
                                .body(String.class);

                        Map response = JsonUtil.toMap(rawBody);

                        if (response != null && response.containsKey("choices")) {
                            List<?> choices = (List<?>) response.get("choices");
                            if (!choices.isEmpty()) {
                                Map<?, ?> firstChoice = (Map<?, ?>) choices.get(0);
                                Map<?, ?> msg = (Map<?, ?>) firstChoice.get("message");
                                if (msg != null && msg.containsKey("content")) {
                                    result = (String) msg.get("content");
                                    if (result != null && !result.isBlank()) {
                                        return result;
                                    }
                                }
                            }
                        }
                    } catch (Exception ex) {
                        String errMsg = ex.getMessage() != null ? ex.getMessage() : "";
                        if (errMsg.contains("503") || errMsg.contains("429") || errMsg.contains("404") || errMsg.contains("RESOURCE_EXHAUSTED")) {
                            System.err.println("[AiService] Gemini model " + targetModel + " unavailable: " + errMsg);
                            break; // try next candidate model
                        }
                    }
                }
                if (result != null && !result.isBlank()) {
                    return result;
                }
            }
        }

        return result;
    }

    public Map<String, Object> saveMentorMessage(UUID userId, String role, String content, Map<String, Object> metadata) {
        UUID id = UUID.randomUUID();
        String sql = """
            INSERT INTO mentor_messages (id, user_id, role, content, metadata, created_at)
            VALUES (?, ?, ?, ?, ?::jsonb, NOW())
            RETURNING id, user_id, role, content, metadata, created_at
        """;
        return jdbcTemplate.queryForObject(sql, (rs, rowNum) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", rs.getObject("id", UUID.class).toString());
            m.put("userId", rs.getObject("user_id", UUID.class).toString());
            m.put("role", rs.getString("role"));
            m.put("content", rs.getString("content"));
            m.put("metadata", JsonUtil.toMap(rs.getString("metadata")));
            Timestamp ts = rs.getTimestamp("created_at");
            m.put("createdAt", ts != null ? ts.toInstant().toString() : Instant.now().toString());
            return m;
        }, id, userId, role, content, JsonUtil.toJson(metadata != null ? metadata : Map.of()));
    }

    public List<Map<String, Object>> getMentorHistory(User user) {
        String sql = """
            SELECT id, user_id, role, content, metadata, created_at
            FROM mentor_messages
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 50
        """;
        List<Map<String, Object>> list = jdbcTemplate.query(sql, (rs, rowNum) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", rs.getObject("id", UUID.class).toString());
            m.put("userId", rs.getObject("user_id", UUID.class).toString());
            m.put("role", rs.getString("role"));
            m.put("content", rs.getString("content"));
            m.put("metadata", JsonUtil.toMap(rs.getString("metadata")));
            Timestamp ts = rs.getTimestamp("created_at");
            m.put("createdAt", ts != null ? ts.toInstant().toString() : Instant.now().toString());
            return m;
        }, user.getId());

        Collections.reverse(list);
        return list;
    }

    public Map<String, Object> clearMentorHistory(User user) {
        String sql = "DELETE FROM mentor_messages WHERE user_id = ?";
        int deleted = jdbcTemplate.update(sql, user.getId());
        return Map.of(
                "deleted", deleted,
                "clearedAt", Instant.now().toString()
        );
    }

    public Map<String, Object> chatWithMentor(User user, String userMessage) {
        try {
            jdbcTemplate.update("UPDATE users SET mentor_messages = COALESCE(mentor_messages, 0) + 1, updated_at = NOW() WHERE id = ?", user.getId());
        } catch (Exception ignored) {}

        Map<String, Object> savedUserMsg = saveMentorMessage(user.getId(), "user", userMessage, Map.of());
        List<Map<String, Object>> historyBefore = getMentorHistory(user);

        // Fetch live student context from database (MCP parity)
        List<Map<String, Object>> completedTasks = new ArrayList<>();
        List<Map<String, Object>> pendingTasks = new ArrayList<>();
        try {
            jdbcTemplate.query(
                    "SELECT title, category, status, estimated_minutes, priority, scheduled_for, completed_at FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 40",
                    (rs, rowNum) -> {
                        Map<String, Object> t = new HashMap<>();
                        t.put("title", rs.getString("title"));
                        t.put("category", rs.getString("category"));
                        String st = rs.getString("status");
                        t.put("status", st);
                        t.put("estimatedMinutes", rs.getInt("estimated_minutes"));
                        t.put("priority", rs.getString("priority"));
                        t.put("scheduledFor", rs.getString("scheduled_for"));
                        Timestamp ca = rs.getTimestamp("completed_at");
                        t.put("completedAt", ca != null ? ca.toString() : null);
                        if ("completed".equalsIgnoreCase(st)) {
                            completedTasks.add(t);
                        } else {
                            pendingTasks.add(t);
                        }
                        return null;
                    },
                    user.getId()
            );
        } catch (Exception ignored) {}

        String activePlanSummary = "None active";
        try {
            List<Map<String, Object>> pList = jdbcTemplate.query(
                    "SELECT target_role, metadata FROM prep_plans WHERE user_id = ? AND is_active = TRUE LIMIT 1",
                    (rs, rowNum) -> {
                        Map<String, Object> m = JsonUtil.toMap(rs.getString("metadata"));
                        return Map.of("role", rs.getString("target_role"), "meta", m);
                    },
                    user.getId()
            );
            if (!pList.isEmpty()) {
                Map<String, Object> p = pList.get(0);
                Map<String, Object> m = (Map<String, Object>) p.get("meta");
                activePlanSummary = m.getOrDefault("title", p.get("role") + " Track") + " (" + m.getOrDefault("coachLine", "") + ")";
            }
        } catch (Exception ignored) {}

        StringBuilder studentContext = new StringBuilder();
        studentContext.append("STUDENT PROFILE:\n");
        studentContext.append("- Name: ").append(user.getName() != null ? user.getName() : "Student").append("\n");
        studentContext.append("- Target Role: ").append(user.getTargetRole() != null ? user.getTargetRole() : "SDE Intern").append("\n");
        studentContext.append("- Current Streak: ").append(user.getCurrentStreak()).append(" days\n");
        studentContext.append("- Readiness Score: ").append(user.getReadinessScore()).append("/100\n");
        studentContext.append("- Active Prep Track: ").append(activePlanSummary).append("\n\n");

        studentContext.append("STUDENT TASKS SUMMARY:\n");
        studentContext.append("- Completed Tasks count: ").append(completedTasks.size()).append("\n");
        if (completedTasks.isEmpty()) {
            studentContext.append("  (No completed tasks recorded yet)\n");
        } else {
            for (Map<String, Object> ct : completedTasks) {
                studentContext.append("  - [COMPLETED] ").append(ct.get("title")).append(" (").append(ct.get("category")).append(")\n");
            }
        }
        studentContext.append("- Pending / In-Progress Tasks count: ").append(pendingTasks.size()).append("\n");
        if (pendingTasks.isEmpty()) {
            studentContext.append("  (No pending tasks right now)\n");
        } else {
            for (Map<String, Object> pt : pendingTasks) {
                studentContext.append("  - [PENDING] ").append(pt.get("title")).append(" (").append(pt.get("category")).append(", ~").append(pt.get("estimatedMinutes")).append("m, Priority: ").append(pt.get("priority")).append(")\n");
            }
        }

        String systemPrompt = """
            You are Nocturne Mentor, the elite technical placement & interview coach for PlacePrep.
            You give strict, high-signal, mathematically rigorous, no-fluff placement and interview guidance.
            Areas of expertise: Data Structures & Algorithms, System Design, Operating Systems, DBMS, Computer Networks, and competitive technical interviews at MAANG / Tier-1 tech firms.

            """ + studentContext.toString() + """

            CORE COACHING INSTRUCTIONS:
            1. DIRECT RELEVANCE & RESPONSIVENESS: Always address the student's EXACT question or topic directly and thoroughly. If they ask about an algorithm, a concept, a problem, a company, or a pattern, give a deep, clear, rigorous technical answer immediately.
            2. LIVE CONTEXT AWARENESS: You have live access to their tasks and velocity in the STUDENT PROFILE above. Reference their real tasks, streak, and readiness naturally when giving feedback.
            3. TASK & PROGRESS QUERIES: If the student asks about their tasks ("what tasks do I have", "what have I completed", "my tasks", "my progress", "what should I work on today"):
               - Explicitly report their live task records from the STUDENT TASKS SUMMARY above.
               - Distinguish Completed vs Pending / In-Progress tasks.
               - Format with these sections:
                 ### 📋 CURRENT TASKS & COMPLETION STATUS
                 ### 🎯 COACH DIRECTIVE
                 ### ⚡ NEXT TACTICAL ACTIONS
            4. TECHNICAL / CODING CONCEPTS: If the student asks about an algorithm, problem, or code:
               - Explain the core invariant and algorithmic pattern
               - State optimal Time: O(...) & Space: O(...)
               - Provide clean, production-grade code implementation with comments
               - Highlight interview follow-ups and edge cases
            5. TONE: Direct, authoritative, encouraging yet rigorous, no sycophantic filler or polite chatter.
        """;

        boolean usedFallback = false;
        String aiResponse = null;

        if (!apiKey.isBlank() && !openRouterExhausted) {
            List<String> openRouterModels = new ArrayList<>();
            openRouterModels.add("openai/gpt-4o-mini");
            if (!model.equals("openai/gpt-4o-mini")) {
                openRouterModels.add(model);
            }
            openRouterModels.add("meta-llama/llama-3.3-70b-instruct");

            for (String targetModel : openRouterModels) {
                try {
                    List<Map<String, String>> messages = new ArrayList<>();
                    messages.add(Map.of("role", "system", "content", systemPrompt));
                    int start = Math.max(0, historyBefore.size() - 8);
                    for (int i = start; i < historyBefore.size(); i++) {
                        Map<String, Object> h = historyBefore.get(i);
                        String role = (String) h.get("role");
                        String content = (String) h.get("content");
                        if (role != null && content != null && !role.equals("system")) {
                            messages.add(Map.of("role", role, "content", content));
                        }
                    }
                    messages.add(Map.of("role", "user", "content", userMessage));

                    Map<String, Object> requestBody = Map.of(
                            "model", targetModel,
                            "messages", messages,
                            "temperature", 0.7,
                            "max_tokens", 1000
                    );

                    String raw = restClient.post()
                            .uri("/chat/completions")
                            .header("Authorization", "Bearer " + apiKey)
                            .header("Accept", "application/json")
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(requestBody)
                            .retrieve()
                            .body(String.class);

                    Map response = JsonUtil.toMap(raw);

                    if (response != null && response.containsKey("choices")) {
                        List<?> choices = (List<?>) response.get("choices");
                        if (!choices.isEmpty()) {
                            Map<?, ?> firstChoice = (Map<?, ?>) choices.get(0);
                            Map<?, ?> msg = (Map<?, ?>) firstChoice.get("message");
                            if (msg != null && msg.containsKey("content")) {
                                aiResponse = (String) msg.get("content");
                                if (aiResponse != null && !aiResponse.isBlank()) {
                                    openRouterExhausted = false;
                                    usedFallback = false;
                                    break;
                                }
                            }
                        }
                    }
                } catch (Exception ex) {
                    System.err.println("[AiService] OpenRouter mentor request failed (" + targetModel + "): " + ex.getMessage());
                }
            }
        }

        if ((aiResponse == null || aiResponse.isBlank()) && !geminiApiKey.isBlank()) {
            for (String targetModel : getGeminiModelsToTry()) {
                for (int attempt = 1; attempt <= 2; attempt++) {
                    try {
                        List<Map<String, String>> messages = new ArrayList<>();
                        messages.add(Map.of("role", "system", "content", systemPrompt));
                        int start = Math.max(0, historyBefore.size() - 8);
                        for (int i = start; i < historyBefore.size(); i++) {
                            Map<String, Object> h = historyBefore.get(i);
                            String role = (String) h.get("role");
                            String content = (String) h.get("content");
                            if (role != null && content != null && !role.equals("system")) {
                                messages.add(Map.of("role", role, "content", content));
                            }
                        }
                        messages.add(Map.of("role", "user", "content", userMessage));

                        Map<String, Object> requestBody = Map.of(
                                "model", targetModel,
                                "messages", messages,
                                "temperature", 0.7
                        );

                        String rawBody = geminiClient.post()
                                .uri("/chat/completions")
                                .header("Authorization", "Bearer " + geminiApiKey)
                                .header("Accept", "application/json")
                                .contentType(MediaType.APPLICATION_JSON)
                                .body(requestBody)
                                .retrieve()
                                .body(String.class);

                        Map response = JsonUtil.toMap(rawBody);

                        if (response != null && response.containsKey("choices")) {
                            List<?> choices = (List<?>) response.get("choices");
                            if (!choices.isEmpty()) {
                                Map<?, ?> firstChoice = (Map<?, ?>) choices.get(0);
                                Map<?, ?> msg = (Map<?, ?>) firstChoice.get("message");
                                if (msg != null && msg.containsKey("content")) {
                                    aiResponse = (String) msg.get("content");
                                    if (aiResponse != null && !aiResponse.isBlank()) {
                                        usedFallback = true;
                                        break;
                                    }
                                }
                            }
                        }
                    } catch (Exception ex) {
                        String errMsg = ex.getMessage() != null ? ex.getMessage() : "";
                        if (errMsg.contains("503") || errMsg.contains("429") || errMsg.contains("404") || errMsg.contains("RESOURCE_EXHAUSTED")) {
                            System.err.println("[AiService] Gemini mentor model " + targetModel + " unavailable: " + errMsg);
                            break; // try next candidate model
                        }
                    }
                }
                if (aiResponse != null && !aiResponse.isBlank()) {
                    break;
                }
            }
        }

        if (aiResponse == null || aiResponse.isBlank()) {
            usedFallback = true;
            String lower = userMessage.toLowerCase();
            if (lower.contains("task") || lower.contains("complete") || lower.contains("have") || lower.contains("todo") || lower.contains("progress")) {
                StringBuilder fb = new StringBuilder();
                fb.append("### 📋 CURRENT TASKS & COMPLETION STATUS\n");
                fb.append("**Completed Tasks (").append(completedTasks.size()).append("):**\n");
                if (completedTasks.isEmpty()) {
                    fb.append("- No tasks marked completed yet. Let's finish your first pending task today.\n");
                } else {
                    for (Map<String, Object> ct : completedTasks) {
                        fb.append("- ✅ **").append(ct.get("title")).append("** (").append(ct.get("category")).append(")\n");
                    }
                }
                fb.append("\n**Pending / Upcoming Tasks (").append(pendingTasks.size()).append("):**\n");
                if (pendingTasks.isEmpty()) {
                    fb.append("- All caught up! Generate new tasks from Prep Architect or create one on your Tasks board.\n");
                } else {
                    for (Map<String, Object> pt : pendingTasks) {
                        fb.append("- ⏳ **").append(pt.get("title")).append("** (").append(pt.get("category")).append(", ~").append(pt.get("estimatedMinutes")).append(" mins)\n");
                    }
                }
                fb.append("\n### 🎯 COACH DIRECTIVE\n");
                fb.append("Your target role is ").append(user.getTargetRole() != null ? user.getTargetRole() : "SDE Intern").append(". ");
                fb.append("You currently have ").append(pendingTasks.size()).append(" pending tasks. Prioritize algorithmic consistency to protect your streak.\n");
                fb.append("\n### ⚡ NEXT TACTICAL ACTIONS\n");
                if (!pendingTasks.isEmpty()) {
                    fb.append("1. Open Coding Lab and execute your top pending task: **").append(pendingTasks.get(0).get("title")).append("**.\n");
                    fb.append("2. Solve with optimal space and time complexities, verifying all boundary conditions.\n");
                } else {
                    fb.append("1. Generate today's focused module in Prep Architect.\n");
                    fb.append("2. Execute a 45-minute timed mock coding session in Coding Lab.\n");
                }
                aiResponse = fb.toString();
            } else {
                aiResponse = """
                    ### 🎯 DIRECTIVE & ASSESSMENT
                    Focus on core algorithmic patterns. High-yield interview prep requires deliberate problem-solving over passive consumption.

                    ### 🗺️ STRATEGIC ROADMAP
                    - **Phase 1: Fundamentals (Days 1–7)**
                      - *Arrays, Two Pointers & HashMaps*: Invariant tracking and O(N) lookups.
                      - *Binary Search*: Strict monotonic boundary conditions.
                    - **Phase 2: Non-Linear Structures (Days 8–21)**
                      - *Trees & Graphs*: BFS level-order, DFS recursion stack invariants, topological sort.
                      - *Heap & Priority Queues*: Top-K elements, streaming medians.
                    - **Phase 3: Optimization & Dynamic Programming (Days 22–35)**
                      - *DP*: State definition, base cases, transition relations, space optimization.

                    ### ⚡ IMMEDIATE TACTICAL ACTIONS
                    1. Solve 2 medium problems daily focusing on optimal space/time complexity.
                    2. Explain the solution aloud before typing code (mental dry-run).
                    3. Implement standard data structures from scratch to understand internals.

                    ### ⚠️ CRITICAL PITFALLS & INTERVIEW TRAPS
                    - Premature coding before verifying edge cases (empty collection, single node, integer overflow).
                    - Neglecting auxiliary space complexity (recursion stack, implicit hash table growth).
                    """;
            }
        }

        Map<String, Object> assistantMetadata = Map.of(
                "provider", usedFallback ? "gemini" : provider,
                "model", usedFallback ? geminiModel : model,
                "usedFallback", usedFallback
        );
        Map<String, Object> savedAssistantMsg = saveMentorMessage(user.getId(), "assistant", aiResponse, assistantMetadata);

        List<Map<String, Object>> updatedHistory = getMentorHistory(user);

        return Map.of(
                "reply", aiResponse,
                "usedFallback", usedFallback,
                "message", savedAssistantMsg,
                "history", updatedHistory
        );
    }

    public List<Task> generateTasks(User user, Map<String, Object> req) {
        boolean persist = Boolean.TRUE.equals(req.get("persist"));
        List<String> weakAreas = user.getWeakAreas().isEmpty() ? List.of("Dynamic Programming", "Graphs", "Binary Search") : user.getWeakAreas();

        List<Task> generated = new ArrayList<>();
        int count = 1;
        for (String topic : weakAreas) {
            Task t = new Task();
            t.setUserId(user.getId());
            t.setTitle("Practice: " + topic + " Mastery Problem " + count);
            t.setDescription("Solve a targeted problem on " + topic + ". Focus on optimal time/space complexity analysis.");
            t.setCategory("DSA");
            t.setDifficulty(3);
            t.setEstimatedMinutes(45);
            t.setPriority("high");
            t.setScheduledFor(LocalDate.now());
            t.setAiGenerated(true);

            if (persist) {
                generated.add(taskRepository.createTask(t));
            } else {
                generated.add(t);
            }
            count++;
            if (count > 4) break;
        }

        return generated;
    }

    public Map<String, Object> generateTaskPlan(User user, Map<String, Object> req) {
        List<Task> tasks = generateTasks(user, req);
        int totalMinutes = tasks.stream().mapToInt(Task::getEstimatedMinutes).sum();
        Map<String, Object> plan = new LinkedHashMap<>();
        plan.put("planTitle", "Targeted Weak Area Sprint");
        plan.put("motivationLine", "Focus on core pattern recognition and optimal space-time trade-offs today.");
        plan.put("tasks", tasks);
        plan.put("totalEstimatedMinutes", totalMinutes > 0 ? totalMinutes : 90);
        plan.put("persisted", Boolean.TRUE.equals(req.get("persist")));
        plan.put("replacedCount", 0);
        plan.put("usedFallback", true);
        return plan;
    }

    private String defaultHint(String problem, String topic, String attempt) {
        String lowerProb = problem != null ? problem.toLowerCase() : "";
        String lowerTopic = topic != null ? topic.toLowerCase() : "";
        String lowerAtt = attempt != null ? attempt.toLowerCase() : "";

        if (lowerProb.contains("dp") || lowerTopic.contains("dynamic") || lowerAtt.contains("recur") || lowerAtt.contains("subproblem")) {
            return "Formulate the optimal subproblem recurrence first. What state parameters (e.g. index, remaining capacity) uniquely define the answer? Avoid recomputing identical states by caching or tabulating.";
        }
        if (lowerProb.contains("tree") || lowerProb.contains("graph") || lowerTopic.contains("tree") || lowerTopic.contains("graph")) {
            return "Determine whether you need BFS for level-order/shortest paths or DFS for component/backtracking exploration. Keep track of visited nodes to avoid cycles.";
        }
        if (lowerProb.contains("array") || lowerProb.contains("string") || lowerTopic.contains("array") || lowerTopic.contains("string")) {
            return "Check if a two-pointer technique (left & right) or sliding window can avoid nested loops. Does sorting the input or using a frequency map reveal symmetries?";
        }
        return "Analyze the input constraints and start with the simplest working brute force. Identify repeated work and consider what data structure (Hash Map, Heap, Monotonic Stack) can optimize lookups to O(1) or O(log N).";
    }

    private List<String> defaultApproachSteps(String problem, String topic) {
        return List.of(
                "Step 1: Clarify constraints, invariants, and edge cases (empty input, negatives, overflow bounds).",
                "Step 2: Identify overlapping subproblems or monotonic properties to select the optimal algorithm pattern.",
                "Step 3: Dry-run state transitions on a minimal hand-crafted test case before writing code.",
                "Step 4: Verify time and space complexities meet interviewer target benchmarks."
        );
    }

    private List<String> defaultSimilarProblems(String problem, String topic) {
        String cleanProb = problem.replaceAll("(?i)\\b(problem|practice)\\b", "").trim();
        if (cleanProb.isBlank()) cleanProb = topic + " Core Challenge";
        return List.of(
                cleanProb + " (Pattern Variation)",
                "Subarray Target / Two-Pointer Invariant",
                "Longest Contiguous Subsequence Formulation"
        );
    }

    private List<String> defaultYoutubeKeywords(String problem, String topic) {
        return List.of(
                topic + " interview patterns",
                problem + " NeetCode visual breakdown",
                topic + " optimal space complexity"
        );
    }

    public Map<String, Object> getStuckHelp(User user, Map<String, Object> req) {
        String problem = req.get("problemName") instanceof String s && !s.isBlank() ? s.trim() :
                (req.get("problem") instanceof String s2 && !s2.isBlank() ? s2.trim() : "Algorithmic Problem");
        String attempt = req.get("attempt") instanceof String a && !a.isBlank() ? a.trim() : "";
        String topic = req.get("topic") instanceof String t && !t.isBlank() ? t.trim() : "DSA";

        String systemPrompt = """
            You are an elite technical interview coach at PlacePrep.
            The student is stuck on a coding/system design problem and needs progressive hints without revealing full code.
            Respond strictly in valid JSON matching this schema:
            {
              "hint": "a concise, tactical progressive hint to get past the current blocker",
              "approachSteps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
              "similarProblems": ["Similar Problem 1", "Similar Problem 2"],
              "youtubeSearchKeywords": ["Search keyword 1", "Search keyword 2"]
            }
            """;

        String userPrompt = String.format("""
            Problem: %s
            Topic: %s
            Where the student is blocked / their current attempt:
            %s
            """, problem, topic, attempt.isBlank() ? "No prior attempt details given." : attempt);

        String rawAi = completePrompt(systemPrompt, userPrompt);
        Map<String, Object> result = new LinkedHashMap<>();
        boolean usedFallback = true;

        if (rawAi != null) {
            try {
                int firstBrace = rawAi.indexOf("{");
                int lastBrace = rawAi.lastIndexOf("}");
                if (firstBrace >= 0 && lastBrace > firstBrace) {
                    Map<String, Object> parsed = JsonUtil.toMap(rawAi.substring(firstBrace, lastBrace + 1));
                    String hint = (String) parsed.get("hint");
                    List<String> approach = JsonUtil.toList(JsonUtil.toJson(parsed.get("approachSteps")), String.class);
                    List<String> similar = JsonUtil.toList(JsonUtil.toJson(parsed.get("similarProblems")), String.class);
                    List<String> yt = JsonUtil.toList(JsonUtil.toJson(parsed.get("youtubeSearchKeywords")), String.class);

                    if (hint != null && !hint.isBlank()) {
                        result.put("hint", hint);
                        result.put("approachSteps", approach != null && !approach.isEmpty() ? approach : defaultApproachSteps(problem, topic));
                        result.put("similarProblems", similar != null && !similar.isEmpty() ? similar : defaultSimilarProblems(problem, topic));
                        result.put("youtubeSearchKeywords", yt != null && !yt.isEmpty() ? yt : defaultYoutubeKeywords(problem, topic));
                        usedFallback = false;
                    }
                }
            } catch (Exception ignored) {
                // fall back to default structured guidance below
            }
        }

        if (usedFallback) {
            result.put("hint", defaultHint(problem, topic, attempt));
            result.put("approachSteps", defaultApproachSteps(problem, topic));
            result.put("similarProblems", defaultSimilarProblems(problem, topic));
            result.put("youtubeSearchKeywords", defaultYoutubeKeywords(problem, topic));
        }

        result.put("hints", result.get("hint"));
        result.put("topic", topic);
        result.put("usedFallback", usedFallback);
        return result;
    }

    public Map<String, Object> evaluateDailyPerformance(User user, Map<String, Object> req) {
        int totalTasks = req.get("totalTasks") instanceof Number n ? n.intValue() : 0;
        int tasksCompleted = req.get("tasksCompleted") instanceof Number n ? n.intValue() : 0;
        int timeSpent = req.get("timeSpentMinutes") instanceof Number n ? n.intValue() : 0;
        String struggles = req.get("struggles") instanceof String s ? s : "";

        int productivityScore = totalTasks > 0 ? (int) Math.round(((double) tasksCompleted / totalTasks) * 100.0) : (tasksCompleted > 0 ? 85 : 50);
        if (productivityScore > 100) productivityScore = 100;
        if (productivityScore < 20 && tasksCompleted > 0) productivityScore = 40;

        List<String> weakAreas = new ArrayList<>();
        if (!struggles.isBlank()) {
            weakAreas.add(struggles.length() > 40 ? struggles.substring(0, 40) + "..." : struggles);
        }
        if (user.getWeakAreas() != null && !user.getWeakAreas().isEmpty()) {
            weakAreas.addAll(user.getWeakAreas());
        }
        if (weakAreas.isEmpty()) {
            weakAreas.addAll(List.of("Dynamic Programming", "Tree Traversals"));
        }
        weakAreas = weakAreas.stream().distinct().limit(3).toList();

        List<String> tomorrowImprovements = List.of(
                "Review state transitions and memoization edge cases for today's weak topics.",
                "Solve 2 medium interview problems in a timed 45-minute Power Pocket block.",
                "Log daily reflection promptly to keep consistency scores elevated."
        );

        String verdict = productivityScore >= 80
                ? "Excellent execution pace today. Maintain this intensity tomorrow."
                : (productivityScore >= 50
                    ? "Solid progress made. Tighten tomorrow's schedule to clear all planned items."
                    : "Low completion volume today. Reset tomorrow with an early morning focus session.");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("productivityScore", productivityScore);
        result.put("score", productivityScore);
        result.put("evaluation", verdict);
        result.put("verdict", verdict);
        result.put("weakAreas", weakAreas);
        result.put("tomorrowImprovements", tomorrowImprovements);
        result.put("recommendation", tomorrowImprovements.get(0));
        result.put("readinessIncrement", tasksCompleted > 0 ? 1.5 : 0.5);
        result.put("usedFallback", true);

        return result;
    }

    public Map<String, Object> getLatestPrepPlan(User user) {
        List<Map<String, Object>> plans = jdbcTemplate.query(
                "SELECT * FROM prep_plans WHERE user_id = ? AND is_active = TRUE ORDER BY created_at DESC LIMIT 1",
                (rs, rowNum) -> mapRowToPrepPlan(rs),
                user.getId()
        );

        if (!plans.isEmpty()) {
            return plans.get(0);
        }

        return createAndPersistPlan(user, Map.of(
                "targetRole", user.getTargetRole() != null ? user.getTargetRole() : "SDE Intern",
                "timePerDay", 120,
                "durationMonths", 1,
                "companyKey", "google"
        ));
    }

    public Map<String, Object> updatePrepPlan(User user, Map<String, Object> req) {
        return createAndPersistPlan(user, req != null ? req : Map.of());
    }

    public Map<String, Object> generatePrepPlan(User user, Map<String, Object> req) {
        return createAndPersistPlan(user, req != null ? req : Map.of());
    }

    public List<Map<String, Object>> getPrepPlanHistory(User user, int limit) {
        return jdbcTemplate.query(
                "SELECT * FROM prep_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                (rs, rowNum) -> mapRowToPrepPlan(rs),
                user.getId(),
                Math.max(1, Math.min(limit, 50))
        );
    }

    public Map<String, Object> activatePrepPlan(User user, String planId) {
        UUID id = UUID.fromString(planId);
        jdbcTemplate.update("UPDATE prep_plans SET is_active = FALSE WHERE user_id = ?", user.getId());
        jdbcTemplate.update("UPDATE prep_plans SET is_active = TRUE, updated_at = NOW() WHERE id = ? AND user_id = ?", id, user.getId());
        List<Map<String, Object>> plans = jdbcTemplate.query(
                "SELECT * FROM prep_plans WHERE id = ? AND user_id = ?",
                (rs, rowNum) -> mapRowToPrepPlan(rs),
                id, user.getId()
        );
        return plans.isEmpty() ? getLatestPrepPlan(user) : plans.get(0);
    }

    public Map<String, Object> renamePrepPlan(User user, Map<String, Object> req) {
        String planId = (String) req.get("planId");
        String newTitle = (String) req.getOrDefault("title", "Updated Prep Plan");
        if (planId != null) {
            UUID id = UUID.fromString(planId);
            List<Map<String, Object>> plans = jdbcTemplate.query(
                    "SELECT * FROM prep_plans WHERE id = ? AND user_id = ?",
                    (rs, rowNum) -> mapRowToPrepPlan(rs),
                    id, user.getId()
            );
            if (!plans.isEmpty()) {
                Map<String, Object> plan = plans.get(0);
                Map<String, Object> meta = (Map<String, Object>) plan.getOrDefault("metadata", new HashMap<>());
                meta.put("title", newTitle);
                meta.put("autoTitle", newTitle);
                meta.put("titleSource", "custom");
                jdbcTemplate.update("UPDATE prep_plans SET metadata = ?::jsonb, updated_at = NOW() WHERE id = ?", JsonUtil.toJson(meta), id);
                plan.put("title", newTitle);
                plan.put("autoTitle", newTitle);
                return plan;
            }
        }
        return getLatestPrepPlan(user);
    }

    public Map<String, Object> clearPrepPlanHistory(User user, List<String> planIds) {
        int deleted = 0;
        if (planIds != null && !planIds.isEmpty()) {
            List<Object> params = new ArrayList<>();
            params.add(user.getId());
            for (String pid : planIds) {
                try {
                    params.add(UUID.fromString(pid));
                } catch (Exception ignored) {
                }
            }
            if (params.size() > 1) {
                int idCount = params.size() - 1;
                deleted = jdbcTemplate.update(
                        "DELETE FROM prep_plans WHERE user_id = ? AND id IN (" +
                                String.join(",", Collections.nCopies(idCount, "?::uuid")) + ")",
                        params.toArray()
                );
            }
        } else {
            deleted = jdbcTemplate.update("DELETE FROM prep_plans WHERE user_id = ? AND is_active = FALSE", user.getId());
        }

        // If the active plan was deleted, promote the newest remaining plan to active
        try {
            List<Map<String, Object>> activePlans = jdbcTemplate.query(
                    "SELECT id FROM prep_plans WHERE user_id = ? AND is_active = TRUE",
                    (rs, rowNum) -> Map.of("id", rs.getObject("id")),
                    user.getId()
            );
            if (activePlans.isEmpty()) {
                jdbcTemplate.update(
                        "UPDATE prep_plans SET is_active = TRUE WHERE id = (SELECT id FROM prep_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1)",
                        user.getId()
                );
            }
        } catch (Exception ignored) {
        }

        return Map.of(
                "success", true,
                "deleted", deleted,
                "deletedCount", deleted,
                "clearedAt", Instant.now().toString()
        );
    }

    public static int sanitizeTimePerDay(Object rawTimePerDay) {
        if (rawTimePerDay instanceof Number n) {
            int val = n.intValue();
            return val > 0 ? val : 120;
        }
        return 120;
    }

    public record PlanTimeBlock(int minutes, String roleType, String blockLabel) {}

    public static List<PlanTimeBlock> computeDeliberateBlocks(int totalMinutes) {
        if (totalMinutes <= 0) {
            throw new IllegalArgumentException("Daily study budget must be positive (> 0 minutes), got: " + totalMinutes);
        }
        if (totalMinutes <= 45) {
            return List.of(new PlanTimeBlock(totalMinutes, "dsa", "Targeted Algorithmic Sprint"));
        }
        if (totalMinutes == 60) {
            return List.of(new PlanTimeBlock(60, "dsa", "Core Algorithmic Focus Block"));
        }
        if (totalMinutes == 75) {
            return List.of(
                    new PlanTimeBlock(60, "dsa", "Core Algorithmic Focus Block"),
                    new PlanTimeBlock(15, "revision", "Spaced Repetition & Daily Wrap-Up")
            );
        }
        if (totalMinutes == 90) {
            return List.of(
                    new PlanTimeBlock(45, "dsa", "Algorithmic Problem-Solving Block"),
                    new PlanTimeBlock(45, "core_cs", "Core CS & Systems Engineering Block")
            );
        }
        if (totalMinutes == 105) {
            return List.of(
                    new PlanTimeBlock(60, "dsa", "Core Algorithmic Focus Block"),
                    new PlanTimeBlock(45, "core_cs", "Core CS & Systems Engineering Block")
            );
        }
        if (totalMinutes == 120) {
            return List.of(
                    new PlanTimeBlock(60, "dsa", "Algorithmic Problem-Solving Block"),
                    new PlanTimeBlock(60, "core_cs", "Systems Engineering & Architectural Block")
            );
        }
        if (totalMinutes == 135) {
            return List.of(
                    new PlanTimeBlock(90, "dsa", "Deep Algorithmic Focus Block"),
                    new PlanTimeBlock(45, "core_cs", "Core CS & Systems Engineering Block")
            );
        }
        if (totalMinutes == 150) {
            return List.of(
                    new PlanTimeBlock(90, "dsa", "Deep Algorithmic Focus Block"),
                    new PlanTimeBlock(60, "core_cs", "Systems Engineering & Architectural Block")
            );
        }
        if (totalMinutes == 180) {
            return List.of(
                    new PlanTimeBlock(90, "dsa", "Deep Algorithmic Focus Block"),
                    new PlanTimeBlock(90, "core_cs", "System Architecture & Mock Simulation Block")
            );
        }

        // Deliberate allocation for arbitrary / non-preset capacities:
        List<Integer> durations = new ArrayList<>();
        int remaining = totalMinutes;

        if (totalMinutes < 60) {
            durations.add(45);
            remaining -= 45;
        } else if (totalMinutes < 90) {
            durations.add(60);
            remaining -= 60;
        } else if (totalMinutes < 105) {
            // e.g. 91..104: 45m DSA + 45m Core CS (90m total) + remainder <= 14m
            durations.add(45);
            durations.add(45);
            remaining -= 90;
        } else if (totalMinutes < 120) {
            // e.g. 106..119: 60m DSA + 45m Core CS (105m total) + remainder <= 14m
            durations.add(60);
            durations.add(45);
            remaining -= 105;
        } else if (totalMinutes < 135) {
            // e.g. 121..134: 60m DSA + 60m Core CS (120m total) + remainder <= 14m
            durations.add(60);
            durations.add(60);
            remaining -= 120;
        } else if (totalMinutes < 150) {
            // e.g. 136..149: 90m DSA + 45m Core CS (135m total) + remainder <= 14m
            durations.add(90);
            durations.add(45);
            remaining -= 135;
        } else if (totalMinutes < 180) {
            // e.g. 151..179: 90m DSA + 60m Core CS (150m total) + remainder <= 29m
            durations.add(90);
            durations.add(60);
            remaining -= 150;
        } else if (totalMinutes < 210) {
            // e.g. 181..209: 90m DSA + 90m Core CS (180m total) + remainder <= 29m
            durations.add(90);
            durations.add(90);
            remaining -= 180;
        } else if (totalMinutes < 225) {
            // e.g. 210..224: 90m DSA + 60m Core CS + 60m DSA (210m total) + remainder <= 14m
            durations.add(90);
            durations.add(60);
            durations.add(60);
            remaining -= 210;
        } else if (totalMinutes < 240) {
            // e.g. 225..239: 90m DSA + 90m Core CS + 45m DSA (225m total) + remainder <= 14m
            durations.add(90);
            durations.add(90);
            durations.add(45);
            remaining -= 225;
        } else if (totalMinutes < 270) {
            // e.g. 240..269: 90m DSA + 90m Core CS + 60m DSA (240m total) + remainder <= 29m
            durations.add(90);
            durations.add(90);
            durations.add(60);
            remaining -= 240;
        } else {
            // General modular decomposition for large budgets (>= 270)
            while (remaining >= 270) {
                durations.add(90);
                remaining -= 90;
            }
            if (remaining < 210) {
                durations.add(90);
                durations.add(90);
                remaining -= 180;
            } else if (remaining < 225) {
                durations.add(90);
                durations.add(60);
                durations.add(60);
                remaining -= 210;
            } else if (remaining < 240) {
                durations.add(90);
                durations.add(90);
                durations.add(45);
                remaining -= 225;
            } else {
                durations.add(90);
                durations.add(90);
                durations.add(60);
                remaining -= 240;
            }
        }

        // Build focus blocks with strictly alternating roles: DSA -> Core CS -> DSA -> Core CS ...
        List<PlanTimeBlock> blocks = new ArrayList<>();
        for (int i = 0; i < durations.size(); i++) {
            int d = durations.get(i);
            boolean isDsa = (i % 2 == 0);
            String role = isDsa ? "dsa" : "core_cs";
            String label;
            if (d == 90) {
                label = isDsa ? "Deep Algorithmic Focus Block" : "System Architecture & Mock Simulation Block";
            } else if (d == 60) {
                label = isDsa ? "Core Algorithmic Focus Block" : "Systems Engineering & Architectural Block";
            } else {
                label = isDsa ? "Algorithmic Problem-Solving Block" : "Core CS & Systems Engineering Block";
            }
            blocks.add(new PlanTimeBlock(d, role, label));
        }

        if (remaining > 0) {
            blocks.add(new PlanTimeBlock(remaining, "revision", "Spaced Repetition & Daily Wrap-Up"));
        }

        return blocks;
    }

    public Map<String, Object> generateDeterministicCurriculum(
            CompanyBlueprint bp,
            ResearchReport report,
            int timePerDay,
            int durationMonths,
            String targetRole
    ) {
        int safeTimePerDay = sanitizeTimePerDay(timePerDay);
        int safeMonths = Math.max(1, durationMonths);
        int totalWeeks = safeMonths * 4;
        double weeklyEstimatedHours = Math.round(((5.0 * safeTimePerDay) / 60.0) * 10.0) / 10.0;

        String roleLower = targetRole != null ? targetRole.toLowerCase().trim() : "";
        boolean isAi = roleLower.contains("ai") || roleLower.contains("machine learning") || roleLower.contains("ml") || roleLower.contains("deep learning") || roleLower.contains("data scientist") || roleLower.contains("nlp");
        boolean isBackend = roleLower.contains("backend") || roleLower.contains("cloud") || roleLower.contains("systems") || roleLower.contains("distributed") || roleLower.contains("platform") || roleLower.contains("devops") || roleLower.contains("sre");
        boolean isFrontend = roleLower.contains("front") || roleLower.contains("react") || roleLower.contains("ui") || roleLower.contains("web") || roleLower.contains("mobile") || roleLower.contains("ios") || roleLower.contains("android");
        boolean isIntern = roleLower.contains("intern") || roleLower.contains("student") || roleLower.contains("junior") || roleLower.contains("entry") || roleLower.contains("graduate");

        List<CompanyBlueprint.InterviewStage> stages = (bp != null && !bp.stages().isEmpty())
                ? bp.stages()
                : List.of(new CompanyBlueprint.InterviewStage("core-round", "Technical Interview Round", 100, "Live coding", List.of("Edge cases", "Time complexity"), List.of("Data Structures", "Algorithms"), List.of()));

        boolean isVerifiedBlueprint = (bp != null && !"standard_sde".equalsIgnoreCase(bp.companyId()) && !bp.highFrequencyLeetCodeIds().isEmpty());

        List<String> dailyTopics;
        List<Integer> roleLeetCodeIds;
        List<String> roleRoadmapThemes;
        List<List<String>> roleRoadmapFocus;

        if (isAi) {
            dailyTopics = List.of(
                    "Python Vectorization & NumPy Memory Layout",
                    "Loss Functions, Gradient Descent & Backpropagation",
                    "Feature Engineering & Data Pipeline Preprocessing",
                    "Model Evaluation: Precision-Recall, ROC-AUC & Calibration",
                    "Transformer Architecture & Attention Complexity"
            );
            roleLeetCodeIds = isVerifiedBlueprint
                    ? List.of(48, 1, 56, 74, 200)
                    : List.of(74, 1, 48, 53, 238);
            roleRoadmapThemes = List.of(
                    "Machine Learning Foundations & Matrix Algorithms",
                    "Deep Learning Architectures & Loss Optimization",
                    "ML Systems Design & Scalable Data Pipelines",
                    "Production ML, Model Evaluation & Interview Simulation"
            );
            roleRoadmapFocus = List.of(
                    List.of("NumPy Vectorization", "Feature Normalization", "Matrix Operations"),
                    List.of("Backpropagation", "Regularization", "Transformer Attention"),
                    List.of("Data Ingestion", "Feature Stores", "Distributed Training"),
                    List.of("Model Serving", "Latency Optimization", "A/B Testing Metrics")
            );
        } else if (isBackend) {
            dailyTopics = List.of(
                    "Relational ACID, MVCC & Transaction Isolation Anomalies",
                    "Distributed Caching (Cache-Aside & Redis Mutex Locking)",
                    "B+ Tree Indexing & Query Plan Optimization",
                    "Idempotency & Message Queues (Kafka / RabbitMQ)",
                    "REST / gRPC Contract Design & Resilience Patterns"
            );
            roleLeetCodeIds = isVerifiedBlueprint
                    ? List.of(146, 56, 200, 207, 1)
                    : List.of(56, 1, 20, 15, 33);
            roleRoadmapThemes = List.of(
                    "Database Internals, ACID & Query Optimization",
                    "Distributed Systems, Caching & Concurrency",
                    "Microservices Resiliency, Idempotency & API Design",
                    "System Design Mock Simulations & Production Troubleshooting"
            );
            roleRoadmapFocus = List.of(
                    List.of("B+ Trees", "MVCC", "Index Scans", "Interval Processing"),
                    List.of("Cache-Aside", "Redis Locks", "Sharding", "Message Brokers"),
                    List.of("Idempotency Keys", "gRPC", "Circuit Breakers", "Rate Limiting"),
                    List.of("Scalability", "Failover", "Distributed Logging", "Final Polish")
            );
        } else if (isFrontend) {
            dailyTopics = List.of(
                    "Browser Event Loop: Microtasks, Macrotasks & Rendering",
                    "DOM Manipulation, Layout Thrashing & Virtual DOM Reconciliation",
                    "Core Web Vitals Optimization (LCP, CLS, INP)",
                    "React State Architecture, Hook Lifecycles & Memoization",
                    "CSS Box Model, Flexbox/Grid Layout Engine & Paint Pipeline"
            );
            roleLeetCodeIds = isVerifiedBlueprint
                    ? List.of(443, 20, 1, 226, 3)
                    : List.of(20, 3, 125, 226, 1);
            roleRoadmapThemes = List.of(
                    "Browser Engine, Event Loop & DOM Internals",
                    "Virtual DOM, React Reconciliation & State Patterns",
                    "Web Performance, Core Web Vitals & Asset Delivery",
                    "Advanced Web Systems, Accessibility & Frontend Architecture"
            );
            roleRoadmapFocus = List.of(
                    List.of("Microtask Queue", "Reflow/Repaint", "Stack Operations", "String Parsing"),
                    List.of("Fiber Architecture", "Hook Dependencies", "Memoization", "Trees"),
                    List.of("LCP", "CLS", "INP", "Code Splitting", "Bundle Optimization"),
                    List.of("State Machines", "WCAG A11y", "Design Systems", "Live Polish")
            );
        } else if (isIntern) {
            dailyTopics = List.of(
                    "Monotonic Binary Search & Array Invariants",
                    "Two Pointers & Hash Map Invariants",
                    "Linked List Operations & Fast-Slow Pointers",
                    "Recursion Trees, 1D DP & Memoization",
                    "Binary Tree Traversals & Depth Calculation"
            );
            roleLeetCodeIds = isVerifiedBlueprint
                    ? List.of(56, 1, 200, 704, 146)
                    : List.of(704, 1, 21, 70, 104);
            roleRoadmapThemes = List.of(
                    "Core Data Structures & Algorithmic Invariants",
                    "Recursion, Search & Dynamic Programming Foundations",
                    "Trees, Graphs & Fundamental Complexity Analysis",
                    "Intern Technical Screening Loops & Mock Coding"
            );
            roleRoadmapFocus = List.of(
                    List.of("Arrays", "Binary Search", "Two Pointers", "Hashing"),
                    List.of("1D DP", "Recursion Trees", "Memoization", "Stack/Queue"),
                    List.of("Binary Trees", "BFS/DFS", "Big-O Analysis", "Testing"),
                    List.of("Intern Loops", "Whiteboarding", "Communication", "Mock Polish")
            );
        } else {
            dailyTopics = List.of(
                    "Array Invariants, Two Pointers & Space-Time Analysis",
                    "Monotonic Binary Search & Midpoint Boundary Conditions",
                    "Recursion Trees, Memoization & Dynamic Programming Subproblems",
                    "Graph Traversal (BFS / DFS) & Cycle Detection",
                    "Operating Systems: Process vs Thread Concurrency & Deadlocks"
            );
            roleLeetCodeIds = (bp != null && !bp.highFrequencyLeetCodeIds().isEmpty())
                    ? bp.highFrequencyLeetCodeIds()
                    : List.of(704, 1, 21, 70, 104);
            roleRoadmapThemes = List.of(
                    "Core Algorithmic Invariants & Data Structures",
                    "Dynamic Programming & Advanced Recursion",
                    "Graph Theory, Search & Systems Concurrency",
                    "Technical Screening Loops & Full Mock Interview Simulation"
            );
            roleRoadmapFocus = List.of(
                    List.of("Arrays", "Two Pointers", "Hashing", "Sorting"),
                    List.of("1D DP", "2D DP", "Knapsack", "Intervals"),
                    List.of("BFS/DFS", "Cycle Detection", "Concurrency", "Locks"),
                    List.of("Full Loop Simulation", "Edge Cases", "Whiteboard Synthesis")
            );
        }

        // 1. Generate Roadmap (N = durationMonths * 4)
        List<Map<String, Object>> roadmap = new ArrayList<>();
        for (int w = 1; w <= totalWeeks; w++) {
            int themeIdx = (w - 1) % roleRoadmapThemes.size();
            String theme = roleRoadmapThemes.get(themeIdx);
            List<String> focusTopics = new ArrayList<>(roleRoadmapFocus.get(themeIdx));
            int stageIndex = (w - 1) * stages.size() / totalWeeks;
            CompanyBlueprint.InterviewStage stage = stages.get(Math.min(stageIndex, stages.size() - 1));

            String weekTitle = "Week " + w + ": " + theme + " (" + stage.name() + ")";
            String primaryGoal = "Master " + String.join(", ", focusTopics) + " under " + (bp != null ? bp.displayName() : "interview") + " screening pressure.";
            String milestone = "Pass weekly timed diagnostic simulation with 0 syntax or runtime errors.";

            Map<String, Object> weekMap = new LinkedHashMap<>();
            weekMap.put("week", w);
            weekMap.put("title", weekTitle);
            weekMap.put("theme", weekTitle);
            weekMap.put("focusTopics", focusTopics);
            weekMap.put("topics", focusTopics);
            weekMap.put("estimatedHours", weeklyEstimatedHours);
            weekMap.put("goals", List.of(primaryGoal, milestone));
            weekMap.put("goal", primaryGoal);
            weekMap.put("milestone", milestone);
            weekMap.put("stageId", stage.stageId());
            weekMap.put("stageName", stage.name());
            weekMap.put("rubricTraps", stage.rubricTraps());
            weekMap.put("evidenceRefs", stage.evidenceRefs());
            roadmap.add(weekMap);
        }

        // 2. Generate 5-Day Tasks (totalMinutes strictly equal to timePerDay using deliberate focus blocks)
        List<Map<String, Object>> tasks = new ArrayList<>();
        List<PlanTimeBlock> deliberateBlocks = computeDeliberateBlocks(safeTimePerDay);

        for (int d = 1; d <= 5; d++) {
            CompanyBlueprint.InterviewStage currentStage = stages.get((d - 1) % stages.size());
            int lcId = roleLeetCodeIds.get((d - 1) % roleLeetCodeIds.size());
            Optional<LeetCodeCatalogService.CanonicalProblemMeta> metaOpt = leetCodeCatalogService.findByNumber(lcId);

            String probTitle = metaOpt.map(LeetCodeCatalogService.CanonicalProblemMeta::title).orElse("Problem #" + lcId);
            String probSlug = metaOpt.map(LeetCodeCatalogService.CanonicalProblemMeta::slug).orElse("problem-" + lcId);
            String probDiff = metaOpt.map(LeetCodeCatalogService.CanonicalProblemMeta::difficulty).orElse("Medium");
            String probUrl = metaOpt.map(LeetCodeCatalogService.CanonicalProblemMeta::url).orElse("https://leetcode.com/problems/" + probSlug + "/");
            List<String> probTopics = metaOpt.map(LeetCodeCatalogService.CanonicalProblemMeta::topics).orElse(List.of("Algorithms"));
            String coreTopic = dailyTopics.get((d - 1) % dailyTopics.size());

            List<Map<String, Object>> items = new ArrayList<>();

            for (PlanTimeBlock block : deliberateBlocks) {
                if ("dsa".equalsIgnoreCase(block.roleType())) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("title", probTitle);
                    item.put("type", "dsa");
                    item.put("difficulty", probDiff);
                    item.put("estimatedMinutes", block.minutes());
                    item.put("summary", "LeetCode #" + lcId + ": " + probTitle + " (" + String.join(", ", probTopics) + "). " + block.blockLabel() + " for " + targetRole + " at " + (bp != null ? bp.displayName() : "interview prep") + ".");
                    item.put("referenceLabel", "LeetCode #" + lcId);
                    item.put("referenceUrl", probUrl);
                    item.put("leetcodeId", lcId);
                    item.put("codingLabUrl", "/coding-lab?problem=" + lcId + "&url=" + URLEncoder.encode(probUrl, StandardCharsets.UTF_8) + "&title=" + URLEncoder.encode(probTitle, StandardCharsets.UTF_8));
                    item.put("rubricInsight", !currentStage.rubricTraps().isEmpty() ? currentStage.rubricTraps().get((d - 1) % currentStage.rubricTraps().size()) : "Clarify constraints and dry-run boundary edge cases.");
                    item.put("whyMattersForRole", "Tested frequently in " + (bp != null ? bp.displayName() : "target") + " technical screening loops to evaluate optimal complexity trade-offs for " + targetRole + ".");
                    item.put("evidenceRefs", currentStage.evidenceRefs());
                    items.add(item);
                } else if ("core_cs".equalsIgnoreCase(block.roleType())) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("title", coreTopic + " Deep Dive & Architecture");
                    item.put("type", "core_cs");
                    item.put("difficulty", "Medium");
                    item.put("estimatedMinutes", block.minutes());
                    item.put("summary", "Deliberate " + block.minutes() + "-minute focus on " + coreTopic + " principles, invariants, and architectural trade-offs.");
                    item.put("referenceLabel", coreTopic);
                    item.put("referenceUrl", "https://github.com/jwasham/coding-interview-university");
                    item.put("rubricInsight", "Be prepared to explain memory trade-offs and runtime invariants clearly.");
                    item.put("whyMattersForRole", "Directly evaluated in " + currentStage.name() + " for " + targetRole + " at " + (bp != null ? bp.displayName() : "interviews") + ".");
                    item.put("evidenceRefs", currentStage.evidenceRefs());
                    items.add(item);
                } else {
                    CompanyBlueprint.BehavioralFramework bh = bp != null ? bp.behavioralFramework() : null;
                    String bhQuestion = (bh != null && !bh.sampleQuestions().isEmpty())
                            ? bh.sampleQuestions().get((d - 1) % bh.sampleQuestions().size())
                            : "Describe a complex technical challenge you solved and the trade-offs involved.";
                    String bhPrinciple = (bh != null && !bh.principles().isEmpty())
                            ? bh.principles().get((d - 1) % bh.principles().size())
                            : "Technical Communication & Ownership";

                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("title", "Wrap-Up & Review: " + bhPrinciple);
                    item.put("type", "revision");
                    item.put("difficulty", "Easy");
                    item.put("estimatedMinutes", block.minutes());
                    item.put("summary", "Identified " + block.minutes() + "-minute wrap-up block: Spaced repetition and STAR reflection on: " + bhQuestion);
                    item.put("referenceLabel", (bh != null ? bh.name() : "Daily Review & Spaced Repetition"));
                    item.put("referenceUrl", "");
                    item.put("rubricInsight", "Structure answer with Situation, Task, Action, and Quantifiable Impact.");
                    item.put("whyMattersForRole", "Assesses collaborative alignment and engineering values for " + (bp != null ? bp.displayName() : "interviews") + ".");
                    items.add(item);
                }
            }

            Map<String, Object> dayMap = new LinkedHashMap<>();
            dayMap.put("day", "Day " + d);
            dayMap.put("theme", currentStage.name() + " Focus: " + coreTopic);
            dayMap.put("totalEstimatedMinutes", safeTimePerDay);
            dayMap.put("items", items);
            tasks.add(dayMap);
        }

        // 3. Resources
        List<Map<String, Object>> resources = new ArrayList<>();
        if (bp != null) {
            List<Map<String, String>> officialItems = new ArrayList<>();
            for (CompanyBlueprint.VerifiedDoc doc : bp.verifiedDocs()) {
                officialItems.add(Map.of("title", doc.title(), "type", "official", "url", doc.url()));
            }
            if (!officialItems.isEmpty()) {
                resources.add(Map.of("topic", "Official " + bp.displayName() + " Preparation Guidance", "items", officialItems));
            }
        }
        resources.add(Map.of("topic", "Data Structures & Core Algorithms", "items", List.of(
                Map.of("title", "LeetCode Curated Interview Patterns", "type", "practice", "url", "https://leetcode.com/explore/"),
                Map.of("title", "Coding Interview University Curated Syllabus", "type", "article", "url", "https://github.com/jwasham/coding-interview-university")
        )));
        resources.add(Map.of("topic", "System Architecture & Engineering Fundamentals", "items", List.of(
                Map.of("title", "Operating Systems: Three Easy Pieces (OSTEP)", "type", "book", "url", "https://pages.cs.wisc.edu/~remzi/OSTEP/"),
                Map.of("title", "Use The Index, Luke! - Database Performance", "type", "article", "url", "https://use-the-index-luke.com/")
        )));

        // 4. Flashcards
        List<Map<String, Object>> flashcards = List.of(
                Map.of("topic", "Data Structures", "question", "What is the worst-case and amortized time complexity of inserting into a Dynamic Array (ArrayList / vector)?", "answer", "Worst-case is O(N) when resizing and copying elements; amortized time complexity is O(1) per insertion."),
                Map.of("topic", "Graph Algorithms", "question", "When is BFS strictly preferred over DFS on an unweighted graph?", "answer", "BFS guarantees finding the shortest path (minimum number of edges) from the source to any reachable vertex."),
                Map.of("topic", "System Architecture", "question", "What is the difference between optimistic locking and pessimistic locking in database transactions?", "answer", "Pessimistic locking prevents concurrency anomalies by acquiring explicit row/table locks (e.g. SELECT FOR UPDATE); optimistic locking checks a version counter or timestamp at commit time without holding row locks."),
                Map.of("topic", "Concurrency", "question", "What are the four necessary conditions for a deadlock to occur in an operating system?", "answer", "1. Mutual Exclusion, 2. Hold and Wait, 3. No Preemption, 4. Circular Wait (Coffman conditions).")
        );

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("roadmap", roadmap);
        result.put("tasks", tasks);
        result.put("resources", resources);
        result.put("flashcards", flashcards);
        return result;
    }

    public void normalizeAndValidatePlan(
            List<Map<String, Object>> roadmap,
            List<Map<String, Object>> tasks,
            CompanyBlueprint bp,
            int timePerDay,
            int durationMonths
    ) {
        normalizeAndValidatePlan(roadmap, tasks, bp, timePerDay, durationMonths, "Software Development Engineer");
    }

    public void normalizeAndValidatePlan(
            List<Map<String, Object>> roadmap,
            List<Map<String, Object>> tasks,
            CompanyBlueprint bp,
            int timePerDay,
            int durationMonths,
            String targetRole
    ) {
        int safeTimePerDay = sanitizeTimePerDay(timePerDay);
        int safeMonths = Math.max(1, durationMonths);
        int totalWeeks = safeMonths * 4;
        double weeklyHours = Math.round(((5.0 * safeTimePerDay) / 60.0) * 10.0) / 10.0;

        // Ensure roadmap has totalWeeks
        while (roadmap.size() < totalWeeks) {
            int w = roadmap.size() + 1;
            Map<String, Object> copy = new LinkedHashMap<>(roadmap.get((w - 1) % roadmap.size()));
            copy.put("week", w);
            copy.put("title", "Week " + w + ": Advanced Polish & Interview Simulation");
            copy.put("theme", "Week " + w + ": Advanced Polish & Interview Simulation");
            copy.put("estimatedHours", weeklyHours);
            roadmap.add(copy);
        }
        // Normalize weekly hours across all weeks
        for (Map<String, Object> week : roadmap) {
            week.put("estimatedHours", weeklyHours);
        }

        // Validate task days using role-specific high frequency problems
        String roleLower = targetRole != null ? targetRole.toLowerCase().trim() : "";
        boolean isAi = roleLower.contains("ai") || roleLower.contains("machine learning") || roleLower.contains("ml") || roleLower.contains("deep learning") || roleLower.contains("data scientist") || roleLower.contains("nlp");
        boolean isBackend = roleLower.contains("backend") || roleLower.contains("cloud") || roleLower.contains("systems") || roleLower.contains("distributed") || roleLower.contains("platform") || roleLower.contains("devops") || roleLower.contains("sre");
        boolean isFrontend = roleLower.contains("front") || roleLower.contains("react") || roleLower.contains("ui") || roleLower.contains("web") || roleLower.contains("mobile") || roleLower.contains("ios") || roleLower.contains("android");
        boolean isIntern = roleLower.contains("intern") || roleLower.contains("student") || roleLower.contains("junior") || roleLower.contains("entry") || roleLower.contains("graduate");

        List<Integer> highFreq;
        if (isAi) {
            highFreq = List.of(74, 1, 48, 53, 238);
        } else if (isBackend) {
            highFreq = List.of(56, 1, 20, 15, 33);
        } else if (isFrontend) {
            highFreq = List.of(20, 3, 125, 226, 1);
        } else {
            highFreq = (bp != null && !bp.highFrequencyLeetCodeIds().isEmpty())
                    ? bp.highFrequencyLeetCodeIds()
                    : List.of(704, 1, 21, 70, 104);
        }
        int itemCounter = 0;
        List<PlanTimeBlock> deliberateBlocks = computeDeliberateBlocks(safeTimePerDay);

        for (Map<String, Object> day : tasks) {
            day.put("totalEstimatedMinutes", safeTimePerDay);
            Object itemsObj = day.get("items");
            if (itemsObj instanceof List) {
                List<Map<String, Object>> items = (List<Map<String, Object>>) itemsObj;

                for (int i = 0; i < items.size(); i++) {
                    Map<String, Object> item = items.get(i);
                    itemCounter++;
                    int targetBlockMin = i < deliberateBlocks.size()
                            ? deliberateBlocks.get(i).minutes()
                            : deliberateBlocks.get(deliberateBlocks.size() - 1).minutes();
                    item.put("estimatedMinutes", targetBlockMin);

                    String type = (String) item.getOrDefault("type", "");
                    String title = (String) item.getOrDefault("title", "");
                    String refLabel = (String) item.getOrDefault("referenceLabel", "");

                    if (type.equalsIgnoreCase("dsa") || title.toLowerCase().contains("leetcode") || refLabel.toLowerCase().contains("leetcode")) {
                        Optional<LeetCodeCatalogService.CanonicalProblemMeta> metaOpt = leetCodeCatalogService.findProblem(refLabel);
                        if (metaOpt.isEmpty()) {
                            metaOpt = leetCodeCatalogService.findProblem(title);
                        }

                        if (metaOpt.isPresent()) {
                            LeetCodeCatalogService.CanonicalProblemMeta meta = metaOpt.get();
                            if (!meta.number().isBlank()) {
                                try {
                                    item.put("leetcodeId", Integer.parseInt(meta.number()));
                                } catch (Exception ignored) {}
                            }
                            item.put("referenceLabel", "LeetCode #" + meta.number());
                            item.put("referenceUrl", meta.url());
                            item.put("codingLabUrl", "/coding-lab?problem=" + meta.number() + "&url=" + URLEncoder.encode(meta.url(), StandardCharsets.UTF_8) + "&title=" + URLEncoder.encode(meta.title(), StandardCharsets.UTF_8));
                        } else {
                            int substituteId = highFreq.get(itemCounter % highFreq.size());
                            Optional<LeetCodeCatalogService.CanonicalProblemMeta> subMeta = leetCodeCatalogService.findByNumber(substituteId);
                            if (subMeta.isPresent()) {
                                LeetCodeCatalogService.CanonicalProblemMeta sm = subMeta.get();
                                item.put("title", sm.title());
                                item.put("leetcodeId", substituteId);
                                item.put("referenceLabel", "LeetCode #" + substituteId);
                                item.put("referenceUrl", sm.url());
                                item.put("summary", "LeetCode #" + substituteId + ": " + sm.title() + " - Grounded canonical problem for " + (bp != null ? bp.displayName() : "interview prep") + ".");
                                item.put("codingLabUrl", "/coding-lab?problem=" + substituteId + "&url=" + URLEncoder.encode(sm.url(), StandardCharsets.UTF_8) + "&title=" + URLEncoder.encode(sm.title(), StandardCharsets.UTF_8));
                            }
                        }
                    }
                }

                // If items list is shorter than deliberate blocks, add remaining deliberate blocks
                while (items.size() < deliberateBlocks.size()) {
                    PlanTimeBlock missingBlock = deliberateBlocks.get(items.size());
                    Map<String, Object> newItem = new LinkedHashMap<>();
                    if ("core_cs".equalsIgnoreCase(missingBlock.roleType())) {
                        newItem.put("title", "Core CS & Systems Engineering Block");
                        newItem.put("type", "core_cs");
                        newItem.put("difficulty", "Medium");
                        newItem.put("estimatedMinutes", missingBlock.minutes());
                        newItem.put("summary", "Deliberate " + missingBlock.minutes() + "-minute focus on systems engineering fundamentals and invariants.");
                        newItem.put("referenceLabel", "Systems Engineering");
                        newItem.put("referenceUrl", "https://github.com/jwasham/coding-interview-university");
                    } else {
                        newItem.put("title", "Spaced Repetition & Daily Wrap-Up");
                        newItem.put("type", "revision");
                        newItem.put("difficulty", "Easy");
                        newItem.put("estimatedMinutes", missingBlock.minutes());
                        newItem.put("summary", "Identified " + missingBlock.minutes() + "-minute wrap-up block: Spaced repetition and review.");
                        newItem.put("referenceLabel", "Daily Review & Spaced Repetition");
                        newItem.put("referenceUrl", "");
                    }
                    items.add(newItem);
                }

                // Strictly enforce daily total equals safeTimePerDay
                int currentTotal = items.stream().mapToInt(it -> ((Number) it.get("estimatedMinutes")).intValue()).sum();
                if (currentTotal != safeTimePerDay && !items.isEmpty()) {
                    int diff = safeTimePerDay - currentTotal;
                    Map<String, Object> lastItem = items.get(items.size() - 1);
                    int lastMin = lastItem.get("estimatedMinutes") instanceof Number ? ((Number) lastItem.get("estimatedMinutes")).intValue() : 30;
                    lastItem.put("estimatedMinutes", Math.max(15, lastMin + diff));
                }
            }
        }
    }

    public Map<String, Object> createAndPersistPlan(User user, Map<String, Object> req) {
        ResearchReport researchReport = roleResearchService.conductResearch(req);
        String targetRole = researchReport.targetRole;
        String companyKey = researchReport.companyKey;
        String companyLabel = researchReport.companyName;
        String seniority = researchReport.seniority;
        String location = researchReport.location;
        String customCompanyName = (String) req.get("customCompanyName");

        int timePerDay = sanitizeTimePerDay(req.get("timePerDay"));
        int durationMonths = req.get("durationMonths") instanceof Number ? ((Number) req.get("durationMonths")).intValue() : 1;
        durationMonths = Math.max(1, durationMonths);
        int totalWeeks = durationMonths * 4;
        String preferredLanguage = (String) req.getOrDefault("preferredLanguage", "english");

        List<String> knownTopics = req.get("knownTopics") instanceof List ? (List<String>) req.get("knownTopics") : List.of("Arrays", "Strings");
        List<String> targetTopics = req.get("targetTopics") instanceof List ? (List<String>) req.get("targetTopics") : (researchReport.diagnosticTopics != null && !researchReport.diagnosticTopics.isEmpty() ? researchReport.diagnosticTopics : List.of("Queues", "Binary Trees", "DBMS", "Operating Systems"));

        CompanyBlueprint bp = researchReport.blueprint != null ? researchReport.blueprint : roleResearchService.getBlueprintOrDefault(companyKey);

        UUID planId = UUID.randomUUID();
        int version = 1;
        try {
            Integer maxVer = jdbcTemplate.queryForObject("SELECT COALESCE(MAX(version), 0) FROM prep_plans WHERE user_id = ?", Integer.class, user.getId());
            if (maxVer != null) version = maxVer + 1;
        } catch (Exception ignored) {
        }

        String title = targetRole + ": " + companyLabel + " Target Track";
        String coachLine = "Targeted " + durationMonths + "-month (" + totalWeeks + "-week) plan for " + targetRole + " at " + companyLabel + " (" + seniority + "). Grounded in verified hiring rubrics.";

        List<Map<String, Object>> roadmap = null;
        List<Map<String, Object>> tasks = null;
        List<Map<String, Object>> resources = null;
        List<Map<String, Object>> flashcards = null;

        // Try AI generation first if provider credentials exist
        boolean hasAiCreds = (!this.apiKey.isBlank() && !this.openRouterExhausted) || !this.geminiApiKey.isBlank();
        if (hasAiCreds) {
            try {
                String systemPrompt = "You are Prep Architect, PlacePrep's technical curriculum engine. Return ONLY valid, raw JSON with NO markdown fences, no backticks, and no conversation.";
                String userPrompt = "Build a high-signal, realistic preparation curriculum for a student targeting " + targetRole + " at " + companyLabel + ".\n"
                        + "Parameters: " + timePerDay + " mins/day, duration: " + durationMonths + " month(s) (" + totalWeeks + " weeks), language: " + preferredLanguage + ".\n"
                        + "Company Blueprint: " + (bp != null ? bp.displayName() + ", High Frequency Problem IDs: " + bp.highFrequencyLeetCodeIds() : "Standard SDE") + ".\n\n"
                        + "Return a JSON object with this EXACT structure:\n"
                        + "{\n"
                        + "  \"roadmap\": [\n"
                        + "    {\"week\": 1, \"title\": \"...\", \"focusTopics\": [\"...\"], \"estimatedHours\": " + ((5.0 * timePerDay) / 60.0) + ", \"goals\": [\"...\"]}\n"
                        + "  ],\n"
                        + "  \"tasks\": [\n"
                        + "    {\"day\": \"Day 1\", \"theme\": \"...\", \"totalEstimatedMinutes\": " + timePerDay + ", \"items\": [\n"
                        + "      {\"title\": \"...\", \"type\": \"dsa\", \"difficulty\": \"Medium\", \"estimatedMinutes\": " + (int)(timePerDay * 0.45) + ", \"summary\": \"...\", \"referenceLabel\": \"LeetCode #...\", \"referenceUrl\": \"https://leetcode.com/problems/...\"}\n"
                        + "    ]}\n"
                        + "  ],\n"
                        + "  \"resources\": [...],\n"
                        + "  \"flashcards\": [...]\n"
                        + "}";

                String raw = completePrompt(systemPrompt, userPrompt);
                if (raw != null && !raw.isBlank()) {
                    int firstBrace = raw.indexOf('{');
                    int lastBrace = raw.lastIndexOf('}');
                    if (firstBrace >= 0 && lastBrace > firstBrace) {
                        Map<String, Object> parsed = JsonUtil.toMap(raw.substring(firstBrace, lastBrace + 1));
                        if (parsed.containsKey("roadmap") && parsed.containsKey("tasks")) {
                            roadmap = JsonUtil.toListOfMaps(JsonUtil.toJson(parsed.get("roadmap")));
                            tasks = JsonUtil.toListOfMaps(JsonUtil.toJson(parsed.get("tasks")));
                            if (parsed.containsKey("resources")) resources = JsonUtil.toListOfMaps(JsonUtil.toJson(parsed.get("resources")));
                            if (parsed.containsKey("flashcards")) flashcards = JsonUtil.toListOfMaps(JsonUtil.toJson(parsed.get("flashcards")));
                        }
                    }
                }
            } catch (Exception ex) {
                System.err.println("[AiService] Dynamic plan generation via AI failed: " + ex.getMessage());
            }
        }

        // Validate and normalize if AI returned data, or fallback to deterministic curriculum
        if (roadmap != null && tasks != null && !roadmap.isEmpty() && !tasks.isEmpty()) {
            normalizeAndValidatePlan(roadmap, tasks, bp, timePerDay, durationMonths, targetRole);
        } else {
            Map<String, Object> deterministic = generateDeterministicCurriculum(bp, researchReport, timePerDay, durationMonths, targetRole);
            roadmap = (List<Map<String, Object>>) deterministic.get("roadmap");
            tasks = (List<Map<String, Object>>) deterministic.get("tasks");
            if (resources == null || resources.isEmpty()) resources = (List<Map<String, Object>>) deterministic.get("resources");
            if (flashcards == null || flashcards.isEmpty()) flashcards = (List<Map<String, Object>>) deterministic.get("flashcards");
        }

        // Attach direct codingLabUrl to all DSA / coding items
        List<Map<String, Object>> mutableTasks = new ArrayList<>();
        for (Map<String, Object> day : tasks) {
            Map<String, Object> dayCopy = new LinkedHashMap<>(day);
            Object itemsObj = day.get("items");
            if (itemsObj instanceof List) {
                List<Map<String, Object>> itemsList = (List<Map<String, Object>>) itemsObj;
                List<Map<String, Object>> itemsCopy = new ArrayList<>();
                for (Map<String, Object> item : itemsList) {
                    Map<String, Object> itemCopy = new LinkedHashMap<>(item);
                    String itemTitle = (String) itemCopy.get("title");
                    String refLabel = (String) itemCopy.get("referenceLabel");
                    String refUrl = (String) itemCopy.get("referenceUrl");
                    String problemQuery = refLabel != null ? refLabel : itemTitle;
                    if (problemQuery != null) {
                        itemCopy.put("codingLabUrl", "/coding-lab?problem=" + URLEncoder.encode(problemQuery, StandardCharsets.UTF_8)
                                + (refUrl != null ? "&url=" + URLEncoder.encode(refUrl, StandardCharsets.UTF_8) : "")
                                + "&title=" + URLEncoder.encode(itemTitle != null ? itemTitle : "", StandardCharsets.UTF_8));
                    }
                    itemsCopy.add(itemCopy);
                }
                dayCopy.put("items", itemsCopy);
            }
            mutableTasks.add(dayCopy);
        }
        tasks = mutableTasks;

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("title", title);
        metadata.put("autoTitle", title);
        metadata.put("coachLine", coachLine);
        metadata.put("titleSource", "generated");
        metadata.put("companyKey", companyKey);
        metadata.put("companyName", companyLabel);
        metadata.put("customCompanyName", customCompanyName);
        metadata.put("seniority", seniority);
        metadata.put("location", location);
        metadata.put("timePerDay", timePerDay);
        metadata.put("durationMonths", durationMonths);
        metadata.put("totalWeeks", totalWeeks);
        metadata.put("plannedWeeklyHours", Math.round(((5.0 * timePerDay) / 60.0) * 10.0) / 10.0);
        metadata.put("totalPlannedHours", Math.round(((totalWeeks * 5.0 * timePerDay) / 60.0) * 10.0) / 10.0);
        metadata.put("preferredLanguage", preferredLanguage);
        metadata.put("status", "assessment_pending");
        metadata.put("researchReport", researchReport.toMap());
        metadata.put("isGeneralGuidance", researchReport.evidenceSummary.get("isGeneralGuidance"));
        metadata.put("guidanceClassification", researchReport.evidenceSummary.get("guidanceClassification"));
        metadata.put("verifiedSourcesCount", researchReport.sources.size());
        metadata.put("coreCompetencies", researchReport.coreCompetencies);
        if (bp != null) {
            metadata.put("blueprintCompanyId", bp.companyId());
            metadata.put("blueprintDisplayName", bp.displayName());
            metadata.put("assessmentPlatform", bp.assessmentPlatform());
            metadata.put("highFrequencyLeetCodeIds", bp.highFrequencyLeetCodeIds());
            metadata.put("stages", bp.stages());
        }
        if (req.get("targetDeadline") != null) metadata.put("targetDeadline", req.get("targetDeadline"));
        if (req.get("jobDescription") != null) metadata.put("jobDescription", req.get("jobDescription"));
        if (req.get("jobPostingUrl") != null) metadata.put("jobPostingUrl", req.get("jobPostingUrl"));

        // Deactivate previous plans for user
        jdbcTemplate.update("UPDATE prep_plans SET is_active = FALSE WHERE user_id = ?", user.getId());

        // Insert new plan first so baseline assessment session can reference plan_id foreign key
        jdbcTemplate.update(
                "INSERT INTO prep_plans (id, user_id, known_topics, target_topics, roadmap, tasks, resources, flashcards, time_per_day, duration_months, target_role, version, is_active, metadata, created_at, updated_at) " +
                        "VALUES (?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?, ?, TRUE, ?::jsonb, NOW(), NOW())",
                planId,
                user.getId(),
                JsonUtil.toJson(knownTopics),
                JsonUtil.toJson(targetTopics),
                JsonUtil.toJson(roadmap),
                JsonUtil.toJson(tasks),
                JsonUtil.toJson(resources),
                JsonUtil.toJson(flashcards),
                timePerDay,
                durationMonths,
                targetRole,
                version,
                JsonUtil.toJson(metadata)
        );

        AssessmentSession baselineSession = null;
        try {
            baselineSession = assessmentService.generateBaselineAssessment(user, planId, researchReport, req);
            if (baselineSession != null) {
                metadata.put("pendingBaselineAssessmentId", baselineSession.getId().toString());
                metadata.put("baselineStatus", "pending");
                jdbcTemplate.update("UPDATE prep_plans SET metadata = ?::jsonb WHERE id = ?", JsonUtil.toJson(metadata), planId);
            }
        } catch (Exception ex) {
            System.err.println("[AiService] Warning generating baseline assessment: " + ex.getMessage());
        }

        Map<String, Object> created = new LinkedHashMap<>();
        created.put("id", planId.toString());
        created.put("userId", user.getId().toString());
        created.put("knownTopics", knownTopics);
        created.put("targetTopics", targetTopics);
        created.put("roadmap", roadmap);
        created.put("tasks", tasks);
        created.put("resources", resources);
        created.put("flashcards", flashcards);
        created.put("timePerDay", timePerDay);
        created.put("durationMonths", durationMonths);
        created.put("targetRole", targetRole);
        created.put("version", version);
        created.put("isActive", true);
        created.put("status", "assessment_pending");
        created.put("metadata", metadata);
        created.put("title", title);
        created.put("autoTitle", title);
        created.put("coachLine", coachLine);
        created.put("companyKey", companyKey);
        created.put("companyName", companyLabel);
        created.put("customCompanyName", customCompanyName);
        created.put("seniority", seniority);
        created.put("location", location);
        created.put("preferredLanguage", preferredLanguage);
        created.put("researchReport", researchReport.toMap());
        created.put("verifiedSourcesCount", researchReport.sources.size());
        created.put("coreCompetencies", researchReport.coreCompetencies);
        if (baselineSession != null) {
            created.put("pendingBaselineAssessmentId", baselineSession.getId().toString());
            created.put("baselineSession", baselineSession);
        }
        created.put("createdAt", LocalDate.now().toString());
        created.put("updatedAt", LocalDate.now().toString());
        return created;
    }

    public Map<String, Object> finalizePlanAfterBaseline(
            User user,
            UUID planId,
            UUID baselineSessionId,
            Map<String, Double> topicScores,
            List<String> weakSpots
    ) {
        List<Map<String, Object>> plans = jdbcTemplate.query(
                "SELECT * FROM prep_plans WHERE id = ? AND user_id = ?",
                (rs, rowNum) -> mapRowToPrepPlan(rs),
                planId, user.getId()
        );
        if (plans.isEmpty()) {
            return getLatestPrepPlan(user);
        }
        Map<String, Object> plan = plans.get(0);
        Map<String, Object> metadata = (Map<String, Object>) plan.getOrDefault("metadata", new LinkedHashMap<>());

        List<String> confirmedWeak = new ArrayList<>(weakSpots);
        List<String> confirmedStrong = new ArrayList<>();
        if (topicScores != null) {
            for (Map.Entry<String, Double> entry : topicScores.entrySet()) {
                if (entry.getValue() < 60.0 && !confirmedWeak.contains(entry.getKey())) {
                    confirmedWeak.add(entry.getKey());
                } else if (entry.getValue() >= 80.0) {
                    confirmedStrong.add(entry.getKey());
                }
            }
        }

        try {
            if (!confirmedWeak.isEmpty()) {
                String weakJson = JsonUtil.toJson(confirmedWeak);
                jdbcTemplate.update("UPDATE users SET weak_areas = ?::jsonb, updated_at = NOW() WHERE id = ?", weakJson, user.getId());
                user.setWeakAreas(confirmedWeak);
            }
        } catch (Exception ignored) {}

        List<Map<String, Object>> currentRoadmap = (List<Map<String, Object>>) plan.get("roadmap");
        List<Map<String, Object>> calibratedRoadmap = new ArrayList<>();
        if (currentRoadmap != null) {
            int weekNum = 1;
            for (Map<String, Object> w : currentRoadmap) {
                Map<String, Object> wCopy = new LinkedHashMap<>(w);
                if (weekNum == 1 && !confirmedWeak.isEmpty()) {
                    wCopy.put("title", "Remediation & Core Foundation: " + String.join(", ", confirmedWeak));
                    wCopy.put("theme", "Remediation & Core Foundation: " + String.join(", ", confirmedWeak));
                    wCopy.put("focusTopics", confirmedWeak);
                    wCopy.put("topics", confirmedWeak);
                    wCopy.put("goal", "Remediate diagnostic weak areas (" + String.join(", ", confirmedWeak) + ") with high-frequency targeted drills.");
                } else if (weekNum == 2 && confirmedWeak.size() > 1) {
                    List<String> secondaryWeak = confirmedWeak.subList(1, confirmedWeak.size());
                    wCopy.put("focusTopics", secondaryWeak);
                }
                calibratedRoadmap.add(wCopy);
                weekNum++;
            }
        }

        String companyName = (String) metadata.getOrDefault("companyName", "Target Company");
        String targetRole = (String) plan.getOrDefault("targetRole", "SDE");
        int timePerDay = sanitizeTimePerDay(plan.get("timePerDay"));

        List<Task> generatedTasks = new ArrayList<>();
        LocalDate today = LocalDate.now();

        String focusTopic1 = !confirmedWeak.isEmpty() ? confirmedWeak.get(0) : "Dynamic Programming";
        Task t1 = new Task();
        t1.setUserId(user.getId());
        t1.setTitle(focusTopic1 + " Core Patterns & Optimal Substructure");
        t1.setDescription("Diagnostic highlighted immediate focus on " + focusTopic1 + ". Drill foundational invariants and verify boundary edge cases.");
        t1.setCategory("DSA");
        t1.setSubcategory(focusTopic1);
        t1.setPriority("high");
        t1.setIntensity("high");
        t1.setDifficulty(3);
        t1.setEstimatedMinutes(Math.min(50, timePerDay / 2));
        t1.setScheduledFor(today);
        t1.setAiGenerated(true);
        t1.setReferenceLabel("Coding Lab: " + focusTopic1);
        t1.setReferenceUrl("/coding-lab?problem=" + URLEncoder.encode(focusTopic1 + " Diagnostic Drill", StandardCharsets.UTF_8));
        Map<String, Object> t1Meta = new LinkedHashMap<>();
        t1Meta.put("whyMattersForRole", "Crucial for " + targetRole + " interviews at " + companyName + " to demonstrate optimal space-time trade-offs.");
        t1Meta.put("whyAssignedToYou", "Assigned based on your baseline diagnostic assessment where " + focusTopic1 + " scored below target benchmark (" + (topicScores != null && topicScores.containsKey(focusTopic1) ? topicScores.get(focusTopic1) + "%" : "diagnostic gap") + ").");
        t1Meta.put("planId", planId.toString());
        t1.setMetadata(t1Meta);
        generatedTasks.add(t1);

        String roleLower = targetRole != null ? targetRole.toLowerCase() : "";
        boolean isAi = roleLower.contains("ai") || roleLower.contains("machine learning") || roleLower.contains("ml") || roleLower.contains("deep learning") || roleLower.contains("data scientist") || roleLower.contains("nlp");
        boolean isBackend = roleLower.contains("backend") || roleLower.contains("cloud") || roleLower.contains("systems") || roleLower.contains("distributed") || roleLower.contains("platform") || roleLower.contains("devops") || roleLower.contains("sre");
        boolean isFrontend = roleLower.contains("front") || roleLower.contains("react") || roleLower.contains("ui") || roleLower.contains("web") || roleLower.contains("mobile") || roleLower.contains("ios") || roleLower.contains("android");
        boolean isIntern = roleLower.contains("intern") || roleLower.contains("student") || roleLower.contains("junior") || roleLower.contains("entry") || roleLower.contains("graduate");

        String defaultTopic2 = isAi ? "NumPy Vectorization & Feature Pipelines" : (isBackend ? "DBMS & System Concurrency" : (isFrontend ? "Browser Event Loop & Web Vitals" : "Operating Systems & Concurrency"));
        String focusTopic2 = confirmedWeak.size() > 1 ? confirmedWeak.get(1) : defaultTopic2;
        Task t2 = new Task();
        t2.setUserId(user.getId());
        t2.setTitle(focusTopic2 + " Mechanics & Production Patterns");
        t2.setDescription("Review query execution plans, transaction isolation anomalies, and index access for " + focusTopic2 + ".");
        t2.setCategory("Core");
        t2.setSubcategory(focusTopic2);
        t2.setPriority("medium");
        t2.setIntensity("medium");
        t2.setDifficulty(3);
        t2.setEstimatedMinutes(Math.min(40, timePerDay / 3));
        t2.setScheduledFor(today);
        t2.setAiGenerated(true);
        t2.setReferenceLabel(focusTopic2 + " Reference");
        t2.setReferenceUrl("https://geeksforgeeks.org");
        Map<String, Object> t2Meta = new LinkedHashMap<>();
        t2Meta.put("whyMattersForRole", "Consistently tested in technical screenings for " + targetRole + " roles at " + companyName + ".");
        t2Meta.put("whyAssignedToYou", "Calibrated to your skill assessment to eliminate knowledge blind spots before technical interview rounds.");
        t2Meta.put("planId", planId.toString());
        t2.setMetadata(t2Meta);
        generatedTasks.add(t2);

        // Preserve all existing tasks; only create calibrated tasks if today's pending count is low
        try {
            long existingPendingToday = taskRepository.listTasks(user.getId(), "today", "pending", null, null).size();
            if (existingPendingToday < 2) {
                for (Task gt : generatedTasks) {
                    taskRepository.createTask(gt);
                }
            }
        } catch (Exception ex) {
            System.err.println("[AiService] Error saving calibrated tasks: " + ex.getMessage());
        }

        metadata.put("status", "plan_ready");
        metadata.put("baselineCompletedAt", Instant.now().toString());
        metadata.put("baselineScore", topicScores != null ? topicScores.values().stream().mapToDouble(Double::doubleValue).average().orElse(70.0) : 70.0);
        metadata.put("topicScores", topicScores);
        metadata.put("confirmedWeakSpots", confirmedWeak);
        metadata.put("confirmedStrongSpots", confirmedStrong);
        metadata.put("coachLine", "Personalized roadmap calibrated to your baseline diagnostic. Priority focus on " + String.join(", ", confirmedWeak) + ".");

        jdbcTemplate.update(
                "UPDATE prep_plans SET roadmap = ?::jsonb, metadata = ?::jsonb, updated_at = NOW() WHERE id = ? AND user_id = ?",
                JsonUtil.toJson(calibratedRoadmap),
                JsonUtil.toJson(metadata),
                planId,
                user.getId()
        );

        plan.put("roadmap", calibratedRoadmap);
        plan.put("metadata", metadata);
        plan.put("coachLine", metadata.get("coachLine"));
        plan.put("status", "plan_ready");
        return plan;
    }

    private Map<String, Object> mapRowToPrepPlan(ResultSet rs) throws SQLException {
        Map<String, Object> plan = new LinkedHashMap<>();
        plan.put("id", rs.getObject("id").toString());
        plan.put("userId", rs.getObject("user_id").toString());
        plan.put("knownTopics", JsonUtil.toList(rs.getString("known_topics"), String.class));
        plan.put("targetTopics", JsonUtil.toList(rs.getString("target_topics"), String.class));
        List<Map<String, Object>> rawRoadmap = JsonUtil.toListOfMaps(rs.getString("roadmap"));
        List<Map<String, Object>> normalizedRoadmap = new ArrayList<>();
        int wIdx = 1;
        for (Map<String, Object> w : rawRoadmap) {
            Map<String, Object> copy = new LinkedHashMap<>(w);
            String title = (String) w.getOrDefault("title", w.getOrDefault("theme", "Week " + w.getOrDefault("week", wIdx)));
            copy.put("title", title);
            copy.put("theme", title);
            Object ft = w.getOrDefault("focusTopics", w.get("topics"));
            List<?> focusList = ft instanceof List ? (List<?>) ft : List.of();
            copy.put("focusTopics", focusList);
            copy.put("topics", focusList);
            int estHours = w.get("estimatedHours") instanceof Number ? ((Number) w.get("estimatedHours")).intValue() : (w.get("hours") instanceof Number ? ((Number) w.get("hours")).intValue() : 12);
            copy.put("estimatedHours", estHours);
            Object g = w.get("goals");
            List<?> goalList;
            if (g instanceof List && !((List<?>) g).isEmpty()) {
                goalList = (List<?>) g;
            } else {
                List<String> constructed = new ArrayList<>();
                if (w.get("goal") != null) constructed.add(w.get("goal").toString());
                if (w.get("milestone") != null) constructed.add(w.get("milestone").toString());
                if (constructed.isEmpty()) constructed.add("Lock core patterns and complete timed practice.");
                goalList = constructed;
            }
            copy.put("goals", goalList);
            normalizedRoadmap.add(copy);
            wIdx++;
        }
        plan.put("roadmap", normalizedRoadmap);
        plan.put("tasks", JsonUtil.toListOfMaps(rs.getString("tasks")));
        plan.put("resources", JsonUtil.toListOfMaps(rs.getString("resources")));
        plan.put("flashcards", JsonUtil.toListOfMaps(rs.getString("flashcards")));
        plan.put("timePerDay", rs.getInt("time_per_day"));
        plan.put("durationMonths", rs.getInt("duration_months"));
        plan.put("targetRole", rs.getString("target_role"));
        plan.put("version", rs.getInt("version"));
        plan.put("isActive", rs.getBoolean("is_active"));
        if (rs.getObject("source_plan_id") != null) {
            plan.put("sourcePlanId", rs.getObject("source_plan_id").toString());
        }
        Map<String, Object> metadata = JsonUtil.toMap(rs.getString("metadata"));
        plan.put("metadata", metadata);
        plan.put("title", metadata.getOrDefault("title", "Placement Preparation Track"));
        plan.put("autoTitle", metadata.getOrDefault("autoTitle", plan.get("title")));
        plan.put("coachLine", metadata.getOrDefault("coachLine", "Your placement preparation track is active."));
        plan.put("companyKey", metadata.get("companyKey"));
        plan.put("companyName", metadata.get("companyName"));
        plan.put("customCompanyName", metadata.get("customCompanyName"));
        plan.put("preferredLanguage", metadata.get("preferredLanguage"));
        plan.put("status", metadata.getOrDefault("status", "plan_ready"));
        plan.put("researchReport", metadata.get("researchReport"));
        plan.put("pendingBaselineAssessmentId", metadata.get("pendingBaselineAssessmentId"));
        plan.put("coreCompetencies", metadata.get("coreCompetencies"));
        plan.put("targetDeadline", metadata.get("targetDeadline"));
        plan.put("seniority", metadata.get("seniority"));
        plan.put("location", metadata.get("location"));
        plan.put("verifiedSourcesCount", metadata.get("verifiedSourcesCount"));
        plan.put("isGeneralGuidance", metadata.get("isGeneralGuidance"));
        plan.put("guidanceClassification", metadata.get("guidanceClassification"));
        plan.put("topicScores", metadata.get("topicScores"));
        plan.put("confirmedWeakSpots", metadata.get("confirmedWeakSpots"));
        plan.put("createdAt", rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toInstant().toString() : "");
        plan.put("updatedAt", rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toInstant().toString() : "");
        return plan;
    }
}
