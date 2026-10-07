package com.placeprep.service;

import com.placeprep.exception.AppException;
import com.placeprep.model.Notification;
import com.placeprep.model.User;
import com.placeprep.repository.NotificationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    public List<Notification> listNotifications(User user, Boolean unreadOnly, int limit) {
        return notificationRepository.listNotifications(user.getId(), unreadOnly, limit);
    }

    public Map<String, Object> syncNotifications(User user) {
        // Create motivation or daily check notification if none today
        String todayKey = LocalDate.now().toString();
        Notification note = new Notification();
        note.setUserId(user.getId());
        note.setType("motivation");
        note.setMessage("Keep up your momentum today! Consistency builds placement success.");
        note.setDedupeKey(todayKey);
        note.setDeliveryChannels(List.of("in_app"));
        note.setSentAt(OffsetDateTime.now());

        notificationRepository.createNotification(note);

        List<Notification> unread = notificationRepository.listNotifications(user.getId(), true, 20);
        return Map.of("success", true, "synced", true, "unreadCount", unread.size());
    }

    public Map<String, Object> testPushNotification(User user) {
        Notification note = new Notification();
        note.setUserId(user.getId());
        note.setType("test_notification");
        note.setMessage("Test notification from PlacePrep backend.");
        note.setDedupeKey(UUID.randomUUID().toString());
        note.setDeliveryChannels(List.of("in_app", "push"));
        note.setSentAt(OffsetDateTime.now());

        Notification created = notificationRepository.createNotification(note);
        return Map.of("success", true, "notification", created != null ? created : Map.of());
    }

    public Notification markRead(User user, UUID notificationId) {
        return notificationRepository.markRead(user.getId(), notificationId)
                .orElseThrow(() -> new AppException("Notification not found.", HttpStatus.NOT_FOUND));
    }

    public Map<String, Object> markAllRead(User user) {
        int count = notificationRepository.markAllRead(user.getId());
        return Map.of("success", true, "markedCount", count);
    }

    public Map<String, Object> clearHistory(User user) {
        int count = notificationRepository.deleteByUser(user.getId());
        return Map.of("success", true, "deletedCount", count);
    }

    public Map<String, Object> deleteNotification(User user, UUID notificationId) {
        int count = notificationRepository.deleteByIdAndUser(notificationId, user.getId());
        return Map.of("success", true, "deletedCount", count, "id", notificationId.toString());
    }
}
