package com.placeprep.service;

import com.placeprep.exception.AppException;
import com.placeprep.model.DailyLog;
import com.placeprep.model.User;
import com.placeprep.repository.DailyLogRepository;
import com.placeprep.repository.TaskRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class LogService {

    private final DailyLogRepository dailyLogRepository;
    private final TaskRepository taskRepository;
    private final ProgressService progressService;

    public LogService(DailyLogRepository dailyLogRepository, TaskRepository taskRepository, ProgressService progressService) {
        this.dailyLogRepository = dailyLogRepository;
        this.taskRepository = taskRepository;
        this.progressService = progressService;
    }

    public DailyLog upsertLog(User user, DailyLog payload) {
        LocalDate logDate = payload.getLogDate();
        if (logDate == null) {
            String tz = user.getTimezone() != null && !user.getTimezone().isBlank() ? user.getTimezone() : "Asia/Calcutta";
            logDate = LocalDate.now(ZoneId.of(tz));
            payload.setLogDate(logDate);
        }

        if (payload.getTasksCompletedCount() == null || payload.getTasksCompletedCount() == 0) {
            int count = (int) taskRepository.listTasks(user.getId(), logDate.toString(), null, null, null)
                    .stream()
                    .filter(t -> "completed".equalsIgnoreCase(t.getStatus()))
                    .count();
            payload.setTasksCompletedCount(count);
        }

        payload.setUserId(user.getId());
        DailyLog saved = dailyLogRepository.upsertLog(payload);

        progressService.refreshProgressStats(user.getId(), user.getTimezone());
        return saved;
    }

    public List<DailyLog> listLogs(User user, LocalDate date, LocalDate from, LocalDate to, Integer limit) {
        return dailyLogRepository.listLogs(user.getId(), date, from, to, limit);
    }

    public Optional<DailyLog> findLogByDate(User user, LocalDate logDate) {
        if (logDate == null) {
            String tz = user.getTimezone() != null && !user.getTimezone().isBlank() ? user.getTimezone() : "Asia/Calcutta";
            logDate = LocalDate.now(ZoneId.of(tz));
        }

        return dailyLogRepository.findByDate(user.getId(), logDate);
    }

    public DailyLog getLogByDate(User user, LocalDate logDate) {
        return findLogByDate(user, logDate)
                .orElseThrow(() -> new AppException("Daily log not found.", HttpStatus.NOT_FOUND));
    }

    public DailyLog deleteLog(User user, UUID logId) {
        DailyLog deleted = dailyLogRepository.deleteLog(logId, user.getId())
                .orElseThrow(() -> new AppException("Daily log not found.", HttpStatus.NOT_FOUND));

        progressService.refreshProgressStats(user.getId(), user.getTimezone());
        return deleted;
    }
}
