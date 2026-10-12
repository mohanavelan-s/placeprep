package com.placeprep.controller;

import com.placeprep.model.Notification;
import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.NotificationService;
import com.placeprep.model.MobileDevice;
import com.placeprep.repository.MobileDeviceRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final MobileDeviceRepository mobileDeviceRepository;

    public NotificationController(NotificationService notificationService, MobileDeviceRepository mobileDeviceRepository) {
        this.notificationService = notificationService;
        this.mobileDeviceRepository = mobileDeviceRepository;
    }

    @PostMapping("/devices")
    public ResponseEntity<Map<String, Object>> registerDevice(
            @CurrentUser User user,
            @RequestBody Map<String, Object> body
    ) {
        String token = (String) body.get("deviceToken");
        if (token == null || token.isBlank()) {
            token = (String) body.get("token");
        }
        if (token == null || token.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "deviceToken is required"));
        }
        String platform = (String) body.getOrDefault("platform", "android");
        String deviceName = (String) body.getOrDefault("deviceName", body.get("deviceModel"));
        String appVersion = (String) body.get("appVersion");

        MobileDevice device = mobileDeviceRepository.registerDevice(
                user.getId(),
                token.trim(),
                platform,
                deviceName,
                appVersion
        );
        return ResponseEntity.ok(Map.of("success", true, "data", device));
    }

    @DeleteMapping("/devices/{deviceToken}")
    public ResponseEntity<Map<String, Object>> unregisterDevice(
            @CurrentUser User user,
            @PathVariable String deviceToken
    ) {
        boolean removed = mobileDeviceRepository.unregisterDevice(user.getId(), deviceToken);
        return ResponseEntity.ok(Map.of("success", true, "unregistered", removed));
    }

    @GetMapping("/devices")
    public ResponseEntity<Map<String, Object>> listDevices(@CurrentUser User user) {
        List<MobileDevice> devices = mobileDeviceRepository.listByUserId(user.getId());
        return ResponseEntity.ok(Map.of("success", true, "data", devices));
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> listNotifications(
            @CurrentUser User user,
            @RequestParam(required = false) Boolean unread,
            @RequestParam(required = false, defaultValue = "20") Integer limit
    ) {
        List<Notification> notifications = notificationService.listNotifications(user, unread, limit);
        return ResponseEntity.ok(Map.of("success", true, "data", notifications));
    }

    @PostMapping("/sync")
    public ResponseEntity<Map<String, Object>> syncNotifications(
            @CurrentUser User user,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        boolean deliverEmail = body != null && Boolean.TRUE.equals(body.get("deliverEmail"));
        Map<String, Object> result = notificationService.syncNotifications(user, deliverEmail);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/test-push")
    public ResponseEntity<Map<String, Object>> testPushNotification(@CurrentUser User user) {
        Map<String, Object> result = notificationService.testPushNotification(user);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{notificationId}/read")
    public ResponseEntity<Map<String, Object>> markRead(
            @CurrentUser User user,
            @PathVariable UUID notificationId
    ) {
        Notification notification = notificationService.markRead(user, notificationId);
        return ResponseEntity.ok(Map.of("success", true, "data", notification));
    }

    @PostMapping("/read-all")
    public ResponseEntity<Map<String, Object>> markAllRead(@CurrentUser User user) {
        Map<String, Object> result = notificationService.markAllRead(user);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/history")
    public ResponseEntity<Map<String, Object>> clearHistory(@CurrentUser User user) {
        Map<String, Object> result = notificationService.clearHistory(user);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/{notificationId}")
    public ResponseEntity<Map<String, Object>> deleteNotification(
            @CurrentUser User user,
            @PathVariable UUID notificationId
    ) {
        Map<String, Object> result = notificationService.deleteNotification(user, notificationId);
        return ResponseEntity.ok(result);
    }
}
