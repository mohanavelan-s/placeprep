package com.placeprep.service;

import com.placeprep.exception.AppException;
import com.placeprep.model.CoachGroup;
import com.placeprep.model.Task;
import com.placeprep.model.User;
import com.placeprep.repository.CoachGroupRepository;
import com.placeprep.repository.TaskRepository;
import com.placeprep.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Service
public class CoachService {

    private final CoachGroupRepository coachGroupRepository;
    private final UserRepository userRepository;
    private final TaskRepository taskRepository;
    private final JdbcTemplate jdbcTemplate;

    public CoachService(CoachGroupRepository coachGroupRepository, UserRepository userRepository, TaskRepository taskRepository, JdbcTemplate jdbcTemplate) {
        this.coachGroupRepository = coachGroupRepository;
        this.userRepository = userRepository;
        this.taskRepository = taskRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Map<String, Object>> listStudentsForAdmin(User adminUser) {
        String sql = """
            SELECT
                u.id, u.name, u.email, u.username, u.role, u.tier,
                u.current_streak AS "currentStreak",
                u.readiness_score AS "readinessScore",
                u.consistency_score AS "consistencyScore",
                u.solved_problems AS "solvedProblems",
                u.target_role AS "targetRole",
                u.created_at AS "createdAt",
                u.last_login_at AS "lastLoginAt",
                COALESCE(u.coach_metadata->>'accessTier', 'standard') AS "accessTier"
            FROM users u
            WHERE u.role = 'user'
            ORDER BY u.created_at DESC
        """;
        List<Map<String, Object>> studentUsers = jdbcTemplate.queryForList(sql);
        if (studentUsers.isEmpty()) {
            return List.of();
        }

        // Fetch task summary grouped by user_id and status
        String taskSummarySql = """
            SELECT user_id, status, count(*) as count
            FROM tasks
            GROUP BY user_id, status
        """;
        List<Map<String, Object>> taskCounts = jdbcTemplate.queryForList(taskSummarySql);
        Map<UUID, Map<String, Integer>> userTaskSummaryMap = new HashMap<>();
        for (Map<String, Object> tc : taskCounts) {
            UUID uId = (UUID) tc.get("user_id");
            String st = (String) tc.get("status");
            int c = ((Number) tc.get("count")).intValue();
            Map<String, Integer> map = userTaskSummaryMap.computeIfAbsent(uId, k -> new HashMap<>());
            map.put(st, c);
            map.put("total", map.getOrDefault("total", 0) + c);
        }

        // Fetch admin-shared tasks (practice capsules)
        String capsuleTasksSql = """
            SELECT id, user_id, title, description, category, status, reference_label, reference_url,
                   due_at, scheduled_for, created_at, metadata
            FROM tasks
            WHERE metadata->>'shareKind' IN ('admin-practice-link', 'admin-assignment')
            ORDER BY created_at DESC
        """;
        List<Map<String, Object>> capsuleTaskRows = jdbcTemplate.queryForList(capsuleTasksSql);
        Map<UUID, Map<String, Map<String, Object>>> userBundleMap = new HashMap<>();
        for (Map<String, Object> row : capsuleTaskRows) {
            UUID uId = (UUID) row.get("user_id");
            String metaStr = row.get("metadata") != null ? row.get("metadata").toString() : "{}";
            Map<String, Object> meta = com.placeprep.util.JsonUtil.toMap(metaStr);
            String bundleId = meta.containsKey("bundleId") && meta.get("bundleId") != null
                    ? meta.get("bundleId").toString()
                    : row.get("id").toString();

            Map<String, Map<String, Object>> bundles = userBundleMap.computeIfAbsent(uId, k -> new LinkedHashMap<>());
            Map<String, Object> bundle = bundles.computeIfAbsent(bundleId, k -> {
                Map<String, Object> b = new HashMap<>();
                b.put("bundleId", bundleId);
                b.put("title", meta.getOrDefault("bundleTitle", "Admin assignment bundle"));
                b.put("note", meta.get("bundleNote"));
                b.put("studentUserId", uId.toString());
                b.put("assignedById", meta.get("assignedByAdminId"));
                b.put("assignedByName", meta.get("assignedByAdminName"));
                b.put("assignmentId", meta.get("assignmentId"));
                b.put("dueAt", row.get("due_at") != null ? row.get("due_at").toString() : null);
                b.put("scheduledFor", row.get("scheduled_for") != null ? row.get("scheduled_for").toString() : null);
                b.put("createdAt", row.get("created_at") != null ? row.get("created_at").toString() : null);
                b.put("items", new ArrayList<Map<String, Object>>());
                return b;
            });

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = (List<Map<String, Object>>) bundle.get("items");
            Map<String, Object> item = new HashMap<>();
            item.put("taskId", row.get("id").toString());
            item.put("title", row.get("title"));
            item.put("description", row.get("description"));
            item.put("category", row.get("category"));
            item.put("status", row.get("status"));
            item.put("referenceLabel", row.get("reference_label"));
            item.put("referenceUrl", row.get("reference_url"));
            item.put("capsuleType", meta.getOrDefault("capsuleType", "resource"));
            item.put("dueAt", row.get("due_at") != null ? row.get("due_at").toString() : null);
            item.put("scheduledFor", row.get("scheduled_for") != null ? row.get("scheduled_for").toString() : null);
            item.put("createdAt", row.get("created_at") != null ? row.get("created_at").toString() : null);
            items.add(item);
        }

        Map<UUID, List<Map<String, Object>>> userCapsulesMap = new HashMap<>();
        for (Map.Entry<UUID, Map<String, Map<String, Object>>> e : userBundleMap.entrySet()) {
            userCapsulesMap.put(e.getKey(), new ArrayList<>(e.getValue().values()));
        }

        List<Map<String, Object>> records = new ArrayList<>();
        for (Map<String, Object> student : studentUsers) {
            UUID sId = (UUID) student.get("id");
            Map<String, Integer> tSummary = userTaskSummaryMap.getOrDefault(sId, Map.of());

            Map<String, Object> rec = new HashMap<>();
            rec.put("student", student);
            rec.put("invitedBy", Map.of(
                    "id", Optional.ofNullable(student.get("inviterId")).orElse(""),
                    "name", Optional.ofNullable(student.get("inviterName")).orElse(""),
                    "username", Optional.ofNullable(student.get("inviterUsername")).orElse(""),
                    "invitedAt", Optional.ofNullable(student.get("createdAt")).orElse("").toString()
            ));
            rec.put("progress", Map.of(
                    "streak", Optional.ofNullable(student.get("currentStreak")).orElse(0),
                    "consistencyScore", Optional.ofNullable(student.get("consistencyScore")).orElse(0),
                    "readinessScore", Optional.ofNullable(student.get("readinessScore")).orElse(0),
                    "solvedProblems", Optional.ofNullable(student.get("solvedProblems")).orElse(0),
                    "averageTimePerProblem", 0,
                    "failedAttempts", 0,
                    "totalHours", 0.0,
                    "tasksCompleted", tSummary.getOrDefault("completed", 0),
                    "weeklyProgress", List.of(),
                    "topicStrength", List.of()
            ));
            rec.put("taskSummary", Map.of(
                    "userId", sId.toString(),
                    "total", tSummary.getOrDefault("total", 0),
                    "pending", tSummary.getOrDefault("pending", 0),
                    "inProgress", tSummary.getOrDefault("in_progress", 0),
                    "completed", tSummary.getOrDefault("completed", 0),
                    "skipped", tSummary.getOrDefault("skipped", 0),
                    "overdue", 0
            ));
            rec.put("recentProofs", List.of());
            rec.put("progressHistory", List.of());
            rec.put("practiceCapsules", userCapsulesMap.getOrDefault(sId, List.of()));

            records.add(rec);
        }

        return records;
    }

    public List<CoachGroup> listGroupsForAdmin(User adminUser) {
        List<CoachGroup> groups = coachGroupRepository.listGroups();
        if (groups.isEmpty()) return groups;

        List<UUID> groupIds = groups.stream().map(CoachGroup::getId).toList();
        List<Map<String, Object>> allMembers = coachGroupRepository.listMembers(groupIds);

        Map<UUID, List<Map<String, Object>>> memberMap = new HashMap<>();
        for (Map<String, Object> m : allMembers) {
            UUID gId = (UUID) m.get("groupId");
            memberMap.computeIfAbsent(gId, k -> new ArrayList<>()).add(m);
        }

        for (CoachGroup g : groups) {
            List<Map<String, Object>> members = memberMap.getOrDefault(g.getId(), List.of());
            g.setMembers(members);
        }

        return groups;
    }

    public List<Map<String, Object>> listGroupCandidatesForAdmin(User adminUser) {
        String sql = """
            SELECT
                u.id, u.name, u.email, u.username, u.role, u.tier,
                u.current_streak AS "currentStreak",
                u.readiness_score AS "readinessScore",
                u.consistency_score AS "consistencyScore",
                u.solved_problems AS "solvedProblems",
                u.target_role AS "targetRole",
                u.created_at AS "createdAt",
                u.last_login_at AS "lastLoginAt",
                COALESCE(u.coach_metadata->>'accessTier', 'standard') AS "accessTier"
            FROM users u
            WHERE u.role = 'user'
            ORDER BY u.created_at DESC
        """;
        return jdbcTemplate.queryForList(sql);
    }

    @SuppressWarnings("unchecked")
    public CoachGroup createGroup(User adminUser, Map<String, Object> payload) {
        String name = (String) payload.get("name");
        if (name == null || name.trim().length() < 2) {
            throw new AppException("Group name is required.", HttpStatus.BAD_REQUEST);
        }

        if (coachGroupRepository.findGroupByNormalizedName(name).isPresent()) {
            throw new AppException("A group named " + name + " already exists. Use a unique group name.", HttpStatus.CONFLICT);
        }

        CoachGroup group = new CoachGroup();
        group.setName(name.trim());
        group.setDescription((String) payload.get("description"));
        group.setCreatedBy(adminUser.getId());

        CoachGroup created = coachGroupRepository.createGroup(group);

        List<String> rawIds = (List<String>) payload.get("studentUserIds");
        if (rawIds != null && !rawIds.isEmpty()) {
            List<UUID> userIds = rawIds.stream().map(UUID::fromString).toList();
            coachGroupRepository.addMembers(created.getId(), userIds, adminUser.getId());
        }

        return coachGroupRepository.findGroupById(created.getId()).orElse(created);
    }

    public CoachGroup addGroupMembers(User adminUser, UUID groupId, List<UUID> studentUserIds) {
        CoachGroup group = coachGroupRepository.findGroupById(groupId)
                .orElseThrow(() -> new AppException("Coach group not found.", HttpStatus.NOT_FOUND));

        coachGroupRepository.addMembers(groupId, studentUserIds, adminUser.getId());
        return coachGroupRepository.findGroupById(groupId).orElse(group);
    }

    public CoachGroup removeGroupMember(UUID groupId, UUID studentUserId) {
        CoachGroup group = coachGroupRepository.findGroupById(groupId)
                .orElseThrow(() -> new AppException("Coach group not found.", HttpStatus.NOT_FOUND));

        coachGroupRepository.removeMember(groupId, studentUserId);
        return coachGroupRepository.findGroupById(groupId).orElse(group);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> createPracticeCapsule(User adminUser, Map<String, Object> payload) {
        String studentIdStr = (String) payload.get("studentUserId");
        String groupIdStr = (String) payload.get("groupId");

        List<UUID> recipientIds = new ArrayList<>();
        if (studentIdStr != null && !studentIdStr.isBlank()) {
            recipientIds.add(UUID.fromString(studentIdStr));
        } else if (groupIdStr != null && !groupIdStr.isBlank()) {
            UUID gId = UUID.fromString(groupIdStr);
            List<Map<String, Object>> members = coachGroupRepository.listMembers(List.of(gId));
            for (Map<String, Object> m : members) {
                recipientIds.add((UUID) m.get("userId"));
            }
        } else {
            throw new AppException("Choose either one student or one group.", HttpStatus.BAD_REQUEST);
        }

        if (recipientIds.isEmpty()) {
            throw new AppException("No eligible recipients found for assignment.", HttpStatus.BAD_REQUEST);
        }

        String bundleId = UUID.randomUUID().toString();
        String title = (String) payload.getOrDefault("title", "Coach Practice Assignment");
        String note = (String) payload.get("note");
        List<Map<String, Object>> items = (List<Map<String, Object>>) payload.get("items");

        int tasksCreated = 0;
        for (UUID studentId : recipientIds) {
            if (items != null && !items.isEmpty()) {
                for (Map<String, Object> it : items) {
                    Task task = new Task();
                    task.setUserId(studentId);
                    task.setTitle((String) it.getOrDefault("title", title));
                    task.setDescription((String) it.getOrDefault("description", note));
                    task.setCategory((String) it.getOrDefault("category", "DSA"));
                    task.setSubcategory((String) it.get("subcategory"));
                    task.setReferenceUrl((String) it.get("referenceUrl"));
                    task.setReferenceLabel((String) it.get("referenceLabel"));
                    task.setScheduledFor(LocalDate.now());

                    Map<String, Object> meta = new HashMap<>();
                    meta.put("shareKind", "admin-assignment");
                    meta.put("bundleId", bundleId);
                    meta.put("assignedBy", adminUser.getName());
                    meta.put("assignedById", adminUser.getId().toString());
                    task.setMetadata(meta);

                    taskRepository.createTask(task);
                    tasksCreated++;
                }
            } else {
                // Fallback single task
                Task task = new Task();
                task.setUserId(studentId);
                task.setTitle(title);
                task.setDescription(note);
                task.setCategory("DSA");
                task.setScheduledFor(LocalDate.now());

                Map<String, Object> meta = new HashMap<>();
                meta.put("shareKind", "admin-assignment");
                meta.put("bundleId", bundleId);
                task.setMetadata(meta);

                taskRepository.createTask(task);
                tasksCreated++;
            }
        }

        return Map.of(
                "success", true,
                "bundleId", bundleId,
                "recipientsCount", recipientIds.size(),
                "tasksCreated", tasksCreated
        );
    }

    public Map<String, Object> clearStudentProofHistory(UUID studentUserId) {
        int deleted = jdbcTemplate.update("DELETE FROM images WHERE user_id = ?", studentUserId);
        return Map.of("success", true, "deletedCount", deleted);
    }

    public Map<String, Object> clearProgressHistory(User adminUser, Map<String, Object> payload) {
        String studentIdStr = (String) payload.get("studentUserId");
        if (studentIdStr != null && !studentIdStr.isBlank()) {
            UUID sId = UUID.fromString(studentIdStr);
            int deleted = jdbcTemplate.update("DELETE FROM progress_stats WHERE user_id = ?", sId);
            return Map.of("success", true, "deletedCount", deleted);
        }
        return Map.of("success", true, "deletedCount", 0);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> clearPracticeCapsuleHistory(User adminUser, Map<String, Object> payload) {
        List<String> assignmentIds = (List<String>) payload.get("assignmentIds");
        if (assignmentIds == null || assignmentIds.isEmpty()) {
            return Map.of("success", true, "deletedCount", 0);
        }

        int count = 0;
        for (String aId : assignmentIds) {
            count += jdbcTemplate.update(
                    "DELETE FROM tasks WHERE metadata->>'bundleId' = ? OR metadata->>'assignmentId' = ?",
                    aId, aId
            );
        }
        return Map.of("success", true, "deletedCount", count);
    }

    public Map<String, Object> removeStudent(User adminUser, UUID studentUserId) {
        jdbcTemplate.update("DELETE FROM coach_group_members WHERE user_id = ?", studentUserId);
        jdbcTemplate.update("DELETE FROM tasks WHERE user_id = ?", studentUserId);
        jdbcTemplate.update("DELETE FROM prep_plans WHERE user_id = ?", studentUserId);
        jdbcTemplate.update("DELETE FROM coding_submissions WHERE user_id = ?", studentUserId);
        jdbcTemplate.update("DELETE FROM assessment_sessions WHERE user_id = ?", studentUserId);
        jdbcTemplate.update("DELETE FROM images WHERE user_id = ?", studentUserId);
        jdbcTemplate.update("DELETE FROM progress_stats WHERE user_id = ?", studentUserId);
        jdbcTemplate.update("DELETE FROM user_profiles WHERE user_id = ?", studentUserId);
        int deleted = jdbcTemplate.update("DELETE FROM users WHERE id = ? AND role != 'admin'", studentUserId);

        return Map.of(
                "success", true,
                "deletedCount", deleted,
                "studentUserId", studentUserId.toString()
        );
    }

    public Map<String, Object> removeStudentsBulk(User adminUser, List<UUID> studentUserIds) {
        if (studentUserIds == null || studentUserIds.isEmpty()) {
            return Map.of("success", true, "deletedCount", 0, "studentUserIds", List.of());
        }

        int totalDeleted = 0;
        List<String> removedIds = new ArrayList<>();
        for (UUID sId : studentUserIds) {
            Map<String, Object> res = removeStudent(adminUser, sId);
            if (((Number) res.getOrDefault("deletedCount", 0)).intValue() > 0) {
                totalDeleted++;
                removedIds.add(sId.toString());
            }
        }

        return Map.of(
                "success", true,
                "deletedCount", totalDeleted,
                "studentUserIds", removedIds
        );
    }

    public Map<String, Object> deleteGroup(User adminUser, UUID groupId) {
        jdbcTemplate.update("DELETE FROM coach_group_members WHERE group_id = ?", groupId);
        int deleted = jdbcTemplate.update("DELETE FROM coach_groups WHERE id = ?", groupId);
        return Map.of(
                "success", true,
                "deletedCount", deleted,
                "groupId", groupId.toString()
        );
    }
}
