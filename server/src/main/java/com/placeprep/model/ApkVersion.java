package com.placeprep.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApkVersion {

    private UUID id;
    private String version;
    private String fileName;
    private String fileUrl;
    private String downloadPath;
    private String publicId;
    private String mimeType = "application/vnd.android.package-archive";
    private Integer bytes = 0;
    private String storageProvider = "local";
    private UUID uploadedBy;
    private Boolean isActive = true;
    private Map<String, Object> metadata = new HashMap<>();
    private OffsetDateTime uploadedAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public ApkVersion() {}

    public UUID getId() { return id; }
    public void setId(UUID id) {
        this.id = id;
        if (id != null) {
            this.downloadPath = "/api/apk/" + id + "/download";
        }
    }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }

    public String getDownloadPath() { return downloadPath; }
    public void setDownloadPath(String downloadPath) { this.downloadPath = downloadPath; }

    public String getPublicId() { return publicId; }
    public void setPublicId(String publicId) { this.publicId = publicId; }

    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }

    public Integer getBytes() { return bytes; }
    public void setBytes(Integer bytes) { this.bytes = bytes != null ? bytes : 0; }

    public String getStorageProvider() { return storageProvider; }
    public void setStorageProvider(String storageProvider) { this.storageProvider = storageProvider; }

    public UUID getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(UUID uploadedBy) { this.uploadedBy = uploadedBy; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata != null ? metadata : new HashMap<>(); }

    public OffsetDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(OffsetDateTime uploadedAt) { this.uploadedAt = uploadedAt; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
