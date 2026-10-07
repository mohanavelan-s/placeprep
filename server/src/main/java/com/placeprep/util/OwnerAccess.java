package com.placeprep.util;

import com.placeprep.model.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class OwnerAccess {

    private final List<String> ownerEmails;

    public OwnerAccess(@Value("${placeprep.owner-emails:mohanavelan2006@gmail.com}") String emails) {
        if (emails != null && !emails.isBlank()) {
            this.ownerEmails = Arrays.stream(emails.split(","))
                    .map(String::trim)
                    .map(String::toLowerCase)
                    .toList();
        } else {
            this.ownerEmails = List.of("mohanavelan2006@gmail.com");
        }
    }

    public boolean isOwnerEmail(String email) {
        if (email == null) return false;
        return ownerEmails.contains(email.trim().toLowerCase());
    }

    public User applyOwnerAccess(User user) {
        if (user == null || !isOwnerEmail(user.getEmail())) {
            return user;
        }

        user.setRole("admin");
        user.setTier("college");
        user.setAccessTier("standard");

        Map<String, Object> meta = new HashMap<>(user.getCoachMetadata());
        meta.put("accessTier", "standard");
        meta.put("owner", true);
        meta.put("unlimitedAccess", true);
        meta.put("billingTier", "college");
        meta.put("billingStatus", "owner_unlimited");
        user.setCoachMetadata(meta);

        return user;
    }
}
