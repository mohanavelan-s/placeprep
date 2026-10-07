package com.placeprep.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.OffsetDateTime;
import java.util.*;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class Notification {

    private UUID id;
    private UUID userId;
    private String type;
    private String message;
    private OffsetDateTime sentAt;
    private Boolean read = false;
    private OffsetDateTime readAt;
    private List<String> deliveryChannels = new ArrayList<>();
    private Map<String, Object> metadata = new HashMap<>();
    private String dedupeKey;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public Notification() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public OffsetDateTime getSentAt() { return sentAt; }
    public void setSentAt(OffsetDateTime sentAt) { this.sentAt = sentAt; }

    public Boolean getRead() { return read; }
    public void setRead(Boolean read) { this.read = read; }

    public OffsetDateTime getReadAt() { return readAt; }
    public void setReadAt(OffsetDateTime readAt) { this.readAt = readAt; }

    public List<String> getDeliveryChannels() { return deliveryChannels; }
    public void setDeliveryChannels(List<String> deliveryChannels) { this.deliveryChannels = deliveryChannels != null ? deliveryChannels : new ArrayList<>(); }

    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata != null ? metadata : new HashMap<>(); }

    public String getDedupeKey() { return dedupeKey; }
    public void setDedupeKey(String dedupeKey) { this.dedupeKey = dedupeKey; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
