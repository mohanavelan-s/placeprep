package com.placeprep.controller;

import com.placeprep.service.EmailService;
import com.placeprep.service.WebPushService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
public class HealthController {

    private final EmailService emailService;
    private final WebPushService webPushService;

    @Value("${placeprep.ai.provider:openrouter}")
    private String aiProvider;

    @Value("${placeprep.ai.model:openai/gpt-5.1}")
    private String aiModel;

    @Value("${placeprep.app.url:https://placeprep-nine.vercel.app}")
    private String appUrl;

    @Value("${placeprep.judge0.base-url:https://ce.judge0.com}")
    private String judge0BaseUrl;

    @Value("${placeprep.notification.scheduler-enabled:true}")
    private boolean notificationSchedulerEnabled;

    @Value("${placeprep.notification.cron:0 0 8 * * *}")
    private String notificationCron;

    public HealthController(EmailService emailService, WebPushService webPushService) {
        this.emailService = emailService;
        this.webPushService = webPushService;
    }

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
        data.put("notificationSchedulerEnabled", notificationSchedulerEnabled);
        data.put("notificationCron", notificationCron);
        data.put("appUrl", appUrl);

        // Email status
        data.put("emailEnabled", emailService.isEmailConfigured());
        data.put("emailProvider", emailService.getPrimaryProvider());
        data.put("emailProviders", emailService.getConfiguredProviders());
        data.put("smtpEnabled", emailService.isSmtpConfigured());
        data.put("resendEnabled", emailService.isResendConfigured());

        // Web push status
        data.put("webPushEnabled", webPushService.isConfigured());

        return Map.of("success", true, "data", data);
    }

    @GetMapping({"/", "/healthz", "/api/health"})
    public ResponseEntity<Map<String, Object>> getHealth() {
        return ResponseEntity.ok(buildHealthPayload());
    }
}
