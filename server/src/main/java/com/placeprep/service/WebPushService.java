package com.placeprep.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.placeprep.model.Notification;
import com.placeprep.model.PushSubscription;
import com.placeprep.model.User;
import com.placeprep.repository.AppSettingRepository;
import com.placeprep.repository.PushSubscriptionRepository;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Utils;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.*;
import org.bouncycastle.jce.interfaces.ECPrivateKey;
import org.bouncycastle.jce.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class WebPushService {

    private static final Logger log = LoggerFactory.getLogger(WebPushService.class);
    private static final String VAPID_SETTING_KEY = "web_push_vapid_keys";

    static {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    public record WebPushDeliveryResult(
            boolean attempted,
            int sentCount,
            int failedCount,
            String reason
    ) {}

    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final AppSettingRepository appSettingRepository;
    private final ObjectMapper objectMapper;

    @Value("${placeprep.webpush.public-key:}")
    private String configuredPublicKey;

    @Value("${placeprep.webpush.private-key:}")
    private String configuredPrivateKey;

    @Value("${placeprep.webpush.subject:mailto:support@placeprep.app}")
    private String webPushSubject;

    @Value("${placeprep.app.url:https://mvdev.in}")
    private String appUrl;

    private volatile KeyPair cachedVapidKeyPair = null;
    private volatile String cachedPublicKeyBase64 = null;
    private volatile String cachedPrivateKeyBase64 = null;

    public WebPushService(
            PushSubscriptionRepository pushSubscriptionRepository,
            AppSettingRepository appSettingRepository,
            ObjectMapper objectMapper
    ) {
        this.pushSubscriptionRepository = pushSubscriptionRepository;
        this.appSettingRepository = appSettingRepository;
        this.objectMapper = objectMapper;
    }

    public synchronized Map<String, String> resolveVapidKeys() {
        if (cachedPublicKeyBase64 != null && cachedPrivateKeyBase64 != null) {
            return Map.of("publicKey", cachedPublicKeyBase64, "privateKey", cachedPrivateKeyBase64);
        }

        // 1. Check environment variables
        if (configuredPublicKey != null && !configuredPublicKey.isBlank()
                && configuredPrivateKey != null && !configuredPrivateKey.isBlank()) {
            cachedPublicKeyBase64 = configuredPublicKey.trim();
            cachedPrivateKeyBase64 = configuredPrivateKey.trim();
            return Map.of("publicKey", cachedPublicKeyBase64, "privateKey", cachedPrivateKeyBase64);
        }

        // 2. Check app_settings in database
        Optional<Map<String, Object>> settingOpt = appSettingRepository.findByKey(VAPID_SETTING_KEY);
        if (settingOpt.isPresent()) {
            Map<String, Object> setting = settingOpt.get();
            String pub = (String) setting.get("publicKey");
            String priv = (String) setting.get("privateKey");
            if (pub != null && !pub.isBlank() && priv != null && !priv.isBlank()) {
                cachedPublicKeyBase64 = pub.trim();
                cachedPrivateKeyBase64 = priv.trim();
                return Map.of("publicKey", cachedPublicKeyBase64, "privateKey", cachedPrivateKeyBase64);
            }
        }

        // 3. Generate fresh P-256 keypair and persist into app_settings
        try {
            KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC", BouncyCastleProvider.PROVIDER_NAME);
            ECGenParameterSpec ecSpec = new ECGenParameterSpec("prime256v1");
            kpg.initialize(ecSpec, new SecureRandom());
            KeyPair keyPair = kpg.generateKeyPair();

            byte[] pubBytes = Utils.encode((ECPublicKey) keyPair.getPublic());
            byte[] privBytes = Utils.encode((ECPrivateKey) keyPair.getPrivate());

            String pubBase64 = Base64.getUrlEncoder().withoutPadding().encodeToString(pubBytes);
            String privBase64 = Base64.getUrlEncoder().withoutPadding().encodeToString(privBytes);

            appSettingRepository.upsertSetting(VAPID_SETTING_KEY, Map.of(
                    "publicKey", pubBase64,
                    "privateKey", privBase64,
                    "generatedAt", Instant.now().toString()
            ));

            cachedPublicKeyBase64 = pubBase64;
            cachedPrivateKeyBase64 = privBase64;
            log.info("[web-push] Generated and persisted fresh VAPID keypair in database.");
            return Map.of("publicKey", cachedPublicKeyBase64, "privateKey", cachedPrivateKeyBase64);
        } catch (Exception e) {
            log.error("[web-push] Failed to generate VAPID keys: {}", e.getMessage(), e);
            return Map.of("publicKey", "", "privateKey", "");
        }
    }

    public boolean isConfigured() {
        Map<String, String> keys = resolveVapidKeys();
        return !keys.get("publicKey").isBlank() && !keys.get("privateKey").isBlank();
    }

    public Map<String, Object> getWebPushConfig() {
        Map<String, String> keys = resolveVapidKeys();
        boolean enabled = !keys.get("publicKey").isBlank();
        return Map.of(
                "enabled", enabled,
                "publicKey", keys.getOrDefault("publicKey", "")
        );
    }

    @SuppressWarnings("unchecked")
    public PushSubscription saveSubscription(User user, Map<String, Object> payload, String userAgent) {
        if (payload == null) {
            return null;
        }

        Map<String, Object> subMap = payload.containsKey("subscription") && payload.get("subscription") instanceof Map
                ? (Map<String, Object>) payload.get("subscription")
                : payload;

        String endpoint = (String) subMap.get("endpoint");
        Map<String, Object> keys = subMap.get("keys") instanceof Map ? (Map<String, Object>) subMap.get("keys") : null;

        if (endpoint == null || endpoint.isBlank() || keys == null) {
            return null;
        }

        String p256dh = (String) keys.get("p256dh");
        String auth = (String) keys.get("auth");
        if (p256dh == null || auth == null) {
            return null;
        }

        PushSubscription sub = new PushSubscription();
        sub.setUserId(user.getId());
        sub.setEndpoint(endpoint.trim());
        sub.setP256dh(p256dh.trim());
        sub.setAuth(auth.trim());
        sub.setUserAgent(userAgent);

        if (subMap.get("expirationTime") != null && subMap.get("expirationTime") instanceof Number num) {
            sub.setExpirationTime(Instant.ofEpochMilli(num.longValue()).atOffset(ZoneOffset.UTC));
        }

        return pushSubscriptionRepository.upsertSubscription(sub);
    }

    public boolean deleteSubscription(User user, String endpoint) {
        if (endpoint == null || endpoint.isBlank()) {
            return false;
        }
        return pushSubscriptionRepository.deleteByEndpoint(user.getId(), endpoint.trim());
    }

    public WebPushDeliveryResult sendPushNotificationToUser(UUID userId, Notification notification) {
        List<PushSubscription> subscriptions = pushSubscriptionRepository.listByUserId(userId);
        if (subscriptions.isEmpty()) {
            return new WebPushDeliveryResult(false, 0, 0, "no_subscriptions");
        }

        Map<String, String> vapidKeys = resolveVapidKeys();
        if (vapidKeys.get("publicKey").isBlank() || vapidKeys.get("privateKey").isBlank()) {
            return new WebPushDeliveryResult(false, 0, 0, "web_push_not_configured");
        }

        String subject = webPushSubject != null && !webPushSubject.isBlank() ? webPushSubject : "mailto:support@placeprep.app";
        if (!subject.startsWith("mailto:") && !subject.startsWith("http")) {
            subject = "mailto:" + subject;
        }

        PushService pushService;
        try {
            pushService = new PushService(vapidKeys.get("publicKey"), vapidKeys.get("privateKey"), subject);
        } catch (Exception e) {
            log.error("[web-push] Failed to initialize PushService: {}", e.getMessage());
            return new WebPushDeliveryResult(true, 0, subscriptions.size(), "init_failed");
        }

        String route = "/tasks";
        if (notification.getMetadata() != null && notification.getMetadata().containsKey("route")) {
            route = String.valueOf(notification.getMetadata().get("route"));
        }

        Map<String, Object> pushPayload = Map.of(
                "title", "PlacePrep",
                "body", notification.getMessage() != null ? notification.getMessage() : "PlacePrep tactical signal",
                "icon", "/favicon.svg",
                "badge", "/favicon.svg",
                "tag", notification.getId() != null ? notification.getId().toString() : "placeprep-signal",
                "data", Map.of(
                        "route", route,
                        "notificationId", notification.getId() != null ? notification.getId().toString() : ""
                )
        );

        String payloadJson;
        try {
            payloadJson = objectMapper.writeValueAsString(pushPayload);
        } catch (Exception e) {
            payloadJson = "{\"title\":\"PlacePrep\",\"body\":\"" + notification.getMessage() + "\"}";
        }

        int sentCount = 0;
        int failedCount = 0;

        for (PushSubscription sub : subscriptions) {
            try {
                nl.martijndwars.webpush.Notification webPushNote = new nl.martijndwars.webpush.Notification(
                        sub.getEndpoint(),
                        sub.getP256dh(),
                        sub.getAuth(),
                        payloadJson.getBytes(java.nio.charset.StandardCharsets.UTF_8)
                );

                HttpResponse response = pushService.send(webPushNote);
                int statusCode = response.getStatusLine().getStatusCode();

                if (statusCode >= 200 && statusCode < 300) {
                    sentCount++;
                    pushSubscriptionRepository.touchSubscription(sub.getEndpoint());
                } else if (statusCode == 404 || statusCode == 410) {
                    // Subscription has expired or was unsubscribed on device
                    log.info("[web-push] Subscription expired ({}); removing endpoint: {}", statusCode, sub.getEndpoint());
                    pushSubscriptionRepository.deleteByEndpointAnyUser(sub.getEndpoint());
                    failedCount++;
                } else {
                    log.warn("[web-push] Push service response {}: {}", statusCode, response.getStatusLine().getReasonPhrase());
                    failedCount++;
                }
            } catch (Exception e) {
                log.error("[web-push] Failed sending push to endpoint {}: {}", sub.getEndpoint(), e.getMessage());
                failedCount++;
            }
        }

        return new WebPushDeliveryResult(true, sentCount, failedCount, sentCount > 0 ? "sent" : "delivery_failed");
    }
}
