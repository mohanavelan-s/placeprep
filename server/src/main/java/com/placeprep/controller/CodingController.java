package com.placeprep.controller;

import com.placeprep.model.CodingSubmission;
import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.CodingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/coding")
public class CodingController {

    private final CodingService codingService;

    public CodingController(CodingService codingService) {
        this.codingService = codingService;
    }

    @GetMapping("/languages")
    public ResponseEntity<Map<String, Object>> listLanguages() {
        return ResponseEntity.ok(Map.of("success", true, "data", codingService.listLanguages()));
    }

    @PostMapping({"/problem/resolve", "/resolve"})
    public ResponseEntity<Map<String, Object>> resolveProblem(
            @RequestBody(required = false) Map<String, Object> req
    ) {
        Map<String, Object> payload = req != null ? req : Map.of();
        Map<String, Object> problem = codingService.resolveProblem(payload);
        return ResponseEntity.ok(Map.of("success", true, "data", problem));
    }

    @GetMapping("/task/{taskId}")
    public ResponseEntity<Map<String, Object>> getTask(
            @CurrentUser User user,
            @PathVariable UUID taskId
    ) {
        Map<String, Object> workspace = codingService.getCodingTask(user, taskId);
        return ResponseEntity.ok(Map.of("success", true, "data", workspace));
    }

    @PostMapping("/runs")
    public ResponseEntity<Map<String, Object>> createRun(
            @CurrentUser User user,
            @RequestBody Map<String, Object> req
    ) {
        Map<String, Object> run = codingService.createRun(user, req);
        return ResponseEntity.ok(Map.of("success", true, "data", run));
    }

    @PostMapping("/submissions")
    public ResponseEntity<Map<String, Object>> submitCode(
            @CurrentUser User user,
            @RequestBody Map<String, Object> req
    ) {
        CodingSubmission sub = codingService.submitCode(user, req);
        return ResponseEntity.ok(Map.of("success", true, "data", sub));
    }

    @GetMapping("/submissions")
    public ResponseEntity<Map<String, Object>> listSubmissions(
            @CurrentUser User user,
            @RequestParam(defaultValue = "20") int limit
    ) {
        List<CodingSubmission> list = codingService.listSubmissions(user, limit);
        return ResponseEntity.ok(Map.of("success", true, "data", list));
    }

    @DeleteMapping("/submissions/{id}")
    public ResponseEntity<Map<String, Object>> deleteSubmission(
            @CurrentUser User user,
            @PathVariable UUID id
    ) {
        Map<String, Object> result = codingService.deleteSubmission(user, id);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/submissions")
    public ResponseEntity<Map<String, Object>> clearSubmissions(
            @CurrentUser User user,
            @RequestBody(required = false) Map<String, List<UUID>> payload
    ) {
        List<UUID> ids = payload != null ? payload.get("submissionIds") : null;
        Map<String, Object> result = codingService.clearSubmissions(user, ids);
        return ResponseEntity.ok(result);
    }
}
