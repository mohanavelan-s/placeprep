package com.placeprep.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.placeprep.model.Task;
import com.placeprep.model.User;
import com.placeprep.model.UserProfile;
import com.placeprep.repository.UserProfileRepository;
import com.placeprep.repository.UserRepository;
import com.placeprep.service.AuthService;
import com.placeprep.service.OAuthService;
import com.placeprep.service.ProgressService;
import com.placeprep.service.TaskService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
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
    private final ObjectMapper objectMapper;

    public McpController(
            OAuthService oAuthService,
            UserRepository userRepository,
            UserProfileRepository userProfileRepository,
            TaskService taskService,
            ProgressService progressService,
            AuthService authService,
            ObjectMapper objectMapper
    ) {
        this.oAuthService = oAuthService;
        this.userRepository = userRepository;
        this.userProfileRepository = userProfileRepository;
        this.taskService = taskService;
        this.progressService = progressService;
        this.authService = authService;
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
                // Non-JSON or probe body
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

        tools.add(Map.of(
                "name", "get_profile",
                "description", "Retrieve the authenticated student's placement preparation profile, target role, deadline, current streak, readiness score, consistency score, and topic strengths.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(),
                        "additionalProperties", false
                )
        ));

        tools.add(Map.of(
                "name", "get_progress_summary",
                "description", "Retrieve the authenticated student's placement readiness analytics, topic strengths, and AI coach directive.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(),
                        "additionalProperties", false
                )
        ));

        tools.add(Map.of(
                "name", "get_tasks",
                "description", "List placement preparation tasks for the authenticated student with optional filters.",
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
                "description", "Retrieve details of a specific placement preparation task owned by the student by its unique task ID.",
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
                "name", "create_task",
                "description", "Persist a new placement preparation task for the authenticated student.",
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
                "name", "delete_task",
                "description", "Permanently delete a preparation task owned by the authenticated student.",
                "inputSchema", Map.of(
                        "type", "object",
                        "properties", Map.of(
                                "taskId", Map.of("type", "string", "format", "uuid", "description", "Unique UUID of the task to delete")
                        ),
                        "required", List.of("taskId"),
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

                case "delete_task" -> {
                    String taskIdStr = (String) args.get("taskId");
                    if (taskIdStr == null || taskIdStr.isBlank()) {
                        return ResponseEntity.ok(jsonRpcToolError(id, "taskId argument is required."));
                    }

                    UUID taskId = UUID.fromString(taskIdStr);
                    Task deleted = taskService.deleteTask(user, taskId);
                    String confirmation = String.format("Deleted task \"%s\" (ID: %s).", deleted.getTitle(), deleted.getId());
                    return ResponseEntity.ok(jsonRpcToolSuccess(id, confirmation));
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
