package com.placeprep.controller;

import com.placeprep.dto.AuthResponse;
import com.placeprep.dto.LoginRequest;
import com.placeprep.dto.RegisterRequest;
import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@Valid @RequestBody RegisterRequest req) {
        AuthResponse response = authService.register(req);
        return new ResponseEntity<>(Map.of("success", true, "data", response), HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@Valid @RequestBody LoginRequest req) {
        AuthResponse response = authService.login(req);
        return ResponseEntity.ok(Map.of("success", true, "data", response));
    }

    @PostMapping("/google")
    public ResponseEntity<Map<String, Object>> googleLogin(@RequestBody Map<String, String> body) {
        String credential = body != null ? body.get("credential") : null;
        AuthResponse response = authService.loginWithGoogle(credential);
        return ResponseEntity.ok(Map.of("success", true, "data", response));
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(@CurrentUser User user) {
        User fresh = authService.getProfile(user.getId());
        return ResponseEntity.ok(Map.of("success", true, "data", fresh));
    }

    @PatchMapping("/me")
    public ResponseEntity<Map<String, Object>> updateMe(
            @CurrentUser User user,
            @RequestBody Map<String, Object> updates
    ) {
        User updated = authService.updateProfile(user.getId(), updates);
        return ResponseEntity.ok(Map.of("success", true, "data", updated));
    }
}
