package com.placeprep.service;

import com.placeprep.exception.AppException;
import com.placeprep.model.Task;
import com.placeprep.model.User;
import com.placeprep.repository.TaskRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class TaskService {

    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    public Task createTask(User user, Task t) {
        if (t.getTitle() == null || t.getTitle().isBlank()) {
            throw new AppException("Task title is required.", HttpStatus.BAD_REQUEST);
        }

        t.setUserId(user.getId());
        if (t.getScheduledFor() == null) {
            t.setScheduledFor(LocalDate.now());
        }

        return taskRepository.createTask(t);
    }

    public List<Task> listTasks(User user, String date, String status, String category, Integer limit) {
        return taskRepository.listTasks(user.getId(), date, status, category, limit);
    }

    public Task getTask(User user, UUID taskId) {
        return taskRepository.findByUserAndId(user.getId(), taskId)
                .orElseThrow(() -> new AppException("Task not found.", HttpStatus.NOT_FOUND));
    }

    public Task updateTask(User user, UUID taskId, Map<String, Object> updates) {
        Task existing = getTask(user, taskId);

        if (updates.containsKey("title")) {
            existing.setTitle((String) updates.get("title"));
        }
        if (updates.containsKey("description")) {
            existing.setDescription((String) updates.get("description"));
        }
        if (updates.containsKey("category")) {
            existing.setCategory((String) updates.get("category"));
        }
        if (updates.containsKey("priority")) {
            existing.setPriority((String) updates.get("priority"));
        }
        if (updates.containsKey("scheduledFor") && updates.get("scheduledFor") != null) {
            existing.setScheduledFor(LocalDate.parse(updates.get("scheduledFor").toString()));
        }
        if (updates.containsKey("status")) {
            String newStatus = ((String) updates.get("status")).toLowerCase();
            existing.setStatus(newStatus);
            if ("completed".equals(newStatus)) {
                existing.setCompletedAt(OffsetDateTime.now());
            }
        }
        if (updates.containsKey("actualMinutes") && updates.get("actualMinutes") != null) {
            existing.setActualMinutes(((Number) updates.get("actualMinutes")).intValue());
        }
        if (updates.containsKey("difficulty") && updates.get("difficulty") != null) {
            existing.setDifficulty(((Number) updates.get("difficulty")).intValue());
        }

        return taskRepository.updateTask(existing);
    }

    public Task deleteTask(User user, UUID taskId) {
        Task existing = getTask(user, taskId);
        boolean deleted = taskRepository.deleteTask(user.getId(), taskId);
        if (!deleted) {
            throw new AppException("Failed to delete task.", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        return existing;
    }

    public TaskRepository.BulkDeleteResult bulkDeleteTasks(User user, List<UUID> taskIds) {
        return taskRepository.bulkDeleteTasks(user.getId(), taskIds);
    }

    public List<Task> bulkCompleteTasks(User user, List<UUID> taskIds) {
        return taskRepository.bulkCompleteTasks(user.getId(), taskIds);
    }

    public List<Task> bulkUpdateTasks(User user, List<UUID> taskIds, Map<String, Object> updates) {
        return taskRepository.bulkUpdateTasks(user.getId(), taskIds, updates);
    }

    public List<Task> searchTasks(User user, String query, String status, String category, LocalDate from, LocalDate to, Integer limit) {
        return taskRepository.searchTasks(user.getId(), query, status, category, from, to, limit);
    }
}
