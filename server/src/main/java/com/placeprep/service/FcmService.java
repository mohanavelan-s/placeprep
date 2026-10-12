package com.placeprep.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.*;
import com.placeprep.model.MobileDevice;
import com.placeprep.model.Notification;
import com.placeprep.model.UserProfile;
import com.placeprep.repository.MobileDeviceRepository;
import com.placeprep.repository.UserProfileRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

@Service
public class FcmService {

    private static final Logger log = LoggerFactory.getLogger(FcmService.class);

    private static final List<String> SERVICE_ACCOUNT_KEYS = List.of(
            "placeprep.firebase.service-account-json",
            "FIREBASE_SERVICE_ACCOUNT_JSON",
            "FIREBASE_SERVICE_ACCOUNT",
            "FIREBASE_CREDENTIALS",
            "GOOGLE_APPLICATION_CREDENTIALS_JSON",
            "GOOGLE_APPLICATION_CREDENTIALS"
    );

    private static final List<String> PROJECT_ID_KEYS = List.of(
            "placeprep.firebase.project-id",
            "FIREBASE_PROJECT_ID",
            "GOOGLE_CLOUD_PROJECT",
            "GCP_PROJECT"
    );

    private final MobileDeviceRepository mobileDeviceRepository;
    private final UserProfileRepository userProfileRepository;
    private final Environment environment;
    private final ObjectMapper objectMapper;

    @Value("${placeprep.firebase.project-id:${FIREBASE_PROJECT_ID:}}")
    private String envProjectId;

    @Value("${placeprep.firebase.service-account-json:${FIREBASE_SERVICE_ACCOUNT_JSON:}}")
    private String envServiceAccountJson;

    private volatile boolean configured = false;
    private volatile String initializationStatus = "uninitialized";
    private volatile String detectedFormat = "missing";
    private volatile String resolvedProjectId = null;
    private volatile String detectedClientEmail = null;
    private volatile boolean hasPrivateKey = false;
    private volatile String lastInitError = null;

    public FcmService(
            MobileDeviceRepository mobileDeviceRepository,
            UserProfileRepository userProfileRepository,
            Environment environment,
            ObjectMapper objectMapper
    ) {
        this.mobileDeviceRepository = mobileDeviceRepository;
        this.userProfileRepository = userProfileRepository;
        this.environment = environment;
        this.objectMapper = (objectMapper != null) ? objectMapper : new ObjectMapper();
    }

