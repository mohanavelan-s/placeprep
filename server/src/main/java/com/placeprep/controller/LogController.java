package com.placeprep.controller;

import com.placeprep.model.DailyLog;
import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.LogService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/logs")
public class LogController {

    private final LogService logService;

    public LogController(LogService logService) {
        this.logService = logService;
    }

    @GetMapping("/today")
    public ResponseEntity<Map<String, Object>> getTodayLog(@CurrentUser User user) {
        DailyLog log = logService.getLogByDate(user, null);
        return ResponseEntity.ok(Map.of("success", true, "data", log));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> upsertLog(
            @CurrentUser User user,
            @RequestBody DailyLog payload
    ) {
        DailyLog saved = logService.upsertLog(user, payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("success", true, "data", saved));
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> listLogs(
            @CurrentUser User user,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Integer limit
    ) {
        List<DailyLog> logs = logService.listLogs(user, date, from, to, limit);
        return ResponseEntity.ok(Map.of("success", true, "data", logs));
    }

    @DeleteMapping("/{logId}")
    public ResponseEntity<Map<String, Object>> deleteLog(
            @CurrentUser User user,
            @PathVariable UUID logId
    ) {
        DailyLog deleted = logService.deleteLog(user, logId);
        return ResponseEntity.ok(Map.of("success", true, "data", deleted));
    }
}
