package com.placeprep.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.placeprep.model.DailyLog;
import com.placeprep.model.Task;
import com.placeprep.model.User;
import com.placeprep.model.UserProfile;
import com.placeprep.repository.TaskRepository;
import com.placeprep.repository.UserProfileRepository;
import com.placeprep.repository.UserRepository;
import com.placeprep.service.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@RestController
@RequestMapping("/mcp")
public class McpController {

    private final OAuthService oAuthService;
    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final TaskService taskService;
    private final ProgressService progressService;
    private final AuthService authService;
    private final AiService aiService;
    private final LogService logService;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final WebPushService webPushService;
    private final ObjectMapper objectMapper;

    public McpController(
            OAuthService oAuthService,
            UserRepository userRepository,
            UserProfileRepository userProfileRepository,
            TaskService taskService,
            ProgressService progressService,
            AuthService authService,
            AiService aiService,
            LogService logService,
            NotificationService notificationService,
            EmailService emailService,
            WebPushService webPushService,
            ObjectMapper objectMapper
    ) {
        this.oAuthService = oAuthService;
        this.userRepository = userRepository;
        this.userProfileRepository = userProfileRepository;
        this.taskService = taskService;
        this.progressService = progressService;
        this.authService = authService;
        this.aiService = aiService;
        this.logService = logService;
        this.notificationService = notificationService;
        this.emailService = emailService;
        this.webPushService = webPushService;
        this.objectMapper = objectMapper;
    }

    private void sendAuthChallenge(HttpServletRequest req, HttpServletResponse res, String error) {
        String metadataUrl = oAuthService.getPublicBaseUrl(req) + "/.well-known/oauth-protected-resource/mcp";
        String challenge = error != null
                ? String.format("Bearer error=\"%s\" resource_metadata=\"%s\"", error, metadataUrl)
                : String.format("Bearer resource_metadata=\"%s\"", metadataUrl);

        res.setHeader("WWW-Authenticate", challenge);
    }