    @PostConstruct
    public synchronized void init() {
        String raw = resolveServiceAccountRaw();
        String candidateProjectId = resolveProjectIdRaw();

        if (raw == null || raw.trim().isEmpty()) {
            this.configured = false;
            this.initializationStatus = "missing_credentials";
            this.detectedFormat = "missing";
            this.resolvedProjectId = (candidateProjectId != null && !candidateProjectId.isBlank()) ? candidateProjectId.trim() : null;
            this.lastInitError = "FIREBASE_SERVICE_ACCOUNT_JSON is not configured in Railway environment";
            log.warn("[FCM] Firebase service account credentials not configured. Checked environment variables [FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_CREDENTIALS, GOOGLE_APPLICATION_CREDENTIALS_JSON]. Project ID configured: '{}'",
                    (this.resolvedProjectId != null) ? this.resolvedProjectId : "none");
            return;
        }

        String normalized = normalizeServiceAccountContent(raw);
        if (normalized == null || normalized.isEmpty()) {
            this.configured = false;
            this.initializationStatus = "empty_credentials";
            this.detectedFormat = "empty";
            this.lastInitError = "FIREBASE_SERVICE_ACCOUNT_JSON is empty after normalization";
            return;
        }

        try {
            JsonNode root;
            try {
                root = objectMapper.readTree(normalized);
            } catch (Exception jsonEx) {
                if (normalized.contains("\\\"")) {
                    String unescaped = normalized.replace("\\\"", "\"").replace("\\\\", "\\");
                    root = objectMapper.readTree(unescaped);
                    normalized = unescaped;
                } else {
                    throw jsonEx;
                }
            }

            // CRITICAL CHECK: Did the user paste client google-services.json instead of an Admin Service Account key?
            if (root.has("project_info") && root.has("client")) {
                this.configured = false;
                this.initializationStatus = "client_config_provided_instead_of_service_account";
                this.detectedFormat = "client_google_services_json";
                String pid = root.path("project_info").path("project_id").asText("mvs1-10078");
                this.resolvedProjectId = pid;
                this.lastInitError = "Configured JSON in FIREBASE_SERVICE_ACCOUNT_JSON is a client google-services.json file, NOT a Firebase Admin Service Account private key. To fix: Open Firebase Console -> Project Settings -> Service accounts -> click 'Generate new private key' and paste that private key JSON into Railway.";
                log.error("[FCM] CRITICAL CONFIGURATION MISMATCH: FIREBASE_SERVICE_ACCOUNT_JSON contains an Android client 'google-services.json' file for project '{}'. A backend Firebase Admin Service Account private key is required to send push notifications. Generate one in Firebase Console -> Project Settings -> Service accounts -> 'Generate new private key'.",
                        this.resolvedProjectId);
                return;
            }

            String type = root.path("type").asText("");
            String jsonProjectId = root.path("project_id").asText("");
            String clientEmail = root.path("client_email").asText("");
            String privateKey = root.path("private_key").asText("");

            this.detectedClientEmail = clientEmail;
            this.hasPrivateKey = !privateKey.isBlank();
            this.resolvedProjectId = !jsonProjectId.isBlank() ? jsonProjectId : candidateProjectId;

            if (!"service_account".equalsIgnoreCase(type) || privateKey.isBlank() || clientEmail.isBlank()) {
                this.configured = false;
                this.initializationStatus = "invalid_service_account_structure";
                this.detectedFormat = !type.isBlank() ? type : "unknown_json";
                this.lastInitError = "JSON is missing required Service Account fields ('type': 'service_account', 'client_email', 'private_key').";
                log.error("[FCM] Invalid Service Account JSON structure: type='{}', hasEmail={}, hasKey={}",
                        type, !clientEmail.isBlank(), !privateKey.isBlank());
                return;
            }

            // If private_key has literal "\\n", normalize it inside the JSON
            if (privateKey.contains("\\n") && !privateKey.contains("\n")) {
                log.info("[FCM] Normalizing literal escaped newlines in service account private key.");
                ((ObjectNode) root).put("private_key", privateKey.replace("\\n", "\n"));
                normalized = objectMapper.writeValueAsString(root);
            }

            // Verify project ID consistency
            if (candidateProjectId != null && !candidateProjectId.isBlank() && !jsonProjectId.isBlank()
                    && !candidateProjectId.equalsIgnoreCase(jsonProjectId)) {
                log.warn("[FCM] Configured project ID '{}' differs from service account JSON project ID '{}'. Using JSON project ID '{}'.",
                        candidateProjectId, jsonProjectId, jsonProjectId);
            }

            GoogleCredentials credentials = GoogleCredentials.fromStream(
                    new ByteArrayInputStream(normalized.getBytes(StandardCharsets.UTF_8))
            );

            FirebaseOptions.Builder builder = FirebaseOptions.builder().setCredentials(credentials);
            if (this.resolvedProjectId != null && !this.resolvedProjectId.isBlank()) {
                builder.setProjectId(this.resolvedProjectId);
            }

            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseApp.initializeApp(builder.build());
                log.info("[FCM] FirebaseApp initialized successfully for project: {} (client_email: {})",
                        this.resolvedProjectId, maskEmail(this.detectedClientEmail));
            } else {
                log.info("[FCM] FirebaseApp already initialized. Active apps count: {}. Configured project: {}",
                        FirebaseApp.getApps().size(), this.resolvedProjectId);
            }

            this.configured = true;
            this.initializationStatus = "ready";
            this.detectedFormat = "valid_service_account";
            this.lastInitError = null;

        } catch (Exception ex) {
            this.configured = false;
            this.initializationStatus = "initialization_failed";
            this.detectedFormat = "parse_or_sdk_error";
            this.lastInitError = ex.getMessage();
            log.error("[FCM] Failed to initialize FirebaseApp from service account JSON: {}", ex.getMessage(), ex);
        }
    }

    public boolean isConfigured() {
        if (!configured) {
            // Lazy recheck if credentials became available at runtime
            init();
        }
        return configured;
    }

    public Map<String, Object> getDiagnostics() {
        Map<String, Object> diag = new LinkedHashMap<>();
        diag.put("configured", configured);
        diag.put("initializationStatus", initializationStatus);
        diag.put("projectId", resolvedProjectId != null ? resolvedProjectId : (envProjectId != null ? envProjectId : "unconfigured"));
        diag.put("envProjectIdPresent", isEnvProjectIdPresent());
        diag.put("envServiceAccountPresent", isEnvServiceAccountPresent());
        diag.put("detectedFormat", detectedFormat);
        diag.put("clientEmail", maskEmail(detectedClientEmail));
        diag.put("hasPrivateKey", hasPrivateKey);
        diag.put("lastError", lastInitError);
        return diag;
    }

    public record FcmDeliveryResult(
            boolean attempted,
            int sentCount,
            int failedCount,
            String reason,
            String error
    ) {}

    public FcmDeliveryResult sendNotificationToUser(UUID userId, Notification notification) {
        boolean enabled = userProfileRepository.findByUserId(userId)
                .map(UserProfile::isNotificationsEnabled)
                .orElse(true);

        if (!enabled) {
            return new FcmDeliveryResult(false, 0, 0, "user_disabled_notifications", null);
        }

        List<MobileDevice> devices = mobileDeviceRepository.listByUserId(userId);
        if (devices.isEmpty()) {
            return new FcmDeliveryResult(false, 0, 0, "no_registered_devices", null);
        }

        if (!isConfigured()) {
            String errorDesc = (lastInitError != null && !lastInitError.isBlank())
                    ? lastInitError
                    : "Firebase service account credentials not configured in environment";
            log.debug("[FCM] Skipped remote dispatch to {} device(s) - credentials not configured: {}", devices.size(), errorDesc);
            return new FcmDeliveryResult(false, 0, devices.size(), "fcm_not_configured", errorDesc);
        }

        int sentCount = 0;
        int failedCount = 0;
        String lastError = null;

        String channelId = resolveChannelId(notification.getType());
        String route = "/tasks";
        String taskId = "";
        if (notification.getMetadata() != null) {
            if (notification.getMetadata().get("route") != null) {
                route = String.valueOf(notification.getMetadata().get("route"));
            }
            if (notification.getMetadata().get("taskId") != null) {
                taskId = String.valueOf(notification.getMetadata().get("taskId"));
            }
        }

        Map<String, String> data = new LinkedHashMap<>();
        data.put("id", notification.getId() != null ? notification.getId().toString() : UUID.randomUUID().toString());
        data.put("type", notification.getType() != null ? notification.getType() : "general");
        data.put("message", notification.getMessage() != null ? notification.getMessage() : "");
        data.put("route", route);
        data.put("taskId", taskId);
        data.put("click_action", "OPEN_ROUTE");

        AndroidConfig androidConfig = AndroidConfig.builder()
                .setPriority(AndroidConfig.Priority.HIGH)
                .setNotification(AndroidNotification.builder()
                        .setChannelId(channelId)
                        .setSound("default")
                        .setClickAction("OPEN_ROUTE")
                        .setColor("#9C2E34")
                        .build())
                .build();

        Set<String> processedTokens = new HashSet<>();

        for (MobileDevice device : devices) {
            String token = device.getDeviceToken();
            if (token == null || token.isBlank() || processedTokens.contains(token)) {
                continue;
            }
            processedTokens.add(token);

            String masked = maskToken(token);

            Message msg = Message.builder()
                    .setToken(token)
                    .setNotification(com.google.firebase.messaging.Notification.builder()
                            .setTitle("PlacePrep")
                            .setBody(notification.getMessage() != null ? notification.getMessage() : "Preparation update")
                            .build())
                    .putAllData(data)
                    .setAndroidConfig(androidConfig)
                    .build();

            boolean sent = false;
            for (int attempt = 1; attempt <= 2 && !sent; attempt++) {
                try {
                    String messageId = FirebaseMessaging.getInstance().send(msg);
                    sentCount++;
                    sent = true;
                    log.info("[FCM] Successfully delivered push to device {} (messageId: {})", masked, messageId);
                } catch (FirebaseMessagingException fme) {
                    MessagingErrorCode code = fme.getMessagingErrorCode();
                    if (code == MessagingErrorCode.UNREGISTERED || code == MessagingErrorCode.INVALID_ARGUMENT) {
                        log.warn("[FCM] Token {} is invalid/unregistered ({}). Cleaning up from database.", masked, code);
                        mobileDeviceRepository.deleteByToken(token);
                        failedCount++;
                        lastError = code.toString();
                        break;
                    } else if (attempt == 1 && isTransient(fme)) {
                        log.warn("[FCM] Transient error sending to {}, retrying once: {}", masked, fme.getMessage());
                        try {
                            Thread.sleep(300);
                        } catch (InterruptedException ignored) {}
                    } else {
                        log.error("[FCM] Failed to dispatch push to {}: {}", masked, fme.getMessage());
                        failedCount++;
                        lastError = fme.getMessage();
                        break;
                    }
                } catch (Exception ex) {
                    log.error("[FCM] Unexpected error dispatching push to {}: {}", masked, ex.getMessage());
                    failedCount++;
                    lastError = ex.getMessage();
                    break;
                }
            }
        }

        String reason = sentCount > 0 ? "sent" : (failedCount > 0 ? "delivery_failed" : "no_valid_tokens");
        return new FcmDeliveryResult(true, sentCount, failedCount, reason, lastError);
    }

    private String resolveChannelId(String type) {
        if (type == null) return "placeprep_channel_signals";
        return switch (type.toLowerCase()) {
            case "pending_tasks", "task_reminder", "task" -> "placeprep_channel_tasks";
            case "motivation" -> "placeprep_channel_motivation";
            default -> "placeprep_channel_signals";
        };
    }

    private boolean isTransient(FirebaseMessagingException fme) {
        MessagingErrorCode code = fme.getMessagingErrorCode();
        return code == MessagingErrorCode.UNAVAILABLE || code == MessagingErrorCode.INTERNAL;
    }

    public static String maskToken(String token) {
        if (token == null) return "null";
        if (token.length() <= 10) return "***";
        return token.substring(0, 6) + "..." + token.substring(token.length() - 4);
    }

    public static String maskEmail(String email) {
        if (email == null || email.isBlank()) return "null";
        int at = email.indexOf('@');
        if (at <= 3) return "***" + email.substring(Math.max(0, at));
        return email.substring(0, 3) + "***" + email.substring(at);
    }

    private boolean isEnvProjectIdPresent() {
        return resolveProjectIdRaw() != null;
    }

    private boolean isEnvServiceAccountPresent() {
        return resolveServiceAccountRaw() != null;
    }

    private String resolveServiceAccountRaw() {
        for (String key : SERVICE_ACCOUNT_KEYS) {
            String val = System.getenv(key);
            if (val != null && !val.isBlank()) return val;
            val = System.getProperty(key);
            if (val != null && !val.isBlank()) return val;
            if (environment != null) {
                val = environment.getProperty(key);
                if (val != null && !val.isBlank()) return val;
            }
        }
        if (envServiceAccountJson != null && !envServiceAccountJson.isBlank()) {
            return envServiceAccountJson;
        }
        return null;
    }

    private String resolveProjectIdRaw() {
        for (String key : PROJECT_ID_KEYS) {
            String val = System.getenv(key);
            if (val != null && !val.isBlank()) return val;
            val = System.getProperty(key);
            if (val != null && !val.isBlank()) return val;
            if (environment != null) {
                val = environment.getProperty(key);
                if (val != null && !val.isBlank()) return val;
            }
        }
        if (envProjectId != null && !envProjectId.isBlank()) {
            return envProjectId;
        }
        return null;
    }

    private String normalizeServiceAccountContent(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) return null;

        // Check if it is a file path
        if ((trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.endsWith(".json")) && !trimmed.startsWith("{")) {
            try {
                Path p = Path.of(trimmed);
                if (Files.exists(p) && Files.isRegularFile(p)) {
                    log.info("[FCM] Loading service account credentials from file path: {}", p.toAbsolutePath());
                    trimmed = Files.readString(p, StandardCharsets.UTF_8).trim();
                }
            } catch (Exception ex) {
                log.debug("[FCM] File path check skipped: {}", ex.getMessage());
            }
        }

        // Strip wrapping quotes if string was saved with quotes e.g. "{"type": ...}" or '{"type": ...}'
        if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
            if (trimmed.length() >= 2) {
                trimmed = trimmed.substring(1, trimmed.length() - 1).trim();
            }
        }

        // Check if Base64 encoded
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
            try {
                byte[] decoded = Base64.getDecoder().decode(trimmed);
                String decodedStr = new String(decoded, StandardCharsets.UTF_8).trim();
                if (decodedStr.startsWith("{")) {
                    log.info("[FCM] Detected Base64-encoded service account JSON; decoded successfully.");
                    trimmed = decodedStr;
                }
            } catch (Exception ignored) {}
        }

        return trimmed;
    }
}
