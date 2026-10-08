package com.placeprep.config;

import com.placeprep.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;

@Configuration
public class NotificationSchedulerConfig implements SchedulingConfigurer {

    private static final Logger log = LoggerFactory.getLogger(NotificationSchedulerConfig.class);

    private final NotificationService notificationService;

    @Value("${placeprep.notification.scheduler-enabled:true}")
    private boolean schedulerEnabled;

    @Value("${placeprep.notification.cron:0 0 8 * * *}")
    private String rawCron;

    public NotificationSchedulerConfig(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @Override
    public void configureTasks(ScheduledTaskRegistrar taskRegistrar) {
        if (!schedulerEnabled) {
            log.info("[notifications] Notification scheduler is disabled (placeprep.notification.scheduler-enabled=false).");
            return;
        }

        String normalized = normalizeCron(rawCron);
        log.info("[notifications] Scheduling daily notification sweep with cron: '{}' (configured raw: '{}')", normalized, rawCron);
        try {
            taskRegistrar.addCronTask(notificationService::runDailySweep, normalized);
        } catch (Exception e) {
            log.error("[notifications] Failed to schedule with cron '{}': {}. Falling back to default '0 0 8 * * *'", normalized, e.getMessage());
            taskRegistrar.addCronTask(notificationService::runDailySweep, "0 0 8 * * *");
        }
    }

    public static String normalizeCron(String cron) {
        if (cron == null || cron.trim().isEmpty()) {
            return "0 0 8 * * *";
        }
        String trimmed = cron.trim();
        String[] parts = trimmed.split("\\s+");
        if (parts.length == 5) {
            // Standard 5-field UNIX cron (min hour dom mon dow) -> convert to 6-field Spring cron (sec min hour dom mon dow)
            return "0 " + trimmed;
        }
        if (parts.length == 6) {
            return trimmed;
        }
        return "0 0 8 * * *";
    }
}
