package com.placeprep.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class User {

    private UUID id;
    private String name;
    private String username;
    private String role = "user";
    private String email;

    @JsonIgnore
    private String passwordHash;

    private List<String> weakAreas = new ArrayList<>();
    private List<String> strongTopics = new ArrayList<>();
    private String targetRole;
    private LocalDate placementDate;
    private String timezone = "Asia/Calcutta";
    private int solvedProblems = 0;
    private double averageTimePerProblem = 0.0;
    private int failedAttempts = 0;
    private int mistakeCount = 0;
    private double consistencyScore = 0.0;
    private int currentStreak = 0;
    private double readinessScore = 0.0;
    private String tier = "free";
    private int planGenerations = 0;
    private int mentorMessages = 0;
    private String preferredLanguage = "english";
    private String accessTier = "standard";
    private Map<String, Object> coachMetadata = new HashMap<>();
    private OffsetDateTime lastLoginAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public User() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public List<String> getWeakAreas() { return weakAreas; }
    public void setWeakAreas(List<String> weakAreas) { this.weakAreas = weakAreas != null ? weakAreas : new ArrayList<>(); }

    public List<String> getStrongTopics() { return strongTopics; }
    public void setStrongTopics(List<String> strongTopics) { this.strongTopics = strongTopics != null ? strongTopics : new ArrayList<>(); }

    public String getTargetRole() { return targetRole; }
    public void setTargetRole(String targetRole) { this.targetRole = targetRole; }

    public LocalDate getPlacementDate() { return placementDate; }
    public void setPlacementDate(LocalDate placementDate) { this.placementDate = placementDate; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public int getSolvedProblems() { return solvedProblems; }
    public void setSolvedProblems(int solvedProblems) { this.solvedProblems = solvedProblems; }

    public double getAverageTimePerProblem() { return averageTimePerProblem; }
    public void setAverageTimePerProblem(double averageTimePerProblem) { this.averageTimePerProblem = averageTimePerProblem; }

    public int getFailedAttempts() { return failedAttempts; }
    public void setFailedAttempts(int failedAttempts) { this.failedAttempts = failedAttempts; }

    public int getMistakeCount() { return mistakeCount; }
    public void setMistakeCount(int mistakeCount) { this.mistakeCount = mistakeCount; }

    public double getConsistencyScore() { return consistencyScore; }
    public void setConsistencyScore(double consistencyScore) { this.consistencyScore = consistencyScore; }

    public int getCurrentStreak() { return currentStreak; }
    public void setCurrentStreak(int currentStreak) { this.currentStreak = currentStreak; }

    public double getReadinessScore() { return readinessScore; }
    public void setReadinessScore(double readinessScore) { this.readinessScore = readinessScore; }

    public String getTier() { return tier; }
    public void setTier(String tier) { this.tier = tier; }

    public int getPlanGenerations() { return planGenerations; }
    public void setPlanGenerations(int planGenerations) { this.planGenerations = planGenerations; }

    public int getMentorMessages() { return mentorMessages; }
    public void setMentorMessages(int mentorMessages) { this.mentorMessages = mentorMessages; }

    public String getPreferredLanguage() { return preferredLanguage; }
    public void setPreferredLanguage(String preferredLanguage) { this.preferredLanguage = preferredLanguage; }

    public String getAccessTier() { return accessTier; }
    public void setAccessTier(String accessTier) { this.accessTier = accessTier; }

    public Map<String, Object> getCoachMetadata() { return coachMetadata; }
    public void setCoachMetadata(Map<String, Object> coachMetadata) { this.coachMetadata = coachMetadata != null ? coachMetadata : new HashMap<>(); }

    public OffsetDateTime getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(OffsetDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
