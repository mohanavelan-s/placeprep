package com.placeprep.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class Image {

    private UUID id;
    private UUID userId;
    private UUID taskId;
    private UUID dailyLogId;
    private String secureUrl;
    private String publicId;
    private String assetId;
    private String mimeType;
    private String format;
    private Integer bytes = 0;
    private Integer width;
    private Integer height;
    private String storageProvider = "local";
    private LocalDate proofDate;
    private String caption;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public Image() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public UUID getTaskId() { return taskId; }
    public void setTaskId(UUID taskId) { this.taskId = taskId; }

    public UUID getDailyLogId() { return dailyLogId; }
    public void setDailyLogId(UUID dailyLogId) { this.dailyLogId = dailyLogId; }

    public String getSecureUrl() { return secureUrl; }
    public void setSecureUrl(String secureUrl) { this.secureUrl = secureUrl; }

    public String getPublicId() { return publicId; }
    public void setPublicId(String publicId) { this.publicId = publicId; }

    public String getAssetId() { return assetId; }
    public void setAssetId(String assetId) { this.assetId = assetId; }

    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }

    public String getFormat() { return format; }
    public void setFormat(String format) { this.format = format; }

    public Integer getBytes() { return bytes; }
    public void setBytes(Integer bytes) { this.bytes = bytes != null ? bytes : 0; }

    public Integer getWidth() { return width; }
    public void setWidth(Integer width) { this.width = width; }

    public Integer getHeight() { return height; }
    public void setHeight(Integer height) { this.height = height; }

    public String getStorageProvider() { return storageProvider; }
    public void setStorageProvider(String storageProvider) { this.storageProvider = storageProvider; }

    public LocalDate getProofDate() { return proofDate; }
    public void setProofDate(LocalDate proofDate) { this.proofDate = proofDate; }

    public String getCaption() { return caption; }
    public void setCaption(String caption) { this.caption = caption; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
