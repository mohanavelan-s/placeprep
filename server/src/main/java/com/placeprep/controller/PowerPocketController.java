package com.placeprep.controller;

import com.placeprep.model.PowerPocketSession;
import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.PowerPocketService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/power-pocket")
public class PowerPocketController {

    private final PowerPocketService powerPocketService;

    public PowerPocketController(PowerPocketService powerPocketService) {
        this.powerPocketService = powerPocketService;
    }

    @GetMapping("/active")
    public ResponseEntity<Map<String, Object>> getActiveSession(@CurrentUser User user) {
        PowerPocketSession session = powerPocketService.getActiveSession(user).orElse(null);
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", session);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/start")
    public ResponseEntity<Map<String, Object>> startSession(
            @CurrentUser User user,
            @RequestBody PowerPocketSession payload
    ) {
        PowerPocketSession session = powerPocketService.startSession(user, payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("success", true, "data", session));
    }

    @PostMapping("/{sessionId}/end")
    public ResponseEntity<Map<String, Object>> endSession(
            @CurrentUser User user,
            @PathVariable UUID sessionId,
            @RequestBody PowerPocketSession payload
    ) {
        PowerPocketSession session = powerPocketService.endSession(user, sessionId, payload);
        return ResponseEntity.ok(Map.of("success", true, "data", session));
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> listSessions(
            @CurrentUser User user,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer limit
    ) {
        List<PowerPocketSession> sessions = powerPocketService.listSessions(user, date, status, limit);
        return ResponseEntity.ok(Map.of("success", true, "data", sessions));
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Map<String, Object>> deleteSession(
            @CurrentUser User user,
            @PathVariable UUID sessionId
    ) {
        Map<String, Object> result = powerPocketService.deleteSession(user, sessionId);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/history")
    public ResponseEntity<Map<String, Object>> clearHistory(@CurrentUser User user) {
        Map<String, Object> result = powerPocketService.clearHistory(user);
        return ResponseEntity.ok(result);
    }
}
