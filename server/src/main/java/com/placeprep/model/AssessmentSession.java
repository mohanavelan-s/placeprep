package com.placeprep.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.OffsetDateTime;
import java.util.*;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class AssessmentSession {

    private UUID id;
    private UUID userId;
    private UUID planId;
    private String status = "draft";
    private String assessmentType = "mcq";
    private Integer durationMinutes = 20;
    private List<String> weakSpots = new ArrayList<>();
    private List<Map<String, Object>> recommendations = new ArrayList<>();
    private List<Map<String, Object>> questions = new ArrayList<>();
    private Map<String, Object> submission = new HashMap<>();
    private Double score = 0.0;
    private Map<String, Object> metadata = new HashMap<>();
    private OffsetDateTime startedAt;
    private OffsetDateTime submittedAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public AssessmentSession() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public UUID getPlanId() { return planId; }
    public void setPlanId(UUID planId) { this.planId = planId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getAssessmentType() { return assessmentType; }
    public void setAssessmentType(String assessmentType) { this.assessmentType = assessmentType; }

    public Integer getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes != null ? durationMinutes : 20; }

    public List<String> getWeakSpots() { return weakSpots; }
    public void setWeakSpots(List<String> weakSpots) { this.weakSpots = weakSpots != null ? weakSpots : new ArrayList<>(); }

    public List<Map<String, Object>> getRecommendations() { return recommendations; }
    public void setRecommendations(List<Map<String, Object>> recommendations) { this.recommendations = recommendations != null ? recommendations : new ArrayList<>(); }

    public List<Map<String, Object>> getQuestions() { return questions; }
    public void setQuestions(List<Map<String, Object>> questions) { this.questions = questions != null ? questions : new ArrayList<>(); }

    public Map<String, Object> getSubmission() { return submission; }
    public void setSubmission(Map<String, Object> submission) { this.submission = submission != null ? submission : new HashMap<>(); }

    public Double getScore() { return score; }
    public void setScore(Double score) { this.score = score != null ? score : 0.0; }

    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata != null ? metadata : new HashMap<>(); }

    public OffsetDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(OffsetDateTime startedAt) { this.startedAt = startedAt; }

    public OffsetDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(OffsetDateTime submittedAt) { this.submittedAt = submittedAt; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
