package com.placeprep.controller;

import com.placeprep.model.Resume;
import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.ResumeService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/resume")
public class ResumeController {

    private final ResumeService resumeService;

    public ResumeController(ResumeService resumeService) {
        this.resumeService = resumeService;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> uploadResume(
            @CurrentUser User user,
            @RequestParam(value = "resume", required = false) MultipartFile file,
            @RequestParam(value = "resumeText", required = false) String resumeText,
            @RequestParam(value = "targetRole", required = false) String targetRole,
            @RequestParam(value = "jobDescription", required = false) String jobDescription
    ) {
        Resume resume = resumeService.uploadResume(user, file, resumeText, targetRole, jobDescription);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("success", true, "data", resume));
    }

    @PostMapping("/match")
    public ResponseEntity<Map<String, Object>> scoreAgainstJobDescription(
            @CurrentUser User user,
            @RequestBody Map<String, String> payload
    ) {
        String jobDescription = payload.get("jobDescription");
        String targetRole = payload.get("targetRole");
        String resumeText = payload.get("resumeText");
        Map<String, Object> result = resumeService.scoreAgainstJobDescription(user, resumeText, targetRole, jobDescription);
        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @GetMapping("/latest")
    public ResponseEntity<Map<String, Object>> getLatestResume(@CurrentUser User user) {
        Resume resume = resumeService.getLatestResume(user);
        return ResponseEntity.ok(Map.of("success", true, "data", resume));
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> listResumes(@CurrentUser User user) {
        List<Resume> resumes = resumeService.listResumes(user);
        return ResponseEntity.ok(Map.of("success", true, "data", resumes));
    }

    @DeleteMapping("/history")
    public ResponseEntity<Map<String, Object>> clearHistory(@CurrentUser User user) {
        Map<String, Object> result = resumeService.clearHistory(user);
        return ResponseEntity.ok(Map.of("success", true, "data", result));
    }

    @DeleteMapping("/{resumeId}")
    public ResponseEntity<Map<String, Object>> deleteResume(
            @CurrentUser User user,
            @PathVariable java.util.UUID resumeId
    ) {
        Map<String, Object> result = resumeService.deleteResume(user, resumeId);
        return ResponseEntity.ok(result);
    }
}
