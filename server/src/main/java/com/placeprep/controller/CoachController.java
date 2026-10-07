package com.placeprep.controller;

import com.placeprep.model.CoachGroup;
import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.CoachService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/coach")
@PreAuthorize("hasRole('ADMIN')")
public class CoachController {

    private final CoachService coachService;

    public CoachController(CoachService coachService) {
        this.coachService = coachService;
    }

    @GetMapping("/students")
    public ResponseEntity<Map<String, Object>> listStudents(@CurrentUser User user) {
        List<Map<String, Object>> students = coachService.listStudentsForAdmin(user);
        return ResponseEntity.ok(Map.of("success", true, "data", students));
    }

    @GetMapping("/groups")
    public ResponseEntity<Map<String, Object>> listGroups(@CurrentUser User user) {
        List<CoachGroup> groups = coachService.listGroupsForAdmin(user);
        return ResponseEntity.ok(Map.of("success", true, "data", groups));
    }

    @GetMapping("/group-candidates")
    public ResponseEntity<Map<String, Object>> listGroupCandidates(@CurrentUser User user) {
        List<Map<String, Object>> candidates = coachService.listGroupCandidatesForAdmin(user);
        return ResponseEntity.ok(Map.of("success", true, "data", candidates));
    }

    @PostMapping("/groups")
    public ResponseEntity<Map<String, Object>> createGroup(
            @CurrentUser User user,
            @RequestBody Map<String, Object> payload
    ) {
        CoachGroup group = coachService.createGroup(user, payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("success", true, "data", group));
    }

    @PostMapping("/groups/{groupId}/members")
    public ResponseEntity<Map<String, Object>> addGroupMembers(
            @CurrentUser User user,
            @PathVariable UUID groupId,
            @RequestBody Map<String, List<UUID>> payload
    ) {
        List<UUID> memberIds = payload.getOrDefault("studentUserIds", List.of());
        CoachGroup group = coachService.addGroupMembers(user, groupId, memberIds);
        return ResponseEntity.ok(Map.of("success", true, "data", group));
    }

    @DeleteMapping("/groups/{groupId}/members/{studentUserId}")
    public ResponseEntity<Map<String, Object>> removeGroupMember(
            @CurrentUser User user,
            @PathVariable UUID groupId,
            @PathVariable UUID studentUserId
    ) {
        CoachGroup group = coachService.removeGroupMember(groupId, studentUserId);
        return ResponseEntity.ok(Map.of("success", true, "data", group));
    }

    @PostMapping("/practice-capsules")
    public ResponseEntity<Map<String, Object>> createPracticeCapsule(
            @CurrentUser User user,
            @RequestBody Map<String, Object> payload
    ) {
        Map<String, Object> capsule = coachService.createPracticeCapsule(user, payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("success", true, "data", capsule));
    }

    @DeleteMapping("/students/{studentUserId}/proofs")
    public ResponseEntity<Map<String, Object>> clearStudentProofHistory(
            @CurrentUser User user,
            @PathVariable UUID studentUserId
    ) {
        Map<String, Object> result = coachService.clearStudentProofHistory(studentUserId);
        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @DeleteMapping("/progress/history")
    public ResponseEntity<Map<String, Object>> clearProgressHistory(
            @CurrentUser User user,
            @RequestBody(required = false) Map<String, Object> payload
    ) {
        Map<String, Object> result = coachService.clearProgressHistory(user, payload != null ? payload : Map.of());
        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @DeleteMapping("/practice-capsules/history")
    public ResponseEntity<Map<String, Object>> clearPracticeCapsuleHistory(
            @CurrentUser User user,
            @RequestBody(required = false) Map<String, Object> payload
    ) {
        Map<String, Object> result = coachService.clearPracticeCapsuleHistory(user, payload != null ? payload : Map.of());
        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @DeleteMapping("/students/{studentUserId}")
    public ResponseEntity<Map<String, Object>> removeStudent(
            @CurrentUser User user,
            @PathVariable UUID studentUserId
    ) {
        Map<String, Object> result = coachService.removeStudent(user, studentUserId);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/students")
    public ResponseEntity<Map<String, Object>> removeStudentsBulk(
            @CurrentUser User user,
            @RequestBody Map<String, List<UUID>> payload
    ) {
        List<UUID> ids = payload.getOrDefault("studentUserIds", List.of());
        Map<String, Object> result = coachService.removeStudentsBulk(user, ids);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/groups/{groupId}")
    public ResponseEntity<Map<String, Object>> deleteGroup(
            @CurrentUser User user,
            @PathVariable UUID groupId
    ) {
        Map<String, Object> result = coachService.deleteGroup(user, groupId);
        return ResponseEntity.ok(result);
    }
}
