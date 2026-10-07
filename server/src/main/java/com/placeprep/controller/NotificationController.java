package com.placeprep.controller;

import com.placeprep.model.Notification;
import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
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
    public ResponseEntity<Map<String, Object>> syncNotifications(@CurrentUser User user) {
        Map<String, Object> result = notificationService.syncNotifications(user);
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
