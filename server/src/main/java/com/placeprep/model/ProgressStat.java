package com.placeprep.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ProgressStat {

    private UUID id;
    private UUID userId;
    private LocalDate statDate;
    private int streak = 0;
    private int bonusStreak = 0;
    private double consistencyScore = 0.0;
    private double readinessScore = 0.0;
    private double executionRate = 0.0;
    private double totalHours = 0.0;
    private int tasksCompleted = 0;
    private int powerPocketMinutes = 0;
    private Map<String, Object> metadata = new HashMap<>();
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public ProgressStat() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public LocalDate getStatDate() { return statDate; }
    public void setStatDate(LocalDate statDate) { this.statDate = statDate; }

    public int getStreak() { return streak; }
    public void setStreak(int streak) { this.streak = streak; }

    public int getBonusStreak() { return bonusStreak; }
    public void setBonusStreak(int bonusStreak) { this.bonusStreak = bonusStreak; }

    public double getConsistencyScore() { return consistencyScore; }
    public void setConsistencyScore(double consistencyScore) { this.consistencyScore = consistencyScore; }

    public double getReadinessScore() { return readinessScore; }
    public void setReadinessScore(double readinessScore) { this.readinessScore = readinessScore; }

    public double getExecutionRate() { return executionRate; }
    public void setExecutionRate(double executionRate) { this.executionRate = executionRate; }

    public double getTotalHours() { return totalHours; }
    public void setTotalHours(double totalHours) { this.totalHours = totalHours; }

    public int getTasksCompleted() { return tasksCompleted; }
    public void setTasksCompleted(int tasksCompleted) { this.tasksCompleted = tasksCompleted; }

    public int getPowerPocketMinutes() { return powerPocketMinutes; }
    public void setPowerPocketMinutes(int powerPocketMinutes) { this.powerPocketMinutes = powerPocketMinutes; }

    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata != null ? metadata : new HashMap<>(); }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
