package com.placeprep.controller;

import com.placeprep.model.Task;
import com.placeprep.model.User;
import com.placeprep.repository.TaskRepository;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.TaskService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createTask(
            @CurrentUser User user,
            @RequestBody Task task
    ) {
        Task created = taskService.createTask(user, task);
        return new ResponseEntity<>(Map.of("success", true, "data", created), HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> listTasks(
            @CurrentUser User user,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer limit
    ) {
        List<Task> tasks = taskService.listTasks(user, date, status, category, limit);
        return ResponseEntity.ok(Map.of("success", true, "data", tasks));
    }

    @GetMapping("/today")
    public ResponseEntity<Map<String, Object>> getTodayTasks(@CurrentUser User user) {
        List<Task> tasks = taskService.listTasks(user, "today", null, null, null);
        return ResponseEntity.ok(Map.of("success", true, "data", tasks));
    }

    @GetMapping("/search")
    public ResponseEntity<Map<String, Object>> searchTasks(
            @CurrentUser User user,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer limit
    ) {
        List<Task> tasks = taskService.searchTasks(user, q, status, category, null, null, limit);
        return ResponseEntity.ok(Map.of("success", true, "data", tasks, "count", tasks.size()));
    }

    @PostMapping("/bulk-delete")
    public ResponseEntity<Map<String, Object>> bulkDeleteTasks(
            @CurrentUser User user,
            @RequestBody Map<String, Object> body
    ) {
        List<UUID> ids = extractAndParseUuids(body, "taskIds", "task_ids");
        TaskRepository.BulkDeleteResult result = taskService.bulkDeleteTasks(user, ids);
        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @PostMapping("/bulk-complete")
    public ResponseEntity<Map<String, Object>> bulkCompleteTasks(
            @CurrentUser User user,
            @RequestBody Map<String, Object> body
    ) {
        List<UUID> ids = extractAndParseUuids(body, "taskIds", "task_ids");
        List<Task> completed = taskService.bulkCompleteTasks(user, ids);
        return ResponseEntity.ok(Map.of("success", true, "data", completed, "count", completed.size()));
    }

    @PostMapping("/bulk-update")
    public ResponseEntity<Map<String, Object>> bulkUpdateTasks(
            @CurrentUser User user,
            @RequestBody Map<String, Object> body
    ) {
        List<UUID> ids = extractAndParseUuids(body, "taskIds", "task_ids");
        @SuppressWarnings("unchecked")
        Map<String, Object> updates = (Map<String, Object>) body.get("updates");
        List<Task> updated = taskService.bulkUpdateTasks(user, ids, updates);
        return ResponseEntity.ok(Map.of("success", true, "data", updated, "count", updated.size()));
    }

    private List<UUID> extractAndParseUuids(Map<String, Object> body, String... keys) {
        if (body == null) return List.of();
        List<?> rawList = null;
        for (String k : keys) {
            if (body.containsKey(k) && body.get(k) instanceof List<?> list) {
                rawList = list;
                break;
            }
        }
        if (rawList == null) return List.of();
        List<UUID> valid = new ArrayList<>();
        for (Object item : rawList) {
            if (item != null) {
                String str = item.toString().trim();
                try {
                    valid.add(UUID.fromString(str));
                } catch (IllegalArgumentException ignored) {}
            }
        }
        return valid;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getTask(
            @CurrentUser User user,
            @PathVariable UUID id
    ) {
        Task task = taskService.getTask(user, id);
        return ResponseEntity.ok(Map.of("success", true, "data", task));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateTask(
            @CurrentUser User user,
            @PathVariable UUID id,
            @RequestBody Map<String, Object> updates
    ) {
        Task updated = taskService.updateTask(user, id, updates);
        return ResponseEntity.ok(Map.of("success", true, "data", updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteTask(
            @CurrentUser User user,
            @PathVariable UUID id
    ) {
        Task deleted = taskService.deleteTask(user, id);
        return ResponseEntity.ok(Map.of("success", true, "data", deleted));
    }
}