    private ResponseEntity<Map<String, Object>> buildJsonRpcAuthError(HttpServletRequest req, HttpServletResponse res, String error, Object id) {
        sendAuthChallenge(req, res, error);
        Map<String, Object> errResponse = new LinkedHashMap<>();
        errResponse.put("jsonrpc", "2.0");
        errResponse.put("error", Map.of(
                "code", -32001,
                "message", "OAuth bearer authentication is required to access PlacePrep MCP."
        ));
        errResponse.put("id", id);
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errResponse);
    }

    @RequestMapping(
            method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.DELETE},
            consumes = MediaType.ALL_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public ResponseEntity<Map<String, Object>> handleMcp(
            HttpServletRequest req,
            HttpServletResponse res,
            @RequestBody(required = false) byte[] rawBody
    ) {
        Map<String, Object> body = null;
        if (rawBody != null && rawBody.length > 0) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> parsed = objectMapper.readValue(rawBody, Map.class);
                body = parsed;
            } catch (Exception ignored) {
                // Non-JSON probe
            }
        }
        Object reqId = body != null ? body.get("id") : null;

        String authHeader = req.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return buildJsonRpcAuthError(req, res, null, reqId);
        }

        String token = authHeader.substring(7).trim();
        String expectedResource = oAuthService.getResource(req);
        OAuthService.OAuthPrincipal principal = oAuthService.resolvePrincipal(token, expectedResource);

        if (principal == null) {
            return buildJsonRpcAuthError(req, res, "invalid_token", reqId);
        }

        Optional<User> userOpt = userRepository.findById(principal.userId);
        if (userOpt.isEmpty()) {
            return buildJsonRpcAuthError(req, res, "invalid_token", reqId);
        }

        User user = userOpt.get();

        if (body == null) {
            String baseUrl = oAuthService.getPublicBaseUrl(req);
            return ResponseEntity.ok(Map.of(
                    "status", "ok",
                    "service", "PlacePrep MCP",
                    "logo", baseUrl + "/logo.png",
                    "user", user.getEmail()
            ));
        }

        String method = (String) body.get("method");
        Object id = body.get("id");

        if ("initialize".equals(method)) {
            String baseUrl = oAuthService.getPublicBaseUrl(req);
            return ResponseEntity.ok(jsonRpcResult(id, Map.of(
                    "protocolVersion", "2024-11-05",
                    "capabilities", Map.of(
                            "tools", Map.of("listChanged", false)
                    ),
                    "serverInfo", Map.of(
                            "name", "PlacePrep MCP",
                            "title", "PlacePrep Placement Preparation MCP Server",
                            "version", "1.0.0",
                            "description", "Personalized placement preparation tools for tasks, readiness metrics, and coaching.",
                            "icon", baseUrl + "/logo.png",
                            "iconUrl", baseUrl + "/logo.png",
                            "logoUrl", baseUrl + "/logo.png",
                            "websiteUrl", baseUrl
                    )
            )));
        }

        if ("tools/list".equals(method)) {
            return ResponseEntity.ok(jsonRpcResult(id, Map.of(
                    "tools", getRegisteredTools()
            )));
        }

        if ("tools/call".equals(method)) {
            return handleToolCall(id, user, body);
        }

        if ("ping".equals(method)) {
            return ResponseEntity.ok(jsonRpcResult(id, Map.of()));
        }

        if (method != null && method.startsWith("notifications/")) {
            return ResponseEntity.accepted().body(Map.of());
        }

        return ResponseEntity.ok(jsonRpcError(id, -32601, "Method not found: " + method));
    }

    private List<Map<String, Object>> getRegisteredTools() {
        List<Map<String, Object>> tools = new ArrayList<>();

        // 1. Profile & Progress
        tools.add(Map.of(
                "name", "get_profile",
                "description", "Retrieve the authenticated student's placement preparation profile, target role, deadline, streak, readiness score, consistency score, and topic strengths.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(),
                        "additionalProperties", false
                )
        ));

        tools.add(Map.of(
                "name", "get_progress_summary",
                "description", "Retrieve the student's placement readiness analytics, weekly completion velocity, topic strengths, and AI coach directive.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(),
                        "additionalProperties", false
                )
        ));

        // 2. Task Retrieval
        tools.add(Map.of(
                "name", "get_tasks",
                "description", "List placement preparation tasks for the student with optional date, status, category, and limit filters.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "date", Map.of("type", "string", "description", "Date filter: 'today' or specific 'YYYY-MM-DD' date"),
                                "status", Map.of("type", "string", "enum", List.of("pending", "in_progress", "completed", "skipped"), "description", "Task status filter"),
                                "category", Map.of("type", "string", "enum", List.of("DSA", "Core", "Project", "Aptitude", "Resume", "MockInterview", "Other"), "description", "Task category filter"),
                                "limit", Map.of("type", "integer", "description", "Maximum number of tasks to return")
                        ),
                        "additionalProperties", false
                )
        ));

        tools.add(Map.of(
                "name", "get_task",
                "description", "Retrieve full details of a specific placement preparation task owned by the student by its unique UUID.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "taskId", Map.of("type", "string", "format", "uuid", "description", "Unique UUID of the task to retrieve")
                        ),
                        "required", List.of("taskId"),
                        "additionalProperties", false
                )
        ));

        tools.add(Map.of(
                "name", "search_tasks",
                "description", "Search the student's preparation tasks by text keyword across title, description, and subcategory, with optional status and category filters.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "query", Map.of("type", "string", "description", "Search text to match in task title, description, or subcategory"),
                                "status", Map.of("type", "string", "enum", List.of("pending", "in_progress", "completed", "skipped"), "description", "Filter by task status"),
                                "category", Map.of("type", "string", "enum", List.of("DSA", "Core", "Project", "Aptitude", "Resume", "MockInterview", "Other"), "description", "Filter by category"),
                                "limit", Map.of("type", "integer", "minimum", 1, "maximum", 100, "description", "Maximum search results (default 20)")
                        ),
                        "additionalProperties", false
                )
        ));

        // 3. Task Creation & Single Updates
        tools.add(Map.of(
                "name", "create_task",
                "description", "Create a new placement preparation task for the student.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "title", Map.of("type", "string", "description", "Specific title of the task"),
                                "category", Map.of("type", "string", "enum", List.of("DSA", "Core", "Project", "Aptitude", "Resume", "MockInterview", "Other"), "description", "Subject category"),
                                "difficulty", Map.of("type", "integer", "minimum", 1, "maximum", 5, "description", "Difficulty level from 1 to 5 (default 3)"),
                                "estimatedMinutes", Map.of("type", "integer", "minimum", 5, "maximum", 480, "description", "Estimated duration in minutes (default 30)"),
                                "priority", Map.of("type", "string", "enum", List.of("low", "medium", "high"), "description", "Priority level (default medium)"),
                                "scheduledFor", Map.of("type", "string", "pattern", "^\\d{4}-\\d{2}-\\d{2}$", "description", "Scheduled date in YYYY-MM-DD format (defaults to today)"),
                                "description", Map.of("type", "string", "description", "Optional task instructions or problem links")
                        ),
                        "required", List.of("title"),
                        "additionalProperties", false
                )
        ));

        tools.add(Map.of(
                "name", "update_task_status",
                "description", "Update the completion status ('pending', 'in_progress', 'completed', 'skipped') and optional time spent on an existing preparation task.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "taskId", Map.of("type", "string", "format", "uuid", "description", "Unique UUID of the task to update"),
                                "status", Map.of("type", "string", "enum", List.of("pending", "in_progress", "completed", "skipped"), "description", "New status for the task"),
                                "actualMinutes", Map.of("type", "integer", "minimum", 0, "maximum", 480, "description", "Actual minutes spent on the task")
                        ),
                        "required", List.of("taskId", "status"),
                        "additionalProperties", false
                )
        ));

        tools.add(Map.of(
                "name", "update_task",
                "description", "Comprehensive update of a single task's properties including title, description, category, priority, scheduled date, estimated minutes, actual minutes, difficulty, and status.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "taskId", Map.of("type", "string", "format", "uuid", "description", "Unique UUID of the task to update"),
                                "title", Map.of("type", "string", "description", "Updated title"),
                                "description", Map.of("type", "string", "description", "Updated description or problem notes"),
                                "category", Map.of("type", "string", "enum", List.of("DSA", "Core", "Project", "Aptitude", "Resume", "MockInterview", "Other")),
                                "priority", Map.of("type", "string", "enum", List.of("low", "medium", "high")),
                                "scheduledFor", Map.of("type", "string", "pattern", "^\\d{4}-\\d{2}-\\d{2}$", "description", "Rescheduled date in YYYY-MM-DD format"),
                                "estimatedMinutes", Map.of("type", "integer", "minimum", 5, "maximum", 480),
                                "actualMinutes", Map.of("type", "integer", "minimum", 0, "maximum", 480),
                                "difficulty", Map.of("type", "integer", "minimum", 1, "maximum", 5),
                                "status", Map.of("type", "string", "enum", List.of("pending", "in_progress", "completed", "skipped"))
                        ),
                        "required", List.of("taskId"),
                        "additionalProperties", false
                )
        ));

        // 4. Single & Bulk Deletions
        tools.add(Map.of(
                "name", "delete_task",
                "description", "DESTRUCTIVE OPERATION: Permanently delete a single preparation task owned by the student by its unique task ID.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "taskId", Map.of("type", "string", "format", "uuid", "description", "Unique UUID of the task to delete")
                        ),
                        "required", List.of("taskId"),
                        "additionalProperties", false
                )
        ));

        tools.add(Map.of(
                "name", "bulk_delete_tasks",
                "description", "DESTRUCTIVE OPERATION: Permanently delete multiple preparation tasks in bulk by their task IDs. Treats already missing or deleted IDs idempotently without failing the batch. Enforces strict student ownership verification.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "taskIds", Map.of(
                                        "type", "array",
                                        "items", Map.of("type", "string", "format", "uuid"),
                                        "description", "List of task UUIDs to permanently delete in bulk"
                                )
                        ),
                        "required", List.of("taskIds"),
                        "additionalProperties", false
                )
        ));

        // 5. Bulk Completions & Bulk Updates
        tools.add(Map.of(
                "name", "bulk_complete_tasks",
                "description", "Mark multiple preparation tasks as completed in a single batch operation.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "taskIds", Map.of(
                                        "type", "array",
                                        "items", Map.of("type", "string", "format", "uuid"),
                                        "description", "List of task UUIDs to mark as completed"
                                )
                        ),
                        "required", List.of("taskIds"),
                        "additionalProperties", false
                )
        ));

        tools.add(Map.of(
                "name", "bulk_update_tasks",
                "description", "Reschedule or update multiple tasks at once (e.g. shift scheduled date, adjust priority, change category).",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "taskIds", Map.of(
                                        "type", "array",
                                        "items", Map.of("type", "string", "format", "uuid"),
                                        "description", "List of task UUIDs to update"
                                ),
                                "scheduledFor", Map.of("type", "string", "pattern", "^\\d{4}-\\d{2}-\\d{2}$", "description", "Rescheduled date in YYYY-MM-DD format"),
                                "priority", Map.of("type", "string", "enum", List.of("low", "medium", "high"), "description", "New priority level"),
                                "category", Map.of("type", "string", "enum", List.of("DSA", "Core", "Project", "Aptitude", "Resume", "MockInterview", "Other"), "description", "New category"),
                                "status", Map.of("type", "string", "enum", List.of("pending", "in_progress", "completed", "skipped"), "description", "New task status")
                        ),
                        "required", List.of("taskIds"),
                        "additionalProperties", false
                )
        ));

        // 6. Prep Architect Roadmap & Plans
        tools.add(Map.of(
                "name", "get_prep_plan",
                "description", "Retrieve the student's active Prep Architect preparation roadmap, including target role, weekly milestone themes, focus topics, study hours, and resources.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(),
                        "additionalProperties", false
                )
        ));

        tools.add(Map.of(
                "name", "list_prep_plans",
                "description", "List previous and current preparation plan versions for the authenticated student.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "limit", Map.of("type", "integer", "minimum", 1, "maximum", 20, "description", "Maximum plans to return (default 5)")
                        ),
                        "additionalProperties", false
                )
        ));

        // 7. Daily Reflection & Habit Logs
        tools.add(Map.of(
                "name", "get_daily_log",
                "description", "Retrieve the student's daily preparation reflection log, recorded hours studied, focus minutes, mood, energy, wins, and blockers for today or a specific date.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "date", Map.of("type", "string", "pattern", "^\\d{4}-\\d{2}-\\d{2}$", "description", "Log date in YYYY-MM-DD format (defaults to today)")
                        ),
                        "additionalProperties", false
                )
        ));

        tools.add(Map.of(
                "name", "log_daily_reflection",
                "description", "Record or update a daily reflection log for the student (hours studied, focus minutes, wins, blockers, energy level 1-5, mood 1-5, notes).",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "date", Map.of("type", "string", "pattern", "^\\d{4}-\\d{2}-\\d{2}$", "description", "Log date in YYYY-MM-DD format (defaults to today)"),
                                "hoursStudied", Map.of("type", "number", "minimum", 0, "maximum", 24, "description", "Total hours studied today"),
                                "focusMinutes", Map.of("type", "integer", "minimum", 0, "maximum", 1440, "description", "High-focus deep work minutes"),
                                "wins", Map.of("type", "string", "description", "Key wins or topics mastered today"),
                                "blockers", Map.of("type", "string", "description", "Blockers or obstacles encountered"),
                                "energy", Map.of("type", "integer", "minimum", 1, "maximum", 5, "description", "Energy level from 1 (drained) to 5 (energized)"),
                                "mood", Map.of("type", "integer", "minimum", 1, "maximum", 5, "description", "Mood rating from 1 to 5"),
                                "notes", Map.of("type", "string", "description", "Additional reflection notes")
                        ),
                        "additionalProperties", false
                )
        ));

        // 8. Notification Settings & Testing
        tools.add(Map.of(
                "name", "get_notification_preferences",
                "description", "Retrieve the student's current notification preferences (master toggle, email alerts enabled, browser alerts enabled, permissions).",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(),
                        "additionalProperties", false
                )
        ));

        tools.add(Map.of(
                "name", "update_notification_preferences",
                "description", "Update the student's notification settings (enable/disable email alerts, enable/disable notifications).",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "notificationsEnabled", Map.of("type", "boolean", "description", "Master switch for all notifications"),
                                "notificationEmailEnabled", Map.of("type", "boolean", "description", "Enable daily email prompts and tactical signals"),
                                "notificationBrowserEnabled", Map.of("type", "boolean", "description", "Enable browser push notifications")
                        ),
                        "additionalProperties", false
                )
        ));

        tools.add(Map.of(
                "name", "send_test_notification",
                "description", "Dispatch a live test notification signal across the student's active delivery channels (in-app, browser web push, and email).",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(),
                        "additionalProperties", false
                )
        ));

        return tools;
    }

    @SuppressWarnings("unchecked")
    private ResponseEntity<Map<String, Object>> handleToolCall(Object id, User user, Map<String, Object> body) {
        Map<String, Object> params = (Map<String, Object>) body.get("params");
        if (params == null || !params.containsKey("name")) {
            return ResponseEntity.ok(jsonRpcError(id, -32602, "Missing tool name in params"));
        }

        String toolName = (String) params.get("name");
        Map<String, Object> args = params.containsKey("arguments") && params.get("arguments") instanceof Map
                ? (Map<String, Object>) params.get("arguments")
                : Map.of();

        try {
            switch (toolName) {
                case "get_profile" -> {
                    User profile = authService.getProfile(user.getId());
                    Optional<UserProfile> socialProfile = userProfileRepository.findByUserId(user.getId());

                    Map<String, Object> safeProfile = new LinkedHashMap<>();
                    safeProfile.put("name", profile.getName());
                    safeProfile.put("targetRole", profile.getTargetRole() != null ? profile.getTargetRole() : "Software Development Engineer");
                    safeProfile.put("placementDate", profile.getPlacementDate());
                    safeProfile.put("readinessScore", profile.getReadinessScore());
                    safeProfile.put("consistencyScore", profile.getConsistencyScore());
                    safeProfile.put("currentStreak", profile.getCurrentStreak());
                    safeProfile.put("solvedProblems", profile.getSolvedProblems());
                    safeProfile.put("averageTimePerProblem", profile.getAverageTimePerProblem());
                    safeProfile.put("weakAreas", profile.getWeakAreas());
                    safeProfile.put("strongTopics", profile.getStrongTopics());
                    safeProfile.put("leetcodeUrl", socialProfile.map(UserProfile::getLeetcodeUrl).orElse(null));
                    safeProfile.put("githubUrl", socialProfile.map(UserProfile::getGithubUrl).orElse(null));
                    safeProfile.put("timezone", profile.getTimezone());

                    String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(safeProfile);
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, json));
                }

                case "get_progress_summary" -> {
                    Map<String, Object> summary = progressService.getSummary(user);
                    String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(summary);
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, json));
                }

                case "get_tasks" -> {
                    String date = (String) args.get("date");
                    String status = (String) args.get("status");
                    String category = (String) args.get("category");
                    Integer limit = args.get("limit") != null ? ((Number) args.get("limit")).intValue() : null;

                    List<Task> tasks = taskService.listTasks(user, date, status, category, limit);
                    Map<String, Object> result = Map.of("count", tasks.size(), "tasks", tasks);
                    String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(result);
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, json));
                }

                case "get_task" -> {
                    String taskIdStr = (String) args.get("taskId");
                    if (taskIdStr == null || taskIdStr.isBlank()) {
                        return ResponseEntity.ok(jsonRpcToolError(id, "taskId argument is required"));
                    }
                    UUID taskId = UUID.fromString(taskIdStr);
                    Task task = taskService.getTask(user, taskId);
                    String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(task);
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, json));
                }

                case "search_tasks" -> {
                    String query = (String) args.get("query");
                    String status = (String) args.get("status");
                    String category = (String) args.get("category");
                    Integer limit = args.get("limit") != null ? ((Number) args.get("limit")).intValue() : 20;

                    List<Task> tasks = taskService.searchTasks(user, query, status, category, null, null, limit);
                    Map<String, Object> result = Map.of("count", tasks.size(), "tasks", tasks);
                    String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(result);
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, json));
                }

                case "create_task" -> {
                    String title = (String) args.get("title");
                    if (title == null || title.isBlank()) {
                        return ResponseEntity.ok(jsonRpcToolError(id, "Task title is required."));
                    }
                    String lower = title.trim().toLowerCase();
                    if (List.of("new task", "task", "untitled", "todo", "a task").contains(lower)) {
                        return ResponseEntity.ok(jsonRpcToolError(id, "Please provide a specific task title instead of a generic placeholder."));
                    }

                    Task task = new Task();
                    task.setTitle(title.trim());
                    task.setCategory(args.get("category") != null ? (String) args.get("category") : "DSA");
                    task.setDifficulty(args.get("difficulty") != null ? ((Number) args.get("difficulty")).intValue() : 3);
                    task.setEstimatedMinutes(args.get("estimatedMinutes") != null ? ((Number) args.get("estimatedMinutes")).intValue() : 30);
                    task.setPriority(args.get("priority") != null ? (String) args.get("priority") : "medium");
                    if (args.get("scheduledFor") != null) {
                        task.setScheduledFor(LocalDate.parse((String) args.get("scheduledFor")));
                    } else {
                        task.setScheduledFor(LocalDate.now());
                    }
                    if (args.get("description") != null) {
                        task.setDescription((String) args.get("description"));
                    }

                    Task created = taskService.createTask(user, task);
                    String confirmation = String.format(
                            "✅ Task created successfully!\nID: %s\nTitle: \"%s\"\nCategory: %s\nScheduled: %s\nDuration: %d mins",
                            created.getId(), created.getTitle(), created.getCategory(), created.getScheduledFor(), created.getEstimatedMinutes()
                    );
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, confirmation));
                }

                case "update_task_status" -> {
                    String taskIdStr = (String) args.get("taskId");
                    String status = (String) args.get("status");
                    if (taskIdStr == null || status == null) {
                        return ResponseEntity.ok(jsonRpcToolError(id, "Both taskId and status are required."));
                    }

                    UUID taskId = UUID.fromString(taskIdStr);
                    Map<String, Object> updates = new HashMap<>();
                    updates.put("status", status);
                    if (args.containsKey("actualMinutes")) {
                        updates.put("actualMinutes", args.get("actualMinutes"));
                    }

                    Task updated = taskService.updateTask(user, taskId, updates);
                    String confirmation = String.format("Updated task \"%s\" status to \"%s\".", updated.getTitle(), updated.getStatus());
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, confirmation));
                }

                case "update_task" -> {
                    String taskIdStr = (String) args.get("taskId");
                    if (taskIdStr == null || taskIdStr.isBlank()) {
                        return ResponseEntity.ok(jsonRpcToolError(id, "taskId argument is required."));
                    }

                    UUID taskId = UUID.fromString(taskIdStr);
                    Map<String, Object> updates = new HashMap<>(args);
                    updates.remove("taskId");

                    Task updated = taskService.updateTask(user, taskId, updates);
                    String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(updated);
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, "Task updated successfully:\n" + json));
                }

                case "delete_task" -> {
                    String taskIdStr = args.get("taskId") instanceof String s ? s : (args.get("task_id") instanceof String s2 ? s2 : null);
                    if (taskIdStr == null || taskIdStr.isBlank()) {
                        return ResponseEntity.ok(jsonRpcToolError(id, "taskId argument is required."));
                    }

                    UUID taskId = UUID.fromString(taskIdStr);
                    Task deleted = taskService.deleteTask(user, taskId);
                    String confirmation = String.format("Deleted task \"%s\" (ID: %s).", deleted.getTitle(), deleted.getId());
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, confirmation));
                }

                case "bulk_delete_tasks" -> {
                    List<?> rawList = args.get("taskIds") instanceof List<?> l ? l : (args.get("task_ids") instanceof List<?> l2 ? l2 : null);
                    if (rawList == null || rawList.isEmpty()) {
                        return ResponseEntity.ok(jsonRpcToolError(id, "taskIds array is required for bulk deletion."));
                    }

                    List<UUID> uuids = new ArrayList<>();
                    for (Object item : rawList) {
                        if (item instanceof String str && !str.isBlank()) {
                            try {
                                uuids.add(UUID.fromString(str.trim()));
                            } catch (IllegalArgumentException ignored) {}
                        }
                    }

                    TaskRepository.BulkDeleteResult result = taskService.bulkDeleteTasks(user, uuids);
                    String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(result);
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, json));
                }

                case "bulk_complete_tasks" -> {
                    List<?> rawList = args.get("taskIds") instanceof List<?> l ? l : (args.get("task_ids") instanceof List<?> l2 ? l2 : null);
                    if (rawList == null || rawList.isEmpty()) {
                        return ResponseEntity.ok(jsonRpcToolError(id, "taskIds array is required."));
                    }

                    List<UUID> uuids = new ArrayList<>();
                    for (Object item : rawList) {
                        if (item instanceof String str && !str.isBlank()) {
                            try {
                                uuids.add(UUID.fromString(str.trim()));
                            } catch (IllegalArgumentException ignored) {}
                        }
                    }

                    List<Task> completed = taskService.bulkCompleteTasks(user, uuids);
                    String confirmation = String.format("Completed %d task(s) successfully.", completed.size());
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, confirmation));
                }

                case "bulk_update_tasks" -> {
                    List<?> rawList = args.get("taskIds") instanceof List<?> l ? l : (args.get("task_ids") instanceof List<?> l2 ? l2 : null);
                    if (rawList == null || rawList.isEmpty()) {
                        return ResponseEntity.ok(jsonRpcToolError(id, "taskIds array is required."));
                    }

                    List<UUID> uuids = new ArrayList<>();
                    for (Object item : rawList) {
                        if (item instanceof String str && !str.isBlank()) {
                            try {
                                uuids.add(UUID.fromString(str.trim()));
                            } catch (IllegalArgumentException ignored) {}
                        }
                    }

                    Map<String, Object> updates = new HashMap<>(args);
                    updates.remove("taskIds");

                    List<Task> updated = taskService.bulkUpdateTasks(user, uuids, updates);
                    String confirmation = String.format("Updated %d task(s) successfully.", updated.size());
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, confirmation));
                }

                case "get_prep_plan" -> {
                    Map<String, Object> plan = aiService.getLatestPrepPlan(user);
                    if (plan == null) {
                        return ResponseEntity.ok(jsonRpcToolSuccess(id, "No active preparation plan found for the student."));
                    }
                    String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(plan);
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, json));
                }

                case "list_prep_plans" -> {
                    int limit = args.get("limit") != null ? ((Number) args.get("limit")).intValue() : 5;
                    List<Map<String, Object>> plans = aiService.getPrepPlanHistory(user, limit);
                    String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(plans);
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, json));
                }

                case "get_daily_log" -> {
                    LocalDate date;
                    if (args.get("date") != null) {
                        try {
                            date = LocalDate.parse((String) args.get("date"));
                        } catch (Exception ex) {
                            return ResponseEntity.ok(jsonRpcToolError(id, "Invalid date format: '" + args.get("date") + "'. Expected format YYYY-MM-DD (e.g. 2026-10-08)."));
                        }
                    } else {
                        String tz = user.getTimezone() != null && !user.getTimezone().isBlank() ? user.getTimezone() : "Asia/Calcutta";
                        date = LocalDate.now(ZoneId.of(tz));
                    }

                    Optional<DailyLog> logOpt = logService.findLogByDate(user, date);
                    Map<String, Object> responseMap = new LinkedHashMap<>();
                    responseMap.put("date", date.toString());
                    if (logOpt.isPresent()) {
                        responseMap.put("found", true);
                        responseMap.put("log", logOpt.get());
                    } else {
                        responseMap.put("found", false);
                        responseMap.put("log", null);
                        responseMap.put("message", "No reflection log recorded for " + date + ".");
                    }
                    String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(responseMap);
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, json));
                }

                case "log_daily_reflection" -> {
                    DailyLog log = new DailyLog();
                    log.setUserId(user.getId());
                    if (args.get("date") != null) {
                        log.setLogDate(LocalDate.parse((String) args.get("date")));
                    } else {
                        log.setLogDate(LocalDate.now());
                    }
                    if (args.get("hoursStudied") != null) {
                        log.setHoursStudied(((Number) args.get("hoursStudied")).doubleValue());
                    }
                    if (args.get("focusMinutes") != null) {
                        log.setFocusMinutes(((Number) args.get("focusMinutes")).intValue());
                    }
                    if (args.get("wins") != null) {
                        log.setWins((String) args.get("wins"));
                    }
                    if (args.get("blockers") != null) {
                        log.setBlockers((String) args.get("blockers"));
                    }
                    if (args.get("energy") != null) {
                        log.setEnergy(((Number) args.get("energy")).intValue());
                    }
                    if (args.get("mood") != null) {
                        log.setMood(((Number) args.get("mood")).intValue());
                    }
                    if (args.get("notes") != null) {
                        log.setNotes((String) args.get("notes"));
                    }

                    DailyLog saved = logService.upsertLog(user, log);
                    String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(saved);
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, "Daily reflection saved successfully:\n" + json));
                }

                case "get_notification_preferences" -> {
                    UserProfile profile = userProfileRepository.findByUserId(user.getId())
                            .orElseGet(() -> userProfileRepository.createProfile(user.getId()));

                    Map<String, Object> prefs = new LinkedHashMap<>();
                    prefs.put("notificationsEnabled", profile.isNotificationsEnabled());
                    prefs.put("notificationEmailEnabled", profile.isNotificationEmailEnabled());
                    prefs.put("notificationBrowserEnabled", profile.isNotificationBrowserEnabled());
                    prefs.put("notificationBrowserPermission", profile.getNotificationBrowserPermission());
                    prefs.put("emailConfigured", emailService.isEmailConfigured());
                    prefs.put("emailProvider", emailService.getPrimaryProvider());
                    prefs.put("webPushConfigured", webPushService.isConfigured());

                    String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(prefs);
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, json));
                }

                case "update_notification_preferences" -> {
                    if (!args.containsKey("notificationsEnabled")
                            && !args.containsKey("notificationEmailEnabled")
                            && !args.containsKey("notificationBrowserEnabled")) {
                        return ResponseEntity.ok(jsonRpcToolError(id, "At least one valid preference key ('notificationsEnabled', 'notificationEmailEnabled', 'notificationBrowserEnabled') must be provided."));
                    }

                    for (String key : List.of("notificationsEnabled", "notificationEmailEnabled", "notificationBrowserEnabled")) {
                        if (args.containsKey(key) && !(args.get(key) instanceof Boolean)) {
                            return ResponseEntity.ok(jsonRpcToolError(id, "Invalid value for '" + key + "': expected boolean true/false."));
                        }
                    }

                    UserProfile profile = userProfileRepository.findByUserId(user.getId())
                            .orElseGet(() -> userProfileRepository.createProfile(user.getId()));

                    if (args.containsKey("notificationsEnabled")) {
                        profile.setNotificationsEnabled(Boolean.TRUE.equals(args.get("notificationsEnabled")));
                    }
                    if (args.containsKey("notificationEmailEnabled")) {
                        profile.setNotificationEmailEnabled(Boolean.TRUE.equals(args.get("notificationEmailEnabled")));
                    }
                    if (args.containsKey("notificationBrowserEnabled")) {
                        profile.setNotificationBrowserEnabled(Boolean.TRUE.equals(args.get("notificationBrowserEnabled")));
                    }

                    UserProfile saved = userProfileRepository.upsertProfile(profile);
                    Map<String, Object> updated = Map.of(
                            "notificationsEnabled", saved.isNotificationsEnabled(),
                            "notificationEmailEnabled", saved.isNotificationEmailEnabled(),
                            "notificationBrowserEnabled", saved.isNotificationBrowserEnabled()
                    );
                    String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(updated);
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, "Notification preferences updated:\n" + json));
                }

                case "send_test_notification" -> {
                    Map<String, Object> result = notificationService.testPushNotification(user);
                    String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(result);
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, "Test notification dispatched:\n" + json));
                }

                default -> {
                    return ResponseEntity.ok(jsonRpcError(id, -32601, "Unknown tool: " + toolName));
                }
            }
        } catch (Exception e) {
            return ResponseEntity.ok(jsonRpcToolError(id, "Error executing tool: " + e.getMessage()));
        }
    }

    private Map<String, Object> jsonRpcToolSuccess(Object id, String contentText) {
        Map<String, Object> result = Map.of(
                "content", List.of(Map.of("type", "text", "text", contentText)),
                "isError", false
        );
        return jsonRpcResult(id, result);
    }

    private Map<String, Object> jsonRpcToolError(Object id, String errorMessage) {
        Map<String, Object> result = Map.of(
                "content", List.of(Map.of("type", "text", "text", errorMessage)),
                "isError", true
        );
        return jsonRpcResult(id, result);
    }

    private Map<String, Object> jsonRpcResult(Object id, Object result) {
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("jsonrpc", "2.0");
        resp.put("id", id);
        resp.put("result", result);
        return resp;
    }

    private Map<String, Object> jsonRpcError(Object id, int code, String message) {
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("jsonrpc", "2.0");
        resp.put("id", id);
        resp.put("error", Map.of("code", code, "message", message));
        return resp;
    }
}
