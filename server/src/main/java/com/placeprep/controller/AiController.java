package com.placeprep.controller;

import com.placeprep.model.Task;
import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.AiService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        return ResponseEntity.ok(Map.of("success", true, "data", aiService.getStatus()));
    }

    @PostMapping("/chat")
    public ResponseEntity<Map<String, Object>> sendMentorMessage(
            @CurrentUser User user,
            @RequestBody Map<String, String> body
    ) {
        String msg = body.getOrDefault("message", "Hello");
        Map<String, Object> reply = aiService.chatWithMentor(user, msg);
        return ResponseEntity.ok(Map.of("success", true, "data", reply));
    }

    @GetMapping("/chat")
    public ResponseEntity<Map<String, Object>> getMentorHistory(@CurrentUser User user) {
        return ResponseEntity.ok(Map.of("success", true, "data", aiService.getMentorHistory(user)));
    }

    @DeleteMapping("/chat/history")
    public ResponseEntity<Map<String, Object>> clearMentorHistory(@CurrentUser User user) {
        return ResponseEntity.ok(Map.of("success", true, "data", aiService.clearMentorHistory(user)));
    }

    @PostMapping({"/generate-tasks", "/tasks/generate"})
    public ResponseEntity<Map<String, Object>> generateTasks(
            @CurrentUser User user,
            @RequestBody(required = false) Map<String, Object> req
    ) {
        List<Task> tasks = aiService.generateTasks(user, req != null ? req : Map.of());
        return ResponseEntity.ok(Map.of("success", true, "data", tasks));
    }

    @GetMapping("/prep-architect/latest")
    public ResponseEntity<Map<String, Object>> getLatestPrepPlan(@CurrentUser User user) {
        return ResponseEntity.ok(Map.of("success", true, "data", aiService.getLatestPrepPlan(user)));
    }

    @PostMapping("/prep-architect")
    public ResponseEntity<Map<String, Object>> generatePrepPlan(
            @CurrentUser User user,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        return ResponseEntity.ok(Map.of("success", true, "data", aiService.generatePrepPlan(user, body != null ? body : Map.of())));
    }

    @PostMapping("/prep-architect/update")
    public ResponseEntity<Map<String, Object>> updatePrepPlan(
            @CurrentUser User user,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        return ResponseEntity.ok(Map.of("success", true, "data", aiService.updatePrepPlan(user, body != null ? body : Map.of())));
    }

    @GetMapping("/prep-architect/history")
    public ResponseEntity<Map<String, Object>> getPrepPlanHistory(
            @CurrentUser User user,
            @RequestParam(name = "limit", defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(Map.of("success", true, "data", aiService.getPrepPlanHistory(user, limit)));
    }

    @PostMapping("/prep-architect/activate")
    public ResponseEntity<Map<String, Object>> activatePrepPlan(
            @CurrentUser User user,
            @RequestBody Map<String, Object> body
    ) {
        String planId = (String) body.get("planId");
        return ResponseEntity.ok(Map.of("success", true, "data", aiService.activatePrepPlan(user, planId)));
    }

    @PostMapping("/prep-architect/rename")
    public ResponseEntity<Map<String, Object>> renamePrepPlan(
            @CurrentUser User user,
            @RequestBody Map<String, Object> body
    ) {
        return ResponseEntity.ok(Map.of("success", true, "data", aiService.renamePrepPlan(user, body)));
    }

    @DeleteMapping("/prep-architect/history")
    public ResponseEntity<Map<String, Object>> clearPrepPlanHistory(
            @CurrentUser User user,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        List<String> planIds = body != null && body.get("planIds") instanceof List ? (List<String>) body.get("planIds") : null;
        return ResponseEntity.ok(Map.of("success", true, "data", aiService.clearPrepPlanHistory(user, planIds)));
    }

    @PostMapping("/help")
    public ResponseEntity<Map<String, Object>> getHelp(
            @CurrentUser User user,
            @RequestBody Map<String, Object> body
    ) {
        return ResponseEntity.ok(Map.of("success", true, "data", aiService.getStuckHelp(user, body)));
    }

    @PostMapping({"/evaluate", "/daily-evaluation"})
    public ResponseEntity<Map<String, Object>> evaluateDaily(
            @CurrentUser User user,
            @RequestBody Map<String, Object> body
    ) {
        return ResponseEntity.ok(Map.of("success", true, "data", aiService.evaluateDailyPerformance(user, body)));
    }
}
