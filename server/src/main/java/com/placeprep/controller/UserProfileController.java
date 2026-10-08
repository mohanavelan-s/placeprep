package com.placeprep.controller;

import com.placeprep.model.PushSubscription;
import com.placeprep.model.User;
import com.placeprep.model.UserProfile;
import com.placeprep.repository.UserProfileRepository;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.WebPushService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/profile")
public class UserProfileController {

    private final UserProfileRepository profileRepository;
    private final WebPushService webPushService;

    public UserProfileController(
            UserProfileRepository profileRepository,
            WebPushService webPushService
    ) {
        this.profileRepository = profileRepository;
        this.webPushService = webPushService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getProfile(@CurrentUser User user) {
        UserProfile profile = profileRepository.findByUserId(user.getId())
                .orElseGet(() -> profileRepository.createProfile(user.getId()));
        return ResponseEntity.ok(Map.of("success", true, "data", profile));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> upsertProfile(
            @CurrentUser User user,
            @RequestBody UserProfile payload
    ) {
        payload.setUserId(user.getId());
        UserProfile saved = profileRepository.upsertProfile(payload);
        return ResponseEntity.ok(Map.of("success", true, "data", saved));
    }

    @GetMapping("/web-push/config")
    public ResponseEntity<Map<String, Object>> getWebPushConfig() {
        return ResponseEntity.ok(Map.of("success", true, "data", webPushService.getWebPushConfig()));
    }

    @PostMapping({"/push-subscriptions", "/web-push/subscription"})
    public ResponseEntity<Map<String, Object>> savePushSubscription(
            @CurrentUser User user,
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request
    ) {
        String userAgent = request.getHeader("User-Agent");
        PushSubscription saved = webPushService.saveSubscription(user, payload, userAgent);
        return ResponseEntity.ok(Map.of("success", true, "data", saved != null ? saved : Map.of()));
    }

    @DeleteMapping({"/push-subscriptions", "/web-push/subscription"})
    public ResponseEntity<Map<String, Object>> deletePushSubscription(
            @CurrentUser User user,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        String endpoint = body != null ? (String) body.get("endpoint") : null;
        boolean deleted = webPushService.deleteSubscription(user, endpoint);
        return ResponseEntity.ok(Map.of("success", true, "deleted", deleted));
    }
}
