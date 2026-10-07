package com.placeprep.controller;

import com.placeprep.model.Image;
import com.placeprep.model.User;
import com.placeprep.security.CurrentUser;
import com.placeprep.service.ImageService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/uploads")
public class UploadController {

    private final ImageService imageService;

    public UploadController(ImageService imageService) {
        this.imageService = imageService;
    }

    @PostMapping("/images")
    public ResponseEntity<Map<String, Object>> uploadImage(
            @CurrentUser User user,
            @RequestParam("image") MultipartFile file,
            @RequestParam(value = "taskId", required = false) UUID taskId,
            @RequestParam(value = "dailyLogId", required = false) UUID dailyLogId,
            @RequestParam(value = "proofDate", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate proofDate,
            @RequestParam(value = "caption", required = false) String caption
    ) {
        Image image = imageService.uploadImage(user, file, taskId, dailyLogId, proofDate, caption);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("success", true, "data", image));
    }

    @GetMapping("/images")
    public ResponseEntity<Map<String, Object>> listImages(
            @CurrentUser User user,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) Integer limit
    ) {
        List<Image> images = imageService.listImages(user, date, limit);
        return ResponseEntity.ok(Map.of("success", true, "data", images));
    }

    @DeleteMapping("/images/history")
    public ResponseEntity<Map<String, Object>> clearImagesHistory(@CurrentUser User user) {
        Map<String, Object> result = imageService.clearProofHistory(user);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/images/{imageId}")
    public ResponseEntity<Map<String, Object>> deleteImage(
            @CurrentUser User user,
            @PathVariable UUID imageId
    ) {
        Map<String, Object> result = imageService.deleteImage(user, imageId);
        return ResponseEntity.ok(result);
    }
}
