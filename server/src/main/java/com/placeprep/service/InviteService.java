package com.placeprep.service;

import com.placeprep.exception.AppException;
import com.placeprep.model.Invite;
import com.placeprep.model.User;
import com.placeprep.repository.InviteRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class InviteService {

    private final InviteRepository inviteRepository;
    private final String appUrl;
    private final String bootstrapAdminCode;
    private final String bootstrapUserCode;
    private final SecureRandom random = new SecureRandom();

    public InviteService(
            InviteRepository inviteRepository,
            @Value("${placeprep.app.url:http://localhost:4173}") String appUrl,
            @Value("${placeprep.app.bootstrap-admin-invite:itsmv}") String bootstrapAdminCode,
            @Value("${placeprep.app.bootstrap-user-invite:itsnotmv}") String bootstrapUserCode
    ) {
        this.inviteRepository = inviteRepository;
        this.appUrl = appUrl.replaceAll("/$", "");
        this.bootstrapAdminCode = normalizeCode(bootstrapAdminCode);
        this.bootstrapUserCode = normalizeCode(bootstrapUserCode);
    }

    public static String normalizeCode(String code) {
        if (code == null) return "";
        return code.trim().toUpperCase().replaceAll("[^A-Z0-9-]+", "-").replaceAll("^-+|-+$", "");
    }

    public String generateInviteCode() {
        byte[] bytes = new byte[6];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes).toUpperCase();
    }

    public String buildInviteLink(String code) {
        return appUrl + "/invite?code=" + code;
    }

    public Map<String, Object> previewInviteCode(String rawCode) {
        String code = normalizeCode(rawCode);
        Map<String, Object> res = new HashMap<>();
        res.put("code", code);

        if (code.isBlank()) {
            res.put("valid", false);
            res.put("status", "missing");
            res.put("message", "Invite code is required.");
            return res;
        }

        if (code.equals(bootstrapUserCode)) {
            res.put("valid", true);
            res.put("status", "valid");
            res.put("role", "observer");
            res.put("accessTier", "observer");
            res.put("persistent", true);
            res.put("inviteLink", buildInviteLink(code));
            res.put("message", "Observer access accepted.");
            return res;
        }

        if (code.equals(bootstrapAdminCode)) {
            res.put("valid", true);
            res.put("status", "valid");
            res.put("role", "admin");
            res.put("accessTier", "standard");
            res.put("persistent", true);
            res.put("inviteLink", buildInviteLink(code));
            res.put("message", "Admin bootstrap access accepted.");
            return res;
        }

        Optional<Invite> inviteOpt = inviteRepository.findByCode(code);
        if (inviteOpt.isEmpty()) {
            res.put("valid", false);
            res.put("status", "missing");
            res.put("message", "Invite code not found.");
            return res;
        }

        Invite invite = inviteOpt.get();
        if (invite.isUsed()) {
            res.put("valid", false);
            res.put("status", "used");
            res.put("message", "This invite has already been used.");
            return res;
        }

        if (invite.getExpiresAt() != null && invite.getExpiresAt().isBefore(OffsetDateTime.now())) {
            res.put("valid", false);
            res.put("status", "expired");
            res.put("message", "This invite has expired.");
            return res;
        }

        res.put("valid", true);
        res.put("status", "valid");
        res.put("role", invite.getRole());
        res.put("expiresAt", invite.getExpiresAt());
        res.put("inviteLink", buildInviteLink(code));
        res.put("message", "Invite code accepted.");
        return res;
    }

    public Invite assertInviteAvailable(String rawCode) {
        String code = normalizeCode(rawCode);
        if (code.isBlank()) {
            throw new AppException("Invite code is required.", HttpStatus.BAD_REQUEST);
        }

        if (code.equals(bootstrapUserCode)) {
            Invite inv = new Invite();
            inv.setCode(code);
            inv.setRole("user");
            inv.getMetadata().put("accessTier", "observer");
            return inv;
        }

        if (code.equals(bootstrapAdminCode)) {
            Invite inv = new Invite();
            inv.setCode(code);
            inv.setRole("admin");
            inv.getMetadata().put("accessTier", "standard");
            return inv;
        }

        Optional<Invite> inviteOpt = inviteRepository.findByCode(code);
        if (inviteOpt.isEmpty()) {
            throw new AppException("Invite code not found.", HttpStatus.FORBIDDEN);
        }

        Invite invite = inviteOpt.get();
        if (invite.isUsed()) {
            throw new AppException("This invite has already been used.", HttpStatus.FORBIDDEN);
        }

        if (invite.getExpiresAt() != null && invite.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new AppException("This invite has expired.", HttpStatus.FORBIDDEN);
        }

        return invite;
    }

    public Invite generateInvite(User adminUser, String role, Integer expiresInDays, String customCode, String label) {
        String code = customCode != null && !customCode.isBlank() ? normalizeCode(customCode) : generateInviteCode();
        int days = expiresInDays != null ? Math.clamp(expiresInDays, 1, 90) : 7;
        OffsetDateTime expiresAt = OffsetDateTime.now().plusDays(days);

        Invite invite = new Invite();
        invite.setCode(code);
        invite.setRole("admin".equalsIgnoreCase(role) ? "admin" : "user");
        invite.setCreatedBy(adminUser != null ? adminUser.getId() : null);
        invite.setExpiresAt(expiresAt);
        if (label != null) {
            invite.getMetadata().put("label", label);
        }

        return inviteRepository.createInvite(invite);
    }

    public List<Invite> listInvites(int limit) {
        return inviteRepository.listInvites(limit);
    }

    public void markInviteUsed(UUID inviteId, UUID userId) {
        if (inviteId != null) {
            inviteRepository.markInviteUsed(inviteId, userId);
        }
    }

    public Map<String, Object> clearInviteHistory() {
        int count = inviteRepository.deleteInactiveInvites();
        return Map.of("deleted", count, "clearedAt", OffsetDateTime.now().toString());
    }
}
