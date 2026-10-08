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

        if (updates.containsKey("title") && updates.get("title") != null) {
            existing.setTitle(updates.get("title").toString());
        }
        if (updates.containsKey("description")) {
            existing.setDescription(updates.get("description") != null ? updates.get("description").toString() : null);
        }
        if (updates.containsKey("category") && updates.get("category") != null) {
            existing.setCategory(updates.get("category").toString());
        }
        if (updates.containsKey("subcategory")) {
            existing.setSubcategory(updates.get("subcategory") != null ? updates.get("subcategory").toString() : null);
        }
        if (updates.containsKey("priority") && updates.get("priority") != null) {
            existing.setPriority(updates.get("priority").toString());
        }
        if (updates.containsKey("intensity") && updates.get("intensity") != null) {
            existing.setIntensity(updates.get("intensity").toString());
        }
        if (updates.containsKey("referenceLabel") || updates.containsKey("reference_label")) {
            Object ref = updates.get("referenceLabel");
            if (ref == null) ref = updates.get("reference_label");
            existing.setReferenceLabel(ref != null ? ref.toString() : null);
        }
        if (updates.containsKey("referenceUrl") || updates.containsKey("reference_url")) {
            Object ref = updates.get("referenceUrl");
            if (ref == null) ref = updates.get("reference_url");
            existing.setReferenceUrl(ref != null ? ref.toString() : null);
        }
        if (updates.containsKey("dueDate") || updates.containsKey("due_date")) {
            Object dd = updates.get("dueDate");
            if (dd == null) dd = updates.get("due_date");
            if (dd != null && !dd.toString().isBlank()) {
                existing.setDueDate(LocalDate.parse(dd.toString().trim()));
            }
        }
        if (updates.containsKey("scheduledFor") || updates.containsKey("scheduled_for")) {
            Object sf = updates.get("scheduledFor");
            if (sf == null) sf = updates.get("scheduled_for");
            if (sf != null && !sf.toString().isBlank()) {
                existing.setScheduledFor(LocalDate.parse(sf.toString().trim()));
            }
        }
        if (updates.containsKey("status") && updates.get("status") != null) {
            String newStatus = updates.get("status").toString().toLowerCase().trim();
            existing.setStatus(newStatus);
            if ("completed".equals(newStatus)) {
                existing.setCompletedAt(OffsetDateTime.now());
            }
        }
        if (updates.containsKey("estimatedMinutes") || updates.containsKey("estimated_minutes")) {
            Object est = updates.get("estimatedMinutes");
            if (est == null) est = updates.get("estimated_minutes");
            if (est != null) {
                int val;
                if (est instanceof Number num) {
                    val = num.intValue();
                } else {
                    try {
                        val = Integer.parseInt(est.toString().trim());
                    } catch (NumberFormatException e) {
                        throw new AppException("Invalid integer for estimatedMinutes.", HttpStatus.BAD_REQUEST);
                    }
                }
                if (val < 0) {
                    throw new AppException("estimatedMinutes cannot be negative.", HttpStatus.BAD_REQUEST);
                }
                existing.setEstimatedMinutes(val);
            }
        }
        if (updates.containsKey("actualMinutes") || updates.containsKey("actual_minutes")) {
            Object act = updates.get("actualMinutes");
            if (act == null) act = updates.get("actual_minutes");
            if (act != null) {
                int val;
                if (act instanceof Number num) {
                    val = num.intValue();
                } else {
                    try {
                        val = Integer.parseInt(act.toString().trim());
                    } catch (NumberFormatException e) {
                        throw new AppException("Invalid integer for actualMinutes.", HttpStatus.BAD_REQUEST);
                    }
                }
                if (val < 0) {
                    throw new AppException("actualMinutes cannot be negative.", HttpStatus.BAD_REQUEST);
                }
                existing.setActualMinutes(val);
            }
        }
        if (updates.containsKey("difficulty") && updates.get("difficulty") != null) {
            Object diff = updates.get("difficulty");
            int val = diff instanceof Number num ? num.intValue() : Integer.parseInt(diff.toString().trim());
            existing.setDifficulty(val);
        }
        if (updates.containsKey("weakArea") || updates.containsKey("weak_area")) {
            Object wa = updates.get("weakArea");
            if (wa == null) wa = updates.get("weak_area");
            existing.setWeakArea(wa != null ? wa.toString() : null);
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
