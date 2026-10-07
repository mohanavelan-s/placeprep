package com.placeprep.service;

import com.placeprep.exception.AppException;
import com.placeprep.model.ApkVersion;
import com.placeprep.model.User;
import com.placeprep.repository.ApkVersionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class ApkService {

    private final ApkVersionRepository apkVersionRepository;
    private final StorageService storageService;

    public ApkService(ApkVersionRepository apkVersionRepository, StorageService storageService) {
        this.apkVersionRepository = apkVersionRepository;
        this.storageService = storageService;
    }

    public ApkVersion getLatestApk() {
        return apkVersionRepository.findLatestActive()
                .orElseThrow(() -> new AppException("No APK version currently available.", HttpStatus.NOT_FOUND));
    }

    public List<ApkVersion> listApkVersions(int limit) {
        return apkVersionRepository.listVersions(limit);
    }

    public ApkVersion uploadApk(User user, MultipartFile file, String version) {
        if (file == null || file.isEmpty()) {
            throw new AppException("APK file is required.", HttpStatus.BAD_REQUEST);
        }

        String ver = (version != null && !version.isBlank())
                ? version.trim()
                : "v" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy.MM.dd"));

        try {
            StorageService.UploadResult upload = storageService.upload(file, "apk");

            apkVersionRepository.deactivateAll();

            ApkVersion apk = new ApkVersion();
            apk.setVersion(ver);
            apk.setFileName(file.getOriginalFilename());
            apk.setFileUrl(upload.secureUrl);
            apk.setPublicId(upload.publicId);
            apk.setMimeType("application/vnd.android.package-archive");
            apk.setBytes((int) upload.bytes);
            apk.setStorageProvider(upload.storageProvider);
            apk.setUploadedBy(user.getId());
            apk.setIsActive(true);

            return apkVersionRepository.createVersion(apk);
        } catch (IOException e) {
            throw new AppException("Failed to store APK file: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public ApkVersion getApkById(UUID id) {
        return apkVersionRepository.findById(id)
                .orElseThrow(() -> new AppException("APK not found.", HttpStatus.NOT_FOUND));
    }
}
