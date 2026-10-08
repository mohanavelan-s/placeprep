package com.placeprep.service;

import com.placeprep.exception.AppException;
import com.placeprep.model.Task;
import com.placeprep.model.User;
import com.placeprep.repository.TaskRepository;
import com.placeprep.util.JsonUtil;
import org.springframework.beans.factory.annotation.Value;
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

    public Map<String, Object> createAndPersistPlan(User user, Map<String, Object> req) {
        String targetRole = (String) req.getOrDefault("targetRole", user.getTargetRole() != null ? user.getTargetRole() : "SDE Intern");
        String companyKey = (String) req.getOrDefault("companyKey", "custom");
        String customCompanyName = (String) req.get("customCompanyName");

        if ("custom".equalsIgnoreCase(companyKey)) {
            if (customCompanyName == null || customCompanyName.trim().isEmpty()) {
                throw new AppException("Company name is required when choosing a custom company.", HttpStatus.BAD_REQUEST);
            }
        }

        int timePerDay = req.get("timePerDay") instanceof Number ? ((Number) req.get("timePerDay")).intValue() : 120;
        int durationMonths = req.get("durationMonths") instanceof Number ? ((Number) req.get("durationMonths")).intValue() : 1;
        String preferredLanguage = (String) req.getOrDefault("preferredLanguage", "english");

        List<String> knownTopics = req.get("knownTopics") instanceof List ? (List<String>) req.get("knownTopics") : List.of("Arrays", "Strings");
        List<String> targetTopics = req.get("targetTopics") instanceof List ? (List<String>) req.get("targetTopics") : List.of("Queues", "Binary Trees", "DBMS", "Operating Systems");

        UUID planId = UUID.randomUUID();
        int version = 1;
        try {
            Integer maxVer = jdbcTemplate.queryForObject("SELECT COALESCE(MAX(version), 0) FROM prep_plans WHERE user_id = ?", Integer.class, user.getId());
            if (maxVer != null) version = maxVer + 1;
        } catch (Exception ignored) {
        }

        String companyLabel = customCompanyName != null && !customCompanyName.isBlank()
                ? customCompanyName.trim()
                : (companyKey.equalsIgnoreCase("custom") ? "Target Company" : companyKey.toUpperCase());
        String title = targetRole + ": " + companyLabel + " Target Track";
        String coachLine = "Targeted " + durationMonths + "-month plan for " + targetRole + " at " + companyLabel + " with " + timePerDay + " mins daily discipline.";

        List<Map<String, Object>> roadmap = null;
        List<Map<String, Object>> tasks = null;
        List<Map<String, Object>> resources = null;
        List<Map<String, Object>> flashcards = null;

        // Try AI generation first
        try {
            String systemPrompt = "You are Prep Architect, PlacePrep's technical curriculum engine. Return ONLY valid, raw JSON with NO markdown fences, no backticks, and no conversation.";
            String userPrompt = "Build a high-signal, realistic preparation curriculum for a student targeting " + targetRole + " at " + companyLabel + ".\n"
                    + "Parameters: " + timePerDay + " mins/day, duration: " + durationMonths + " month(s), language: " + preferredLanguage + ".\n\n"
                    + "Return a JSON object with this EXACT structure:\n"
                    + "{\n"
                    + "  \"roadmap\": [\n"
                    + "    {\"week\": 1, \"title\": \"...\", \"focusTopics\": [\"...\"], \"estimatedHours\": 12, \"goals\": [\"...\"]},\n"
                    + "    {\"week\": 2, \"title\": \"...\", \"focusTopics\": [\"...\"], \"estimatedHours\": 12, \"goals\": [\"...\"]},\n"
                    + "    {\"week\": 3, \"title\": \"...\", \"focusTopics\": [\"...\"], \"estimatedHours\": 12, \"goals\": [\"...\"]},\n"
                    + "    {\"week\": 4, \"title\": \"...\", \"focusTopics\": [\"...\"], \"estimatedHours\": 12, \"goals\": [\"...\"]}\n"
                    + "  ],\n"
                    + "  \"tasks\": [\n"
                    + "    {\"day\": \"Day 1\", \"theme\": \"...\", \"totalEstimatedMinutes\": " + timePerDay + ", \"items\": [\n"
                    + "      {\"title\": \"...\", \"type\": \"dsa\", \"difficulty\": \"Medium\", \"estimatedMinutes\": 45, \"summary\": \"...\", \"referenceLabel\": \"LeetCode #...\", \"referenceUrl\": \"https://leetcode.com/problems/...\"},\n"
                    + "      {\"title\": \"...\", \"type\": \"core_cs\", \"difficulty\": \"Medium\", \"estimatedMinutes\": 40, \"summary\": \"...\", \"referenceLabel\": \"Docs\", \"referenceUrl\": \"https://geeksforgeeks.org\"}\n"
                    + "    ]},\n"
                    + "    {\"day\": \"Day 2\", \"theme\": \"...\", \"totalEstimatedMinutes\": " + timePerDay + ", \"items\": [...]},\n"
                    + "    {\"day\": \"Day 3\", \"theme\": \"...\", \"totalEstimatedMinutes\": " + timePerDay + ", \"items\": [...]},\n"
                    + "    {\"day\": \"Day 4\", \"theme\": \"...\", \"totalEstimatedMinutes\": " + timePerDay + ", \"items\": [...]},\n"
                    + "    {\"day\": \"Day 5\", \"theme\": \"...\", \"totalEstimatedMinutes\": " + timePerDay + ", \"items\": [...]}\n"
                    + "  ],\n"
                    + "  \"resources\": [\n"
                    + "    {\"topic\": \"...\", \"items\": [{\"title\": \"...\", \"type\": \"practice\", \"url\": \"...\"}]}\n"
                    + "  ],\n"
                    + "  \"flashcards\": [\n"
                    + "    {\"topic\": \"...\", \"question\": \"...\", \"answer\": \"...\"}\n"
                    + "  ]\n"
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

        // Role-adaptive fallback if AI did not return a complete plan
        boolean isDataRole = targetRole.toLowerCase().contains("data") || targetRole.toLowerCase().contains("analyst") || targetRole.toLowerCase().contains("sql");
        boolean isFrontendRole = targetRole.toLowerCase().contains("front") || targetRole.toLowerCase().contains("react") || targetRole.toLowerCase().contains("ui");

        if (roadmap == null || roadmap.isEmpty()) {
            if (isDataRole) {
                roadmap = List.of(
                        Map.of("week", 1, "title", "SQL Schema & Relational Query Foundations", "theme", "SQL Schema & Relational Query Foundations", "focusTopics", List.of("SQL", "Relational Models", "Aggregations"), "topics", List.of("SQL", "Relational Models", "Aggregations"), "estimatedHours", 12, "goals", List.of("Master SELECT, WHERE, GROUP BY, HAVING, and basic joins", "Solve 15 LeetCode Database problems"), "goal", "Master SELECT, WHERE, GROUP BY, HAVING, and basic joins", "milestone", "Solve 15 LeetCode Database problems"),
                        Map.of("week", 2, "title", "Complex Joins, Window Functions & CTEs", "theme", "Complex Joins, Window Functions & CTEs", "focusTopics", List.of("Window Functions", "CTEs", "Subqueries"), "topics", List.of("Window Functions", "CTEs", "Subqueries"), "estimatedHours", 12, "goals", List.of("Master RANK, DENSE_RANK, ROW_NUMBER, and Recursive CTEs", "Write multi-table financial transaction analytics"), "goal", "Master RANK, DENSE_RANK, ROW_NUMBER, and Recursive CTEs", "milestone", "Write multi-table financial transaction analytics"),
                        Map.of("week", 3, "title", "Database Internals, Indexing & Query Tuning", "theme", "Database Internals, Indexing & Query Tuning", "focusTopics", List.of("Indexes", "Transactions", "ACID", "Sharding"), "topics", List.of("Indexes", "Transactions", "ACID", "Sharding"), "estimatedHours", 12, "goals", List.of("Understand B-Trees, explain query execution plans, and transactions", "Diagnose and optimize slow SQL queries"), "goal", "Understand B-Trees, explain query execution plans, and transactions", "milestone", "Diagnose and optimize slow SQL queries"),
                        Map.of("week", 4, "title", "End-to-End Analytics Loop & Business Insights", "theme", "End-to-End Analytics Loop & Business Insights", "focusTopics", List.of("Product Analytics", "A/B Testing", "Mock Interviews"), "topics", List.of("Product Analytics", "A/B Testing", "Mock Interviews"), "estimatedHours", 12, "goals", List.of("Product metrics, retention loops, and mock analytical interviews", "Readiness score > 85%"), "goal", "Product metrics, retention loops, and mock analytical interviews", "milestone", "Readiness score > 85%")
                );
            } else if (isFrontendRole) {
                roadmap = List.of(
                        Map.of("week", 1, "title", "DOM, CSS Architecture & JavaScript Core", "theme", "DOM, CSS Architecture & JavaScript Core", "focusTopics", List.of("JavaScript", "Event Loop", "DOM Manipulation"), "topics", List.of("JavaScript", "Event Loop", "DOM Manipulation"), "estimatedHours", 12, "goals", List.of("Master closures, event loop, promises, and prototypal inheritance", "Implement vanilla JS components from scratch"), "goal", "Master closures, event loop, promises, and prototypal inheritance", "milestone", "Implement vanilla JS components from scratch"),
                        Map.of("week", 2, "title", "React Internals & State Management", "theme", "React Internals & State Management", "focusTopics", List.of("React", "Hooks", "State Patterns"), "topics", List.of("React", "Hooks", "State Patterns"), "estimatedHours", 12, "goals", List.of("Deep dive into reconciliation, hooks lifecycle, memoization, and contexts", "Build a high-performance interactive dashboard"), "goal", "Deep dive into reconciliation, hooks lifecycle, memoization, and contexts", "milestone", "Build a high-performance interactive dashboard"),
                        Map.of("week", 3, "title", "Web Performance, Network & Core Web Vitals", "theme", "Web Performance, Network & Core Web Vitals", "focusTopics", List.of("Web Vitals", "Performance", "Security"), "topics", List.of("Web Vitals", "Performance", "Security"), "estimatedHours", 12, "goals", List.of("Optimize LCP, CLS, INP, code splitting, bundle sizes, and caching", "Pass Lighthouse audit with 95+ score"), "goal", "Optimize LCP, CLS, INP, code splitting, bundle sizes, and caching", "milestone", "Pass Lighthouse audit with 95+ score"),
                        Map.of("week", 4, "title", "Frontend System Design & Mock Interviews", "theme", "Frontend System Design & Mock Interviews", "focusTopics", List.of("Frontend System Design", "Mock Loops"), "topics", List.of("Frontend System Design", "Mock Loops"), "estimatedHours", 12, "goals", List.of("Architect large-scale web apps, offline sync, and real-time feeds", "Readiness score > 85%"), "goal", "Architect large-scale web apps, offline sync, and real-time feeds", "milestone", "Readiness score > 85%")
                );
            } else {
                roadmap = List.of(
                        Map.of("week", 1, "title", "Foundations & Linear Structures", "theme", "Foundations & Linear Structures", "focusTopics", List.of("Arrays", "Two Pointers", "Stacks", "Queues"), "topics", List.of("Arrays", "Two Pointers", "Stacks", "Queues"), "estimatedHours", 12, "goals", List.of("Master Arrays, Two Pointers, Sliding Window, and Stacks/Queues", "Solve 15 Easy/Medium questions"), "goal", "Master Arrays, Two Pointers, Sliding Window, and Stacks/Queues", "milestone", "Solve 15 Easy/Medium questions"),
                        Map.of("week", 2, "title", "Trees, Graphs & Recursion", "theme", "Trees, Graphs & Recursion", "focusTopics", List.of("Binary Trees", "BST", "BFS/DFS", "Graphs"), "topics", List.of("Binary Trees", "BST", "BFS/DFS", "Graphs"), "estimatedHours", 12, "goals", List.of("Build tree traversal intuition and graph search techniques", "Implement BFS/DFS from scratch"), "goal", "Build tree traversal intuition and graph search techniques", "milestone", "Implement BFS/DFS from scratch"),
                        Map.of("week", 3, "title", "Core Computer Science & Dynamic Programming", "theme", "Core Computer Science & Dynamic Programming", "focusTopics", List.of("DBMS", "OS", "DP Patterns"), "topics", List.of("DBMS", "OS", "DP Patterns"), "estimatedHours", 12, "goals", List.of("Strengthen DBMS transactions, OS concurrency, and DP memoization", "Complete full Core CS mock quiz"), "goal", "Strengthen DBMS transactions, OS concurrency, and DP memoization", "milestone", "Complete full Core CS mock quiz"),
                        Map.of("week", 4, "title", "System Design & Final Polish for " + companyLabel, "theme", "System Design & Final Polish for " + companyLabel, "focusTopics", List.of("System Design", "Mock Interviews"), "topics", List.of("System Design", "Mock Interviews"), "estimatedHours", 12, "goals", List.of("High-frequency interview simulations and mock loops", "Readiness score > 85%"), "goal", "High-frequency interview simulations and mock loops", "milestone", "Readiness score > 85%")
                );
            }
        }

        if (tasks == null || tasks.isEmpty()) {
            if (isDataRole) {
                tasks = List.of(
                        Map.of("day", "Day 1", "theme", "Basic SQL Aggregations & Grouping", "totalEstimatedMinutes", timePerDay, "items", List.of(
                                Map.of("title", "Fix Names in a Table", "type", "dsa", "difficulty", "Easy", "estimatedMinutes", 30, "summary", "LeetCode #1667: String manipulation and ordering in SQL.", "referenceLabel", "LeetCode #1667", "referenceUrl", "https://leetcode.com/problems/fix-names-in-a-table/"),
                                Map.of("title", "Duplicate Emails", "type", "dsa", "difficulty", "Easy", "estimatedMinutes", 25, "summary", "LeetCode #182: GROUP BY and HAVING count filtering.", "referenceLabel", "LeetCode #182", "referenceUrl", "https://leetcode.com/problems/duplicate-emails/"),
                                Map.of("title", "DBMS: Clustered vs Secondary Indexes", "type", "core_cs", "difficulty", "Medium", "estimatedMinutes", 45, "summary", "B-Tree node traversal and row pointers.", "referenceLabel", "Database Indexing", "referenceUrl", "https://use-the-index-luke.com/")
                        )),
                        Map.of("day", "Day 2", "theme", "Conditional Aggregations & Joins", "totalEstimatedMinutes", timePerDay, "items", List.of(
                                Map.of("title", "Monthly Transactions I", "type", "dsa", "difficulty", "Medium", "estimatedMinutes", 40, "summary", "LeetCode #1193: Multi-column CASE WHEN conditional sums.", "referenceLabel", "LeetCode #1193", "referenceUrl", "https://leetcode.com/problems/monthly-transactions-i/"),
                                Map.of("title", "Customers Who Never Order", "type", "dsa", "difficulty", "Easy", "estimatedMinutes", 25, "summary", "LeetCode #183: LEFT JOIN null filtering vs NOT IN.", "referenceLabel", "LeetCode #183", "referenceUrl", "https://leetcode.com/problems/customers-who-never-order/"),
                                Map.of("title", "SQL Query Execution Order", "type", "core_cs", "difficulty", "Easy", "estimatedMinutes", 30, "summary", "FROM -> WHERE -> GROUP BY -> HAVING -> SELECT -> ORDER BY.", "referenceLabel", "SQL Order", "referenceUrl", "https://www.geeksforgeeks.org")
                        )),
                        Map.of("day", "Day 3", "theme", "Self-Joins & Manager Hierarchies", "totalEstimatedMinutes", timePerDay, "items", List.of(
                                Map.of("title", "Employees Earning More Than Managers", "type", "dsa", "difficulty", "Easy", "estimatedMinutes", 30, "summary", "LeetCode #181: Self JOIN comparison logic.", "referenceLabel", "LeetCode #181", "referenceUrl", "https://leetcode.com/problems/employees-earning-more-than-their-managers/"),
                                Map.of("title", "Combine Two Tables", "type", "dsa", "difficulty", "Easy", "estimatedMinutes", 20, "summary", "LeetCode #175: Basic outer join relationship handling.", "referenceLabel", "LeetCode #175", "referenceUrl", "https://leetcode.com/problems/combine-two-tables/"),
                                Map.of("title", "Database Transaction Isolation Levels", "type", "core_cs", "difficulty", "Medium", "estimatedMinutes", 45, "summary", "Dirty reads, non-repeatable reads, phantom reads.", "referenceLabel", "ACID Isolation", "referenceUrl", "https://www.geeksforgeeks.org")
                        )),
                        Map.of("day", "Day 4", "theme", "Window Functions & Ranking", "totalEstimatedMinutes", timePerDay, "items", List.of(
                                Map.of("title", "Department Top Three Salaries", "type", "dsa", "difficulty", "Hard", "estimatedMinutes", 50, "summary", "LeetCode #185: DENSE_RANK partition analysis.", "referenceLabel", "LeetCode #185", "referenceUrl", "https://leetcode.com/problems/department-top-three-salaries/"),
                                Map.of("title", "Consecutive Numbers", "type", "dsa", "difficulty", "Medium", "estimatedMinutes", 40, "summary", "LeetCode #180: LEAD / LAG window offsets.", "referenceLabel", "LeetCode #180", "referenceUrl", "https://leetcode.com/problems/consecutive-numbers/")
                        )),
                        Map.of("day", "Day 5", "theme", "Mock Analytical Interview Loop", "totalEstimatedMinutes", timePerDay, "items", List.of(
                                Map.of("title", "Timed SQL Diagnostic Simulation", "type", "dsa", "difficulty", "Hard", "estimatedMinutes", 60, "summary", "Timed technical coding interview with edge cases in Coding Lab.", "referenceLabel", "Coding Lab", "referenceUrl", "/coding-lab"),
                                Map.of("title", "A/B Testing Metrics & P-Value Analysis", "type", "core_cs", "difficulty", "Medium", "estimatedMinutes", 40, "summary", "Hypothesis testing, statistical significance, and sample sizing.", "referenceLabel", "Analytics Metrics", "referenceUrl", "https://towardsdatascience.com")
                        ))
                );
            } else {
                tasks = List.of(
                        Map.of("day", "Day 1", "theme", "Queue & Stack Interview Patterns", "totalEstimatedMinutes", timePerDay, "items", List.of(
                                Map.of("title", "Implement Queue using Stacks", "type", "dsa", "difficulty", "Easy", "estimatedMinutes", 30, "summary", "LeetCode #232: Master two-stack amortized O(1) queue simulation.", "referenceLabel", "LeetCode #232", "referenceUrl", "https://leetcode.com/problems/implement-queue-using-stacks/"),
                                Map.of("title", "DBMS: Transaction Isolation Levels & ACID", "type", "core_cs", "difficulty", "Medium", "estimatedMinutes", 35, "summary", "Deep dive into Read Committed vs Repeatable Read vs Serializable anomalies.", "referenceLabel", "GeeksforGeeks DBMS", "referenceUrl", "https://www.geeksforgeeks.org/acid-properties-in-dbms/"),
                                Map.of("title", "Mini-Project: Queue-Based Transaction Buffer", "type", "project", "difficulty", "Medium", "estimatedMinutes", 55, "summary", "Build an in-memory batch processing queue with worker concurrency.", "referenceLabel", "Project Specs", "referenceUrl", "https://github.com")
                        )),
                        Map.of("day", "Day 2", "theme", "Trees & Recursion Traversal", "totalEstimatedMinutes", timePerDay, "items", List.of(
                                Map.of("title", "Binary Tree Level Order Traversal", "type", "dsa", "difficulty", "Medium", "estimatedMinutes", 40, "summary", "LeetCode #102: BFS queue traversal level by level.", "referenceLabel", "LeetCode #102", "referenceUrl", "https://leetcode.com/problems/binary-tree-level-order-traversal/"),
                                Map.of("title", "OS: Process Scheduling & CPU Dispatchers", "type", "core_cs", "difficulty", "Medium", "estimatedMinutes", 35, "summary", "Round Robin vs Priority vs Multi-Level Feedback Queue analysis.", "referenceLabel", "OS Scheduling", "referenceUrl", "https://www.geeksforgeeks.org/cpu-scheduling-in-operating-systems/"),
                                Map.of("title", "Revision: Queue and Tree Flashcards", "type", "revision", "difficulty", "Easy", "estimatedMinutes", 25, "summary", "Fast recall on queue time complexities and tree traversals.", "referenceLabel", "Flashcards", "referenceUrl", "")
                        )),
                        Map.of("day", "Day 3", "theme", "Database Indexing & Query Optimization", "totalEstimatedMinutes", timePerDay, "items", List.of(
                                Map.of("title", "B-Tree vs Hash Indexing Deep Dive", "type", "core_cs", "difficulty", "Medium", "estimatedMinutes", 45, "summary", "Learn clustered vs non-clustered index structures and explain analyze plans.", "referenceLabel", "Database Indexing", "referenceUrl", "https://use-the-index-luke.com/"),
                                Map.of("title", "Topological Sort & Dependency Resolution", "type", "dsa", "difficulty", "Medium", "estimatedMinutes", 50, "summary", "Kahn's algorithm using indegree queues for task dependencies.", "referenceLabel", "LeetCode #210", "referenceUrl", "https://leetcode.com/problems/course-schedule-ii/")
                        )),
                        Map.of("day", "Day 4", "theme", "OS Concurrency, Mutexes & Semaphores", "totalEstimatedMinutes", timePerDay, "items", List.of(
                                Map.of("title", "Deadlock Conditions & Prevention", "type", "core_cs", "difficulty", "Medium", "estimatedMinutes", 40, "summary", "Mutual exclusion, hold and wait, no preemption, circular wait.", "referenceLabel", "OS Deadlocks", "referenceUrl", "https://www.geeksforgeeks.org/deadlock-in-operating-system/"),
                                Map.of("title", "Binary Tree Upside Down / Path Inversion", "type", "dsa", "difficulty", "Medium", "estimatedMinutes", 45, "summary", "Problem #156: Invert binary tree topology cleanly with pointers.", "referenceLabel", "LeetCode #156", "referenceUrl", "https://leetcode.com/problems/binary-tree-upside-down/")
                        )),
                        Map.of("day", "Day 5", "theme", "Mock Interview Loop & Diagnostic Check", "totalEstimatedMinutes", timePerDay, "items", List.of(
                                Map.of("title", "Full 45-Min Mock DSA Simulation", "type", "dsa", "difficulty", "Hard", "estimatedMinutes", 60, "summary", "Timed technical coding interview with edge case testing.", "referenceLabel", "Coding Lab", "referenceUrl", "/coding-lab"),
                                Map.of("title", "System Design Concept: Cache-Aside vs Write-Through", "type", "system_design", "difficulty", "Medium", "estimatedMinutes", 40, "summary", "Redis caching patterns, cache stampede, and eviction policies.", "referenceLabel", "System Design", "referenceUrl", "https://bytebytego.com/")
                        ))
                );
            }
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

        if (resources == null || resources.isEmpty()) {
            resources = List.of(
                    Map.of("topic", "Data Structures & Algorithms", "items", List.of(
                            Map.of("title", "LeetCode Curated Interview Patterns", "type", "practice", "url", "https://leetcode.com/explore/"),
                            Map.of("title", "NeetCode Roadmap & Video Guides", "type", "video", "url", "https://neetcode.io/roadmap"),
                            Map.of("title", "GeeksforGeeks DSA Mastery Series", "type", "article", "url", "https://www.geeksforgeeks.org/data-structures/")
                    )),
                    Map.of("topic", "Core Computer Science & System Architecture", "items", List.of(
                            Map.of("title", "Operating Systems: Three Easy Pieces (OSTEP)", "type", "book", "url", "https://pages.cs.wisc.edu/~remzi/OSTEP/"),
                            Map.of("title", "Database System Concepts - Silberschatz", "type", "article", "url", "https://www.db-book.com/"),
                            Map.of("title", "ByteByteGo System Architecture Essentials", "type", "newsletter", "url", "https://bytebytego.com/")
                    ))
            );
        }

        if (flashcards == null || flashcards.isEmpty()) {
            flashcards = List.of(
                    Map.of("topic", "Queues & Stacks", "question", "What is the amortized complexity of enqueue/dequeue in a two-stack queue?", "answer", "O(1) amortized time complexity, because each element is pushed and popped at most twice."),
                    Map.of("topic", "DBMS", "question", "What is the difference between TRUNCATE and DELETE in SQL?", "answer", "DELETE is a DML statement that removes rows one by one and can be rolled back; TRUNCATE is a DDL statement that deallocates data pages, is faster, and resets auto-increment IDs."),
                    Map.of("topic", "Operating Systems", "question", "What causes thrashing in virtual memory?", "answer", "Thrashing happens when the CPU spends more time swapping pages in and out of secondary storage than executing actual processes because working sets exceed RAM."),
                    Map.of("topic", "Binary Trees", "question", "How do you check if a binary tree is height-balanced in O(N)?", "answer", "Use post-order traversal returning the height at each node, returning -1 immediately if left and right child heights differ by more than 1.")
            );
        }

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("title", title);
        metadata.put("autoTitle", title);
        metadata.put("coachLine", coachLine);
        metadata.put("titleSource", "generated");
        metadata.put("companyKey", companyKey);
        metadata.put("companyName", companyLabel);
        metadata.put("customCompanyName", customCompanyName);
        metadata.put("timePerDay", timePerDay);
        metadata.put("durationMonths", durationMonths);
        metadata.put("preferredLanguage", preferredLanguage);

        // Deactivate previous plans for user
        jdbcTemplate.update("UPDATE prep_plans SET is_active = FALSE WHERE user_id = ?", user.getId());

        // Insert new plan
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
        created.put("metadata", metadata);
        created.put("title", title);
        created.put("autoTitle", title);
        created.put("coachLine", coachLine);
        created.put("companyKey", companyKey);
        created.put("companyName", companyLabel);
        created.put("customCompanyName", customCompanyName);
        created.put("preferredLanguage", preferredLanguage);
        created.put("createdAt", LocalDate.now().toString());
        created.put("updatedAt", LocalDate.now().toString());
        return created;
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
        plan.put("createdAt", rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toInstant().toString() : "");
        plan.put("updatedAt", rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toInstant().toString() : "");
        return plan;
    }
}
