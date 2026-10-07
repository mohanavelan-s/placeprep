package com.placeprep.service;

import com.placeprep.exception.AppException;
import com.placeprep.model.PowerPocketSession;
import com.placeprep.model.Task;
import com.placeprep.model.User;
import com.placeprep.repository.PowerPocketRepository;
import com.placeprep.repository.TaskRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class PowerPocketService {

    private final PowerPocketRepository powerPocketRepository;
    private final TaskRepository taskRepository;
    private final ProgressService progressService;

    public PowerPocketService(PowerPocketRepository powerPocketRepository, TaskRepository taskRepository, ProgressService progressService) {
        this.powerPocketRepository = powerPocketRepository;
        this.taskRepository = taskRepository;
        this.progressService = progressService;
    }

    public PowerPocketSession startSession(User user, PowerPocketSession payload) {
        Optional<PowerPocketSession> active = powerPocketRepository.findActiveSession(user.getId());
        if (active.isPresent()) {
            throw new AppException("There is already an active Power Pocket session.", HttpStatus.CONFLICT);
        }

        String title = payload.getTitle();
        if ((title == null || title.isBlank()) && payload.getTaskId() != null) {
            Optional<Task> taskOpt = taskRepository.findByUserAndId(user.getId(), payload.getTaskId());
            if (taskOpt.isEmpty()) {
                throw new AppException("Assigned task not found.", HttpStatus.NOT_FOUND);
            }
            title = taskOpt.get().getTitle();
            payload.setTitle(title);
        }

        payload.setUserId(user.getId());
        if (payload.getStartedAt() == null) {
            payload.setStartedAt(OffsetDateTime.now());
        }

        PowerPocketSession session = powerPocketRepository.createSession(payload);
        progressService.refreshProgressStats(user.getId(), user.getTimezone());
        return session;
    }

    public PowerPocketSession endSession(User user, UUID sessionId, PowerPocketSession payload) {
        PowerPocketSession session = powerPocketRepository.findById(sessionId, user.getId())
                .orElseThrow(() -> new AppException("Power Pocket session not found.", HttpStatus.NOT_FOUND));

        if (!"active".equalsIgnoreCase(session.getStatus())) {
            throw new AppException("This Power Pocket session has already ended.", HttpStatus.BAD_REQUEST);
        }

        OffsetDateTime endedAt = payload.getEndedAt() != null ? payload.getEndedAt() : OffsetDateTime.now();
        payload.setEndedAt(endedAt);

        if (payload.getDurationMinutes() == null || payload.getDurationMinutes() == 0) {
            long minutes = session.getStartedAt() != null
                    ? Math.max(0, Duration.between(session.getStartedAt(), endedAt).toMinutes())
                    : 0;
            payload.setDurationMinutes((int) minutes);
        }

        if (payload.getStatus() == null || payload.getStatus().isBlank()) {
            payload.setStatus("completed");
        }

        PowerPocketSession updated = powerPocketRepository.updateSession(sessionId, user.getId(), payload)
                .orElseThrow(() -> new AppException("Failed to update Power Pocket session.", HttpStatus.INTERNAL_SERVER_ERROR));

        progressService.refreshProgressStats(user.getId(), user.getTimezone());
        return updated;
    }

    public Optional<PowerPocketSession> getActiveSession(User user) {
        return powerPocketRepository.findActiveSession(user.getId());
    }

    public List<PowerPocketSession> listSessions(User user, LocalDate date, String status, Integer limit) {
        return powerPocketRepository.listSessions(user.getId(), date, status, limit);
    }

    public Map<String, Object> deleteSession(User user, UUID sessionId) {
        int deleted = powerPocketRepository.deleteByIdAndUser(sessionId, user.getId());
        return Map.of("success", true, "deletedCount", deleted, "id", sessionId.toString());
    }

    public Map<String, Object> clearHistory(User user) {
        int deleted = powerPocketRepository.deleteByUser(user.getId());
        return Map.of("success", true, "deletedCount", deleted);
    }
}
