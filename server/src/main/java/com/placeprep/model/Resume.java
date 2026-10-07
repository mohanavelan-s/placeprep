package com.placeprep.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.OffsetDateTime;
import java.util.*;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class Resume {

    private UUID id;
    private UUID userId;
    private String fileName;
    private String mimeType;
    private String secureUrl;
    private String publicId;
    private String storageProvider = "local";
    private Integer sizeBytes = 0;
    private String extractedText;
    private String analysisSummary;
    private Integer score = 0;
    private List<String> strengths = new ArrayList<>();
    private List<String> improvements = new ArrayList<>();
    private List<String> keywords = new ArrayList<>();
    private Map<String, Object> sections = new HashMap<>();
    private Boolean isActive = true;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public Resume() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }

    public String getSecureUrl() { return secureUrl; }
    public void setSecureUrl(String secureUrl) { this.secureUrl = secureUrl; }

    public String getPublicId() { return publicId; }
    public void setPublicId(String publicId) { this.publicId = publicId; }

    public String getStorageProvider() { return storageProvider; }
    public void setStorageProvider(String storageProvider) { this.storageProvider = storageProvider; }

    public Integer getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(Integer sizeBytes) { this.sizeBytes = sizeBytes != null ? sizeBytes : 0; }

    public String getExtractedText() { return extractedText; }
    public void setExtractedText(String extractedText) { this.extractedText = extractedText; }

    public String getAnalysisSummary() { return analysisSummary; }
    public void setAnalysisSummary(String analysisSummary) { this.analysisSummary = analysisSummary; }

    public Integer getScore() { return score; }
    public void setScore(Integer score) { this.score = score != null ? score : 0; }

    public List<String> getStrengths() { return strengths; }
    public void setStrengths(List<String> strengths) { this.strengths = strengths != null ? strengths : new ArrayList<>(); }

    public List<String> getImprovements() { return improvements; }
    public void setImprovements(List<String> improvements) { this.improvements = improvements != null ? improvements : new ArrayList<>(); }

    public List<String> getKeywords() { return keywords; }
    public void setKeywords(List<String> keywords) { this.keywords = keywords != null ? keywords : new ArrayList<>(); }

    public Map<String, Object> getSections() { return sections; }
    public void setSections(Map<String, Object> sections) { this.sections = sections != null ? sections : new HashMap<>(); }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
