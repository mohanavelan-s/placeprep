package com.placeprep.controller;

import com.placeprep.model.ApkVersion;
import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.ApkService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.view.RedirectView;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/apk")
public class ApkController {

    private final ApkService apkService;

    public ApkController(ApkService apkService) {
        this.apkService = apkService;
    }

    @GetMapping("/latest")
    public ResponseEntity<Map<String, Object>> getLatestApk() {
        ApkVersion apk = apkService.getLatestApk();
        return ResponseEntity.ok(Map.of("success", true, "data", apk));
    }

    @GetMapping("/versions")
    public ResponseEntity<Map<String, Object>> listApkVersions(@RequestParam(required = false, defaultValue = "10") Integer limit) {
        List<ApkVersion> versions = apkService.listApkVersions(limit);
        return ResponseEntity.ok(Map.of("success", true, "data", versions));
    }

    @GetMapping("/{id}/download")
    public RedirectView downloadApk(@PathVariable UUID id) {
        ApkVersion apk = apkService.getApkById(id);
        return new RedirectView(apk.getFileUrl());
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> uploadApk(
            @CurrentUser User user,
            @RequestParam("apk") MultipartFile file,
            @RequestParam(value = "version", required = false) String version
    ) {
        ApkVersion apk = apkService.uploadApk(user, file, version);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("success", true, "data", apk));
    }
}
