package com.placeprep.controller;

import com.placeprep.model.ProgressStat;
import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.ProgressService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/progress")
public class ProgressController {

    private final ProgressService progressService;

    public ProgressController(ProgressService progressService) {
        this.progressService = progressService;
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(@CurrentUser User user) {
        Map<String, Object> summary = progressService.getSummary(user);
        return ResponseEntity.ok(Map.of("success", true, "data", summary));
    }

    @GetMapping("/history")
    public ResponseEntity<Map<String, Object>> getHistory(
            @CurrentUser User user,
            @RequestParam(defaultValue = "14") int days
    ) {
        List<ProgressStat> history = progressService.getHistory(user, days);
        return ResponseEntity.ok(Map.of("success", true, "data", history));
    }

    @PostMapping("/clear-history")
    public ResponseEntity<Map<String, Object>> clearHistoryPost(@CurrentUser User user) {
        Map<String, Object> res = progressService.clearHistory(user);
        return ResponseEntity.ok(res);
    }

    @DeleteMapping("/history")
    public ResponseEntity<Map<String, Object>> clearHistoryDelete(@CurrentUser User user) {
        Map<String, Object> res = progressService.clearHistory(user);
        return ResponseEntity.ok(res);
    }
}
