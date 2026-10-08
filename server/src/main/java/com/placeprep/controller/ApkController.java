package com.placeprep.controller;

import com.placeprep.model.ApkVersion;
import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.ApkService;
import com.placeprep.service.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.view.RedirectView;

import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.net.URLConnection;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/apk")
public class ApkController {

    private static final Logger logger = LoggerFactory.getLogger(ApkController.class);

    private final ApkService apkService;
    private final StorageService storageService;

    public ApkController(ApkService apkService, StorageService storageService) {
        this.apkService = apkService;
        this.storageService = storageService;
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

    @GetMapping("/latest/download")
    public Object downloadLatestApk() {
        ApkVersion apk = apkService.getLatestApk();
        return serveApkFile(apk);
    }

    @GetMapping("/{id}/download")
    public Object downloadApk(@PathVariable UUID id) {
        ApkVersion apk = apkService.getApkById(id);
        return serveApkFile(apk);
    }

    private Object serveApkFile(ApkVersion apk) {
        String fileUrl = apk.getFileUrl();
        String filename = (apk.getFileName() != null && !apk.getFileName().isBlank())
                ? apk.getFileName()
                : "placeprep-release.apk";
        if (!filename.toLowerCase().endsWith(".apk")) {
            filename += ".apk";
        }

        if (fileUrl == null || fileUrl.isBlank()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("success", false, "message", "APK file URL not found"));
        }

        // Local storage file
        if (fileUrl.startsWith("/uploads/") || "local".equalsIgnoreCase(apk.getStorageProvider())) {
            Path path = storageService.resolveLocalPath(fileUrl);
            if (path != null && Files.exists(path)) {
                try {
                    Resource resource = new UrlResource(path.toUri());
                    return ResponseEntity.ok()
                            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                            .contentType(MediaType.parseMediaType("application/vnd.android.package-archive"))
                            .contentLength(Files.size(path))
                            .body(resource);
                } catch (Exception e) {
                    logger.error("[ApkController] Failed to serve local APK file: {}", e.getMessage(), e);
                }
            }
        }

        // Remote URL (Cloudinary or other HTTP/HTTPS)
        if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
            try {
                URL url = new URI(fileUrl).toURL();
                URLConnection conn = url.openConnection();
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(30000);
                long contentLength = conn.getContentLengthLong();
                InputStream is = conn.getInputStream();
                InputStreamResource isr = new InputStreamResource(is);

                var builder = ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                        .contentType(MediaType.parseMediaType("application/vnd.android.package-archive"));
                if (contentLength > 0) {
                    builder.contentLength(contentLength);
                }
                return builder.body(isr);
            } catch (Exception e) {
                logger.warn("[ApkController] Remote stream fallback to redirect: {}", e.getMessage());
                return new RedirectView(fileUrl);
            }
        }

        return new RedirectView(fileUrl);
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
