package com.placeprep.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
public class HealthController {

    @Value("${placeprep.ai.provider:openrouter}")
    private String aiProvider;

    @Value("${placeprep.ai.model:openai/gpt-5.1}")
    private String aiModel;

    @Value("${placeprep.app.url:http://localhost:4173}")
    private String appUrl;

    @Value("${placeprep.judge0.base-url:https://ce.judge0.com}")
    private String judge0BaseUrl;

    private Map<String, Object> buildHealthPayload() {
        Map<String, Object> data = new HashMap<>();
        data.put("status", "ok");
        data.put("service", "PlacePrep API");
        data.put("version", "1.0.0");
        data.put("timestamp", Instant.now().toString());
        data.put("aiEnabled", true);
        data.put("aiProvider", aiProvider);
        data.put("aiModel", aiModel);
        data.put("judge0Enabled", true);
        data.put("judge0BaseUrl", judge0BaseUrl);
        data.put("notificationSchedulerEnabled", true);
        data.put("appUrl", appUrl);

        return Map.of("success", true, "data", data);
    }

    @GetMapping({"/", "/healthz", "/api/health"})
    public ResponseEntity<Map<String, Object>> getHealth() {
        return ResponseEntity.ok(buildHealthPayload());
    }
}
