package com.placeprep.controller;

import com.placeprep.model.AssessmentSession;
import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.AssessmentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/assessments")
public class AssessmentController {

    private final AssessmentService assessmentService;

    public AssessmentController(AssessmentService assessmentService) {
        this.assessmentService = assessmentService;
    }

    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> getOverview(@CurrentUser User user) {
        Map<String, Object> overview = assessmentService.getOverview(user);
        return ResponseEntity.ok(Map.of("success", true, "data", overview));
    }

    @PostMapping("/generate")
    public ResponseEntity<Map<String, Object>> generateAssessment(
            @CurrentUser User user,
            @RequestBody(required = false) Map<String, Object> payload
    ) {
        Map<String, Object> result = assessmentService.generateAssessment(user, payload != null ? payload : Map.of());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("success", true, "data", result));
    }

    @PostMapping("/{assessmentId}/submit")
    public ResponseEntity<Map<String, Object>> submitAssessment(
            @CurrentUser User user,
            @PathVariable UUID assessmentId,
            @RequestBody(required = false) Map<String, Object> payload
    ) {
        AssessmentSession session = assessmentService.submitAssessment(user, assessmentId, payload != null ? payload : Map.of());
        return ResponseEntity.ok(Map.of("success", true, "data", session));
    }

    @PostMapping("/{assessmentId}/apply-plan-update")
    public ResponseEntity<Map<String, Object>> applyPlanUpdate(
            @CurrentUser User user,
            @PathVariable UUID assessmentId
    ) {
        Map<String, Object> result = assessmentService.applyPlanUpdate(user, assessmentId);
        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @DeleteMapping("/{assessmentId}")
    public ResponseEntity<Map<String, Object>> deleteAssessment(
            @CurrentUser User user,
            @PathVariable UUID assessmentId
    ) {
        Map<String, Object> result = assessmentService.deleteAssessment(user, assessmentId);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/history")
    public ResponseEntity<Map<String, Object>> clearHistory(
            @CurrentUser User user,
            @RequestBody(required = false) Map<String, Object> payload
    ) {
        List<UUID> ids = null;
        if (payload != null && payload.get("sessionIds") instanceof List<?> rawList) {
            ids = rawList.stream().map(Object::toString).map(UUID::fromString).toList();
        }
        Map<String, Object> result = assessmentService.clearHistory(user, ids);
        return ResponseEntity.ok(result);
    }
}
