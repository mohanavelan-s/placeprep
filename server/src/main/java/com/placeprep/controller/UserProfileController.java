package com.placeprep.controller;

import com.placeprep.model.User;
import com.placeprep.model.UserProfile;
import com.placeprep.repository.UserProfileRepository;
import com.placeprep.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/profile")
public class UserProfileController {

    private final UserProfileRepository profileRepository;

    public UserProfileController(UserProfileRepository profileRepository) {
        this.profileRepository = profileRepository;
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
        return ResponseEntity.ok(Map.of("success", true, "data", Map.of("enabled", false, "publicKey", "")));
    }
}
