package com.placeprep.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.UUID;

@Service
public class StorageService {

    private static final Logger logger = LoggerFactory.getLogger(StorageService.class);

    @Value("${placeprep.app.upload-dir:${app.upload.dir:uploads}}")
    private String uploadDir;

    @Value("${placeprep.cloudinary.cloud-name:}")
    private String cloudinaryCloudName;

    @Value("${placeprep.cloudinary.api-key:}")
    private String cloudinaryApiKey;

    @Value("${placeprep.cloudinary.api-secret:}")
    private String cloudinaryApiSecret;

    private final RestTemplate restTemplate = new RestTemplate();

    public static class UploadResult {
        public String secureUrl;
        public String publicId;
        public String storageProvider = "local";
        public long bytes;
        public String format;
        public String originalName;
        public String mimeType;

        public UploadResult(String secureUrl, String publicId, String storageProvider, long bytes, String format, String originalName, String mimeType) {
            this.secureUrl = secureUrl;
            this.publicId = publicId;
            this.storageProvider = storageProvider;
            this.bytes = bytes;
            this.format = format;
            this.originalName = originalName;
            this.mimeType = mimeType;
        }
    }

    public boolean isCloudinaryConfigured() {
        return cloudinaryCloudName != null && !cloudinaryCloudName.trim().isEmpty()
                && cloudinaryApiKey != null && !cloudinaryApiKey.trim().isEmpty()
                && cloudinaryApiSecret != null && !cloudinaryApiSecret.trim().isEmpty();
    }

    public UploadResult upload(MultipartFile file, String folder) throws IOException {
        if (isCloudinaryConfigured()) {
            try {
                return uploadToCloudinary(file, folder);
            } catch (Exception e) {
                logger.warn("[StorageService] Cloudinary upload failed ({}). Falling back to local storage.", e.getMessage());
                return uploadToLocal(file, folder);
            }
        }
        return uploadToLocal(file, folder);
    }

    private UploadResult uploadToCloudinary(MultipartFile file, String folder) throws IOException {
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String ext = "";
        int dot = originalName.lastIndexOf('.');
        if (dot >= 0) {
            ext = originalName.substring(dot + 1).toLowerCase();
        }

        boolean isApk = "apk".equalsIgnoreCase(ext) || (folder != null && folder.toLowerCase().contains("apk"));
        String resourceType = isApk ? "raw" : "auto";
        final String uploadFilename = isApk ? (originalName.replaceAll("(?i)\\.apk$", "") + ".bin") : originalName;

        long timestamp = System.currentTimeMillis() / 1000;
        String cleanFolder = folder != null && !folder.isBlank() ? folder.trim() : "general";

        // Cloudinary signed upload: alphabetical order of params to sign: folder, timestamp
        String toSign = "folder=" + cleanFolder + "&timestamp=" + timestamp + cloudinaryApiSecret.trim();
        String signature = sha1Hex(toSign);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() {
                return uploadFilename;
            }
        });
        body.add("api_key", cloudinaryApiKey.trim());
        body.add("timestamp", String.valueOf(timestamp));
        body.add("folder", cleanFolder);
        body.add("signature", signature);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        String uploadUrl = "https://api.cloudinary.com/v1_1/" + cloudinaryCloudName.trim() + "/" + resourceType + "/upload";
        ResponseEntity<Map> response = restTemplate.postForEntity(uploadUrl, requestEntity, Map.class);
        Map<?, ?> respBody = response.getBody();

        if (respBody == null) {
            throw new IOException("Empty response from Cloudinary API");
        }

        String secureUrl = (String) respBody.get("secure_url");
        String publicId = (String) respBody.get("public_id");
        String format = respBody.get("format") != null ? respBody.get("format").toString() : ext;
        long bytes = respBody.get("bytes") instanceof Number n ? n.longValue() : file.getSize();

        logger.info("[StorageService] Successfully uploaded to Cloudinary: publicId={}", publicId);

        return new UploadResult(
                secureUrl,
                publicId,
                "cloudinary",
                bytes,
                format,
                originalName,
                isApk ? "application/vnd.android.package-archive" : file.getContentType()
        );
    }

    private UploadResult uploadToLocal(MultipartFile file, String folder) throws IOException {
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String ext = "";
        int dot = originalName.lastIndexOf('.');
        if (dot >= 0) {
            ext = originalName.substring(dot);
        }

        Path targetDir = Paths.get(uploadDir, folder).toAbsolutePath();
        if (!Files.exists(targetDir)) {
            Files.createDirectories(targetDir);
        }

        String fileName = System.currentTimeMillis() + "-" + UUID.randomUUID() + ext;
        Path targetPath = targetDir.resolve(fileName);
        try (var inputStream = file.getInputStream()) {
            Files.copy(inputStream, targetPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }

        String relativePath = folder + "/" + fileName;
        String secureUrl = "/uploads/" + relativePath;
        String publicId = "local:" + relativePath;

        return new UploadResult(
                secureUrl,
                publicId,
                "local",
                file.getSize(),
                ext.replace(".", ""),
                originalName,
                file.getContentType()
        );
    }

    public Path resolveLocalPath(String fileUrlOrPublicId) {
        if (fileUrlOrPublicId == null || fileUrlOrPublicId.isBlank()) {
            return null;
        }
        String clean = fileUrlOrPublicId.trim();
        if (clean.startsWith("/uploads/")) {
            clean = clean.substring("/uploads/".length());
        } else if (clean.startsWith("local:")) {
            clean = clean.substring("local:".length());
        }
        return Paths.get(uploadDir, clean).toAbsolutePath();
    }

    private static String sha1Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-1 algorithm not available", e);
        }
    }
}
