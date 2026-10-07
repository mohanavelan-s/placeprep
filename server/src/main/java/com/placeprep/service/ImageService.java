package com.placeprep.service;

import com.placeprep.exception.AppException;
import com.placeprep.model.Image;
import com.placeprep.model.User;
import com.placeprep.repository.ImageRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ImageService {

    private final ImageRepository imageRepository;
    private final StorageService storageService;

    public ImageService(ImageRepository imageRepository, StorageService storageService) {
        this.imageRepository = imageRepository;
        this.storageService = storageService;
    }

    public Image uploadImage(User user, MultipartFile file, UUID taskId, UUID dailyLogId, LocalDate proofDate, String caption) {
        if (file == null || file.isEmpty()) {
            throw new AppException("Image file is required.", HttpStatus.BAD_REQUEST);
        }

        try {
            StorageService.UploadResult upload = storageService.upload(file, "images");

            Image img = new Image();
            img.setUserId(user.getId());
            img.setTaskId(taskId);
            img.setDailyLogId(dailyLogId);
            img.setSecureUrl(upload.secureUrl);
            img.setPublicId(upload.publicId);
            img.setMimeType(upload.mimeType);
            img.setFormat(upload.format);
            img.setBytes((int) upload.bytes);
            img.setStorageProvider(upload.storageProvider);
            img.setProofDate(proofDate != null ? proofDate : LocalDate.now());
            img.setCaption(caption);

            return imageRepository.createImage(img);
        } catch (IOException e) {
            throw new AppException("Failed to store image: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public List<Image> listImages(User user, LocalDate date, Integer limit) {
        return imageRepository.listImages(user.getId(), date, limit);
    }

    public Map<String, Object> clearProofHistory(User user) {
        int count = imageRepository.deleteByUser(user.getId());
        return Map.of("success", true, "deletedCount", count);
    }

    public Map<String, Object> deleteImage(User user, UUID imageId) {
        int count = imageRepository.deleteByIdAndUser(imageId, user.getId());
        return Map.of("success", true, "deletedCount", count, "id", imageId.toString());
    }
}
