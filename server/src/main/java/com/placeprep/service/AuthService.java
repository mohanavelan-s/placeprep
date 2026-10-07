package com.placeprep.service;

import com.placeprep.dto.AuthResponse;
import com.placeprep.dto.LoginRequest;
import com.placeprep.dto.RegisterRequest;
import com.placeprep.exception.AppException;
import com.placeprep.model.Invite;
import com.placeprep.model.User;
import com.placeprep.repository.UserProfileRepository;
import com.placeprep.repository.UserRepository;
import com.placeprep.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final UserProfileRepository userProfileRepository;
    private final InviteService inviteService;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final boolean allowPublicSignup;
    private final String defaultTimezone;

    public AuthService(
            UserRepository userRepository,
            UserProfileRepository userProfileRepository,
            InviteService inviteService,
            PasswordEncoder passwordEncoder,
            JwtTokenProvider tokenProvider,
            @Value("${placeprep.app.allow-public-signup:false}") String allowPublicSignupRaw,
            @Value("${placeprep.app.default-timezone:Asia/Calcutta}") String defaultTimezone
    ) {
        this.userRepository = userRepository;
        this.userProfileRepository = userProfileRepository;
        this.inviteService = inviteService;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        String cleaned = allowPublicSignupRaw != null ? allowPublicSignupRaw.replace("\"", "").replace("'", "").trim() : "false";
        this.allowPublicSignup = "true".equalsIgnoreCase(cleaned) || "1".equals(cleaned);
        this.defaultTimezone = defaultTimezone;
    }

    public static String normalizeUsername(String input) {
        if (input == null || input.isBlank()) return null;
        String normalized = input.trim().toLowerCase()
                .replaceAll("[^a-z0-9._-]+", "-")
                .replaceAll("^-+|-+$", "");
        if (normalized.length() > 60) normalized = normalized.substring(0, 60);
        return normalized.isBlank() ? null : normalized;
    }

    public String buildAvailableUsername(String name, String fallbackSeed) {
        String base = normalizeUsername(name);
        if (base == null) base = normalizeUsername(fallbackSeed);
        if (base == null) base = "student";

        if (userRepository.findByUsername(base).isEmpty()) {
            return base;
        }

        for (int i = 2; i <= 200; i++) {
            String candidate = (base + "-" + i);
            if (candidate.length() > 60) candidate = candidate.substring(0, 60);
            if (userRepository.findByUsername(candidate).isEmpty()) {
                return candidate;
            }
        }
        return base + "-" + System.currentTimeMillis() % 10000;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        String email = req.getEmail().trim().toLowerCase();
        if (userRepository.findByEmail(email).isPresent()) {
            throw new AppException("An account with this email already exists.", HttpStatus.CONFLICT);
        }

        Invite invite = null;
        if (req.getInviteCode() != null && !req.getInviteCode().isBlank()) {
            invite = inviteService.assertInviteAvailable(req.getInviteCode());
        } else if (!allowPublicSignup) {
            throw new AppException("An invite code is required to register.", HttpStatus.FORBIDDEN);
        }

        String username = req.getUsername() != null && !req.getUsername().isBlank()
                ? normalizeUsername(req.getUsername())
                : buildAvailableUsername(req.getName(), email.split("@")[0]);

        if (username != null && userRepository.findByUsername(username).isPresent()) {
            throw new AppException("That username is already taken.", HttpStatus.CONFLICT);
        }

        String role = (invite != null && "admin".equalsIgnoreCase(invite.getRole())) ? "admin" : "user";
        String tier = invite != null ? "college" : "free";
        String accessTier = (invite != null && "observer".equals(invite.getMetadata().get("accessTier"))) ? "observer" : "standard";

        User user = new User();
        user.setName(req.getName().trim());
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        user.setRole(role);
        user.setTier(tier);
        user.setAccessTier(accessTier);
        user.setTimezone(req.getTimezone() != null ? req.getTimezone() : defaultTimezone);
        user.setTargetRole(req.getTargetRole());
        user.setPlacementDate(req.getPlacementDate());
        if (req.getWeakAreas() != null) user.setWeakAreas(req.getWeakAreas());

        if ("observer".equals(accessTier)) {
            user.getCoachMetadata().put("accessTier", "observer");
        }

        User created = userRepository.createUser(user);
        userProfileRepository.createProfile(created.getId());

        if (invite != null && invite.getId() != null) {
            inviteService.markInviteUsed(invite.getId(), created.getId());
        }

        String token = tokenProvider.generateToken(created);
        return new AuthResponse(token, created);
    }

    public AuthResponse login(LoginRequest req) {
        String identifier = req.getIdentifier() != null && !req.getIdentifier().isBlank()
                ? req.getIdentifier()
                : req.getEmail();

        if (identifier == null || identifier.isBlank()) {
            throw new AppException("Username or email is required.", HttpStatus.BAD_REQUEST);
        }

        Optional<User> userOpt = userRepository.findByIdentifier(identifier);
        if (userOpt.isEmpty() || !passwordEncoder.matches(req.getPassword(), userOpt.get().getPasswordHash())) {
            throw new AppException("Invalid username/email or password.", HttpStatus.UNAUTHORIZED);
        }

        User user = userOpt.get();
        userRepository.touchLastLogin(user.getId());
        String token = tokenProvider.generateToken(user);

        return new AuthResponse(token, user);
    }

    public User getProfile(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new AppException("User not found.", HttpStatus.NOT_FOUND));
    }

    @Transactional
    public User updateProfile(UUID userId, Map<String, Object> updates) {
        User existing = getProfile(userId);

        if (updates.containsKey("name")) {
            existing.setName((String) updates.get("name"));
        }
        if (updates.containsKey("username")) {
            String newUsername = normalizeUsername((String) updates.get("username"));
            if (newUsername != null && !newUsername.equals(existing.getUsername())) {
                if (userRepository.findByUsername(newUsername).isPresent()) {
                    throw new AppException("That username is already taken.", HttpStatus.CONFLICT);
                }
                existing.setUsername(newUsername);
            }
        }
        if (updates.containsKey("targetRole")) {
            existing.setTargetRole((String) updates.get("targetRole"));
        }
        if (updates.containsKey("timezone")) {
            existing.setTimezone((String) updates.get("timezone"));
        }
        if (updates.containsKey("preferredLanguage")) {
            existing.setPreferredLanguage((String) updates.get("preferredLanguage"));
            existing.getCoachMetadata().put("preferredLanguage", updates.get("preferredLanguage"));
        }

        return userRepository.updateProfile(existing);
    }

    @Transactional
    public AuthResponse loginWithGoogle(String credential) {
        if (credential == null || credential.isBlank()) {
            throw new AppException("Google credential token is required.", HttpStatus.BAD_REQUEST);
        }

        try {
            org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate();
            String url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + java.net.URLEncoder.encode(credential.trim(), java.nio.charset.StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> tokenInfo = restTemplate.getForObject(url, Map.class);

            if (tokenInfo == null || !tokenInfo.containsKey("email")) {
                throw new AppException("Invalid Google token.", HttpStatus.UNAUTHORIZED);
            }

            String email = ((String) tokenInfo.get("email")).trim().toLowerCase();
            String name = (String) tokenInfo.get("name");
            if (name == null || name.isBlank()) name = email.split("@")[0];
            String picture = (String) tokenInfo.get("picture");

            Optional<User> userOpt = userRepository.findByEmail(email);
            User user;
            if (userOpt.isPresent()) {
                user = userOpt.get();
                userRepository.touchLastLogin(user.getId());
            } else {
                String username = buildAvailableUsername(name, email.split("@")[0]);
                User newUser = new User();
                newUser.setName(name);
                newUser.setEmail(email);
                newUser.setUsername(username);
                newUser.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
                newUser.setRole("user");
                newUser.setTier("free");
                newUser.setAccessTier("standard");
                newUser.setTimezone(defaultTimezone);

                user = userRepository.createUser(newUser);
                userProfileRepository.createProfile(user.getId());

                if (picture != null && !picture.isBlank()) {
                    com.placeprep.model.UserProfile p = new com.placeprep.model.UserProfile();
                    p.setUserId(user.getId());
                    p.setAvatarUrl(picture);
                    userProfileRepository.upsertProfile(p);
                }
            }

            String token = tokenProvider.generateToken(user);
            return new AuthResponse(token, user);
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException("Failed to verify Google token: " + e.getMessage(), HttpStatus.UNAUTHORIZED);
        }
    }
}
