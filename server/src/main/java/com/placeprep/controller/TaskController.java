package com.placeprep.controller;

import com.placeprep.model.Task;
import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.TaskService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
