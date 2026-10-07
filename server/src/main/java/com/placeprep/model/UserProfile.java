package com.placeprep.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.OffsetDateTime;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class UserProfile {

    private UUID id;
    private UUID userId;
    private String linkedinUrl;
    private String githubUrl;
    private String leetcodeUrl;
    private String portfolioUrl;
    private String resumeUrl;
    private String avatarUrl;
    private boolean notificationsEnabled = true;
    private boolean notificationEmailEnabled = true;
    private boolean notificationBrowserEnabled = false;
    private String notificationBrowserPermission = "default";
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public UserProfile() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getLinkedinUrl() { return linkedinUrl; }
    public void setLinkedinUrl(String linkedinUrl) { this.linkedinUrl = linkedinUrl; }

    public String getGithubUrl() { return githubUrl; }
    public void setGithubUrl(String githubUrl) { this.githubUrl = githubUrl; }

    public String getLeetcodeUrl() { return leetcodeUrl; }
    public void setLeetcodeUrl(String leetcodeUrl) { this.leetcodeUrl = leetcodeUrl; }

    public String getPortfolioUrl() { return portfolioUrl; }
    public void setPortfolioUrl(String portfolioUrl) { this.portfolioUrl = portfolioUrl; }

    public String getResumeUrl() { return resumeUrl; }
    public void setResumeUrl(String resumeUrl) { this.resumeUrl = resumeUrl; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public boolean isNotificationsEnabled() { return notificationsEnabled; }
    public void setNotificationsEnabled(boolean notificationsEnabled) { this.notificationsEnabled = notificationsEnabled; }

    public boolean isNotificationEmailEnabled() { return notificationEmailEnabled; }
    public void setNotificationEmailEnabled(boolean notificationEmailEnabled) { this.notificationEmailEnabled = notificationEmailEnabled; }

    public boolean isNotificationBrowserEnabled() { return notificationBrowserEnabled; }
    public void setNotificationBrowserEnabled(boolean notificationBrowserEnabled) { this.notificationBrowserEnabled = notificationBrowserEnabled; }

    public String getNotificationBrowserPermission() { return notificationBrowserPermission; }
    public void setNotificationBrowserPermission(String notificationBrowserPermission) { this.notificationBrowserPermission = notificationBrowserPermission; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
