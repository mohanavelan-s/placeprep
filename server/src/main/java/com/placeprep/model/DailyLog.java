package com.placeprep.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class DailyLog {

    private UUID id;
    private UUID userId;
    private LocalDate logDate;
    private String summary;
    private String wins;
    private String blockers;
    private Integer mood;
    private Integer energy;
    private Integer productivityScore = 0;
    private Integer focusMinutes = 0;
    private Double hoursStudied = 0.0;
    private Integer tasksCompletedCount = 0;
    private String notes;
    private String improvementPlan;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public DailyLog() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public LocalDate getLogDate() { return logDate; }
    public void setLogDate(LocalDate logDate) { this.logDate = logDate; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public String getWins() { return wins; }
    public void setWins(String wins) { this.wins = wins; }

    public String getBlockers() { return blockers; }
    public void setBlockers(String blockers) { this.blockers = blockers; }

    public Integer getMood() { return mood; }
    public void setMood(Integer mood) { this.mood = mood; }

    public Integer getEnergy() { return energy; }
    public void setEnergy(Integer energy) { this.energy = energy; }

    public Integer getProductivityScore() { return productivityScore; }
    public void setProductivityScore(Integer productivityScore) { this.productivityScore = productivityScore != null ? productivityScore : 0; }

    public Integer getFocusMinutes() { return focusMinutes; }
    public void setFocusMinutes(Integer focusMinutes) { this.focusMinutes = focusMinutes != null ? focusMinutes : 0; }

    public Double getHoursStudied() { return hoursStudied; }
    public void setHoursStudied(Double hoursStudied) { this.hoursStudied = hoursStudied != null ? hoursStudied : 0.0; }

    public Integer getTasksCompletedCount() { return tasksCompletedCount; }
    public void setTasksCompletedCount(Integer tasksCompletedCount) { this.tasksCompletedCount = tasksCompletedCount != null ? tasksCompletedCount : 0; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getImprovementPlan() { return improvementPlan; }
    public void setImprovementPlan(String improvementPlan) { this.improvementPlan = improvementPlan; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
