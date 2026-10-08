package com.placeprep.service;

import com.placeprep.exception.AppException;
import com.placeprep.model.Notification;
import com.placeprep.model.User;
import com.placeprep.model.UserProfile;
import com.placeprep.repository.NotificationRepository;
import com.placeprep.repository.TaskRepository;
import com.placeprep.repository.UserProfileRepository;
import com.placeprep.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final EmailService emailService;
    private final WebPushService webPushService;
    private final UserProfileRepository userProfileRepository;
    private final UserRepository userRepository;
    private final TaskRepository taskRepository;

    public NotificationService(
            NotificationRepository notificationRepository,
            EmailService emailService,
            WebPushService webPushService,
            UserProfileRepository userProfileRepository,
            UserRepository userRepository,
            TaskRepository taskRepository
    ) {
        this.notificationRepository = notificationRepository;
        this.emailService = emailService;
        this.webPushService = webPushService;
        this.userProfileRepository = userProfileRepository;
        this.userRepository = userRepository;
        this.taskRepository = taskRepository;
    }

    public List<Notification> listNotifications(User user, Boolean unreadOnly, int limit) {
        return notificationRepository.listNotifications(user.getId(), unreadOnly, limit);
    }

    public Map<String, Object> syncNotifications(User user) {
        return syncNotifications(user, false);
    }

    public Map<String, Object> syncNotifications(User user, boolean deliverEmail) {
        String todayKey = LocalDate.now().toString();
        List<Notification> createdList = new ArrayList<>();

        // Check pending tasks for today
        long pendingCount = taskRepository.listTasks(user.getId(), "today", "pending", null, null).size();
        String type;
        String message;

        if (pendingCount > 0) {
            type = "pending_tasks";
            message = String.format("You have %d pending task%s scheduled for today in Command Chamber.",
                    pendingCount, pendingCount > 1 ? "s" : "");
        } else {
            type = "motivation";
            message = "Keep up your momentum today! Consistency builds placement success.";
        }

        Notification note = new Notification();
        note.setUserId(user.getId());
        note.setType(type);
        note.setMessage(message);
        note.setDedupeKey(todayKey);
        note.setDeliveryChannels(List.of("in_app", "push", "email"));
        note.setSentAt(OffsetDateTime.now());
        note.setMetadata(Map.of("route", "/tasks"));

        Notification created = notificationRepository.createNotification(note);
        if (created != null) {
            createdList.add(created);
        }

        boolean emailAttempted = false;
        boolean emailSent = false;
        String emailReason = "email_not_requested";
        String emailError = null;

        if (deliverEmail || (created != null && isUserEmailEnabled(user.getId()))) {
            EmailService.EmailSendResult emailResult = emailService.sendNotificationEmail(user, note);
            emailAttempted = emailResult.attempted();
            emailSent = emailResult.success();
            emailReason = emailResult.reason();
            emailError = emailResult.error();
        }

        // Web push dispatch if user opted-in
        if (created != null && isUserBrowserEnabled(user.getId())) {
            webPushService.sendPushNotificationToUser(user.getId(), note);
        }

        List<Notification> unread = notificationRepository.listNotifications(user.getId(), true, 20);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("synced", true);
        response.put("created", createdList);
        response.put("unreadCount", unread.size());
        response.put("emailAttempted", emailAttempted);
        response.put("emailSent", emailSent);
        response.put("emailReason", emailReason);
        response.put("emailError", emailError);
        response.put("emailReady", emailService.isEmailConfigured());
        return response;
    }

    public Map<String, Object> testPushNotification(User user) {
        Notification note = new Notification();
        note.setUserId(user.getId());
        note.setType("test_notification");
        note.setMessage("Test signal from PlacePrep command chamber. Browser push and email delivery operational.");
        note.setDedupeKey(UUID.randomUUID().toString());
        note.setDeliveryChannels(List.of("in_app", "push", "email"));
        note.setSentAt(OffsetDateTime.now());
        note.setMetadata(Map.of("route", "/tasks"));

        Notification created = notificationRepository.createNotification(note);

        // 1. Dispatch Web Push
        WebPushService.WebPushDeliveryResult pushResult = webPushService.sendPushNotificationToUser(user.getId(), note);

        // 2. Dispatch Email
        EmailService.EmailSendResult emailResult = emailService.sendNotificationEmail(user, note);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("notification", created != null ? created : Map.of());
        result.put("attempted", true);
        result.put("sentCount", pushResult.sentCount());
        result.put("failedCount", pushResult.failedCount());
        result.put("reason", pushResult.sentCount() > 0 ? "sent" : (pushResult.attempted() ? "delivery_failed" : "no_subscriptions"));
        result.put("browserReady", webPushService.isConfigured());
        result.put("pushReady", webPushService.isConfigured());
        result.put("emailAttempted", emailResult.attempted());
        result.put("emailSent", emailResult.success());
        result.put("emailReason", emailResult.reason());
        result.put("emailError", emailResult.error());
        result.put("emailReady", emailService.isEmailConfigured());

        return result;
    }

    private boolean isUserEmailEnabled(UUID userId) {
        return userProfileRepository.findByUserId(userId)
                .map(p -> p.isNotificationsEnabled() && p.isNotificationEmailEnabled())
                .orElse(true);
    }

    private boolean isUserBrowserEnabled(UUID userId) {
        return userProfileRepository.findByUserId(userId)
                .map(p -> p.isNotificationsEnabled() && p.isNotificationBrowserEnabled())
                .orElse(false);
    }

    public void runDailySweep() {
        log.info("[notifications] Starting daily scheduled notification sweep...");
        try {
            // Simple daily sweep for active students
            List<User> users = userRepository.listRecentActiveUsers(50);
            int sent = 0;
            for (User u : users) {
                try {
                    syncNotifications(u, false);
                    sent++;
                } catch (Exception ex) {
                    log.error("[notifications] Failed to run sync for user {}: {}", u.getId(), ex.getMessage());
                }
            }
            log.info("[notifications] Daily scheduled sweep completed for {} users.", sent);
        } catch (Exception e) {
            log.error("[notifications] Daily sweep failed: {}", e.getMessage(), e);
        }
    }

    public Notification markRead(User user, UUID notificationId) {
        return notificationRepository.markRead(user.getId(), notificationId)
                .orElseThrow(() -> new AppException("Notification not found.", HttpStatus.NOT_FOUND));
    }

    public Map<String, Object> markAllRead(User user) {
        int count = notificationRepository.markAllRead(user.getId());
        return Map.of("success", true, "updated", count);
    }

    public Map<String, Object> clearHistory(User user) {
        int count = notificationRepository.deleteByUser(user.getId());
        return Map.of("success", true, "deleted", count, "clearedAt", OffsetDateTime.now().toString());
    }

    public Map<String, Object> deleteNotification(User user, UUID notificationId) {
        int count = notificationRepository.deleteByIdAndUser(notificationId, user.getId());
        return Map.of("success", true, "deletedCount", count, "id", notificationId.toString());
    }
}
