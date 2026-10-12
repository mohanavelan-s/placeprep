package com.placeprep.service;

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
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class FcmService {

    private static final Logger log = LoggerFactory.getLogger(FcmService.class);

    private final MobileDeviceRepository mobileDeviceRepository;
    private final UserProfileRepository userProfileRepository;

    @Value("${FIREBASE_PROJECT_ID:}")
    private String envProjectId;

    @Value("${FIREBASE_SERVICE_ACCOUNT_JSON:}")
    private String envServiceAccountJson;

    private volatile boolean configured = false;

    public FcmService(
            MobileDeviceRepository mobileDeviceRepository,
            UserProfileRepository userProfileRepository
    ) {
        this.mobileDeviceRepository = mobileDeviceRepository;
        this.userProfileRepository = userProfileRepository;
    }

    @PostConstruct
    public synchronized void init() {
        String serviceAccountJson = resolveEnvOrProperty("FIREBASE_SERVICE_ACCOUNT_JSON", envServiceAccountJson);
        String projectId = resolveEnvOrProperty("FIREBASE_PROJECT_ID", envProjectId);

        if (serviceAccountJson == null || serviceAccountJson.trim().isEmpty()) {
            log.info("[FCM] Firebase service account JSON is not configured. Remote FCM push notifications will remain disabled until credentials are provided in Railway.");
            this.configured = false;
            return;
        }

        try {
            if (FirebaseApp.getApps().isEmpty()) {
                GoogleCredentials credentials = GoogleCredentials.fromStream(
                        new ByteArrayInputStream(serviceAccountJson.trim().getBytes(StandardCharsets.UTF_8))
                );
                FirebaseOptions.Builder builder = FirebaseOptions.builder().setCredentials(credentials);
                if (projectId != null && !projectId.trim().isEmpty()) {
                    builder.setProjectId(projectId.trim());
                }
                FirebaseApp.initializeApp(builder.build());
                log.info("[FCM] FirebaseApp initialized successfully for project: {}",
                        (projectId != null && !projectId.isBlank()) ? projectId : "credentials-default");
            }
            this.configured = true;
        } catch (Exception ex) {
            log.error("[FCM] Failed to initialize FirebaseApp from service account JSON: {}", ex.getMessage());
            this.configured = false;
        }
    }

    public boolean isConfigured() {
        return configured;
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

        if (!configured) {
            log.debug("[FCM] Skipped remote dispatch to {} device(s) - credentials not configured.", devices.size());
            return new FcmDeliveryResult(false, 0, devices.size(), "fcm_not_configured", "Firebase service account credentials not configured in environment");
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

    private String resolveEnvOrProperty(String key, String fallback) {
        String env = System.getenv(key);
        if (env != null && !env.isBlank()) {
            return env;
        }
        String prop = System.getProperty(key);
        if (prop != null && !prop.isBlank()) {
            return prop;
        }
        return fallback;
    }
}
