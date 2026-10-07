package com.placeprep.controller;

import com.placeprep.exception.AppException;
import com.placeprep.model.Invite;
import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.InviteService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/invites")
public class InviteController {

    private final InviteService inviteService;

    public InviteController(InviteService inviteService) {
        this.inviteService = inviteService;
    }

    @GetMapping("/preview")
    public ResponseEntity<Map<String, Object>> previewInvite(@RequestParam(required = false) String code) {
        Map<String, Object> preview = inviteService.previewInviteCode(code);
        return ResponseEntity.ok(Map.of("success", true, "data", preview));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> listInvites(
            @CurrentUser User user,
            @RequestParam(defaultValue = "25") int limit
    ) {
        List<Invite> invites = inviteService.listInvites(limit);
        return ResponseEntity.ok(Map.of("success", true, "data", invites));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> createInvite(
            @CurrentUser User user,
            @RequestBody Map<String, Object> body
    ) {
        String role = (String) body.getOrDefault("role", "user");
        Integer expiresInDays = body.get("expiresInDays") != null ? ((Number) body.get("expiresInDays")).intValue() : 7;
        String code = (String) body.get("code");
        String label = (String) body.get("label");

        Invite invite = inviteService.generateInvite(user, role, expiresInDays, code, label);
        return new ResponseEntity<>(Map.of("success", true, "data", invite), HttpStatus.CREATED);
    }

    @DeleteMapping("/history")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> clearHistory(@CurrentUser User user) {
        Map<String, Object> result = inviteService.clearInviteHistory();
        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }
}
