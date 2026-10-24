package com.placeprep;

import com.placeprep.exception.AppException;
import com.placeprep.model.CoachGroup;
import com.placeprep.model.Task;
import com.placeprep.model.User;
import com.placeprep.repository.CoachGroupRepository;
import com.placeprep.repository.TaskRepository;
import com.placeprep.repository.UserRepository;
import com.placeprep.service.CoachService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.SQLException;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class CoachStudentRemovalTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private CoachService coachService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private CoachGroupRepository coachGroupRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private User adminUser;
    private User regularUser;
    private final List<UUID> createdUserIds = new ArrayList<>();

    @BeforeEach
    void setup() throws SQLException {
        assertSafeActiveConnection(jdbcTemplate.getDataSource());

        adminUser = createSyntheticUser("Test Admin", "removal_admin@placeprep.test", "admin");
        regularUser = createSyntheticUser("Regular NonAdmin", "regular_non_admin@placeprep.test", "user");
    }

    @AfterEach
    void tearDown() {
        try {
            jdbcTemplate.execute("DROP TABLE IF EXISTS test_removal_constraint_blocker");
        } catch (Exception ignored) {}
        for (UUID uid : createdUserIds) {
            try {
                jdbcTemplate.update("UPDATE invites SET created_by = NULL WHERE created_by = ?", uid);
                jdbcTemplate.update("UPDATE invites SET used_by = NULL WHERE used_by = ?", uid);
                jdbcTemplate.update("UPDATE coach_groups SET created_by = NULL WHERE created_by = ?", uid);
                jdbcTemplate.update("UPDATE coach_group_members SET added_by = NULL WHERE added_by = ?", uid);
                jdbcTemplate.update("DELETE FROM coach_group_members WHERE user_id = ?", uid);
                jdbcTemplate.update("DELETE FROM tasks WHERE user_id = ?", uid);
                jdbcTemplate.update("DELETE FROM prep_plans WHERE user_id = ?", uid);
                jdbcTemplate.update("DELETE FROM coding_submissions WHERE user_id = ?", uid);
                jdbcTemplate.update("DELETE FROM assessment_sessions WHERE user_id = ?", uid);
                jdbcTemplate.update("DELETE FROM progress_stats WHERE user_id = ?", uid);
                jdbcTemplate.update("DELETE FROM user_profiles WHERE user_id = ?", uid);
                jdbcTemplate.update("DELETE FROM notifications WHERE user_id = ?", uid);
                jdbcTemplate.update("DELETE FROM users WHERE id = ?", uid);
            } catch (Exception ignored) {}
        }
        createdUserIds.clear();
    }

    private User createSyntheticUser(String name, String email, String role) {
        jdbcTemplate.update("DELETE FROM users WHERE email = ?", email);
        User u = new User();
        u.setName(name);
        u.setUsername(email.split("@")[0]);
        u.setEmail(email);
        u.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz1234567890");
        u.setRole(role);
        User created = userRepository.createUser(u);
        createdUserIds.add(created.getId());
        return created;
    }

    @Test
    @DisplayName("Single user removal: Admin removes regular student, cascades tasks and returns deleted count 1")
    void testSingleUserRemovalSuccessful() {
        User student = createSyntheticUser("Alice Student", "alice_removal@placeprep.test", "user");

        Task t = new Task();
        t.setUserId(student.getId());
        t.setTitle("Alice Task");
        t.setCategory("DSA");
        t.setScheduledFor(LocalDate.now());
        taskRepository.createTask(t);

        Map<String, Object> result = coachService.removeStudent(adminUser, student.getId());
        assertTrue(Boolean.TRUE.equals(result.get("success")));
        assertEquals(1, ((Number) result.get("deletedCount")).intValue());
        assertEquals(student.getId().toString(), result.get("studentUserId"));

        // Verify user and task no longer exist
        assertTrue(userRepository.findById(student.getId()).isEmpty());
        assertTrue(taskRepository.listTasks(student.getId(), "today", null, null, null).isEmpty());
    }

    @Test
    @DisplayName("Bulk removal: Admin removes multiple students in a single transaction, returns all deleted IDs")
    void testBulkUserRemovalSuccessful() {
        User student1 = createSyntheticUser("Student One", "student1_bulk@placeprep.test", "user");
        User student2 = createSyntheticUser("Student Two", "student2_bulk@placeprep.test", "user");
        User student3 = createSyntheticUser("Student Three", "student3_bulk@placeprep.test", "user");

        List<UUID> toRemove = List.of(student1.getId(), student2.getId(), student3.getId());
        Map<String, Object> result = coachService.removeStudentsBulk(adminUser, toRemove);

        assertTrue(Boolean.TRUE.equals(result.get("success")));
        assertEquals(3, ((Number) result.get("deletedCount")).intValue());

        List<?> removedIds = (List<?>) result.get("studentUserIds");
        assertEquals(3, removedIds.size());
        assertTrue(removedIds.contains(student1.getId().toString()));
        assertTrue(removedIds.contains(student2.getId().toString()));
        assertTrue(removedIds.contains(student3.getId().toString()));

        // Verify all 3 are deleted from database
        assertTrue(userRepository.findById(student1.getId()).isEmpty());
        assertTrue(userRepository.findById(student2.getId()).isEmpty());
        assertTrue(userRepository.findById(student3.getId()).isEmpty());
    }

    @Test
    @DisplayName("Authorization check: Non-admin user cannot remove students and receives 403 Forbidden")
    void testUnauthorizedUserCannotRemoveStudent() {
        User student = createSyntheticUser("Target Student", "target_unauth@placeprep.test", "user");

        AppException ex = assertThrows(AppException.class, () ->
                coachService.removeStudent(regularUser, student.getId())
        );
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());

        AppException exBulk = assertThrows(AppException.class, () ->
                coachService.removeStudentsBulk(regularUser, List.of(student.getId()))
        );
        assertEquals(HttpStatus.FORBIDDEN, exBulk.getStatus());

        // Target student is preserved
        assertTrue(userRepository.findById(student.getId()).isPresent());
    }

    @Test
    @DisplayName("Self protection: Admin cannot delete their own account, throws 400 Bad Request")
    void testAdminCannotRemoveSelf() {
        AppException ex = assertThrows(AppException.class, () ->
                coachService.removeStudent(adminUser, adminUser.getId())
        );
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().toLowerCase().contains("own administrator account"));

        AppException exBulk = assertThrows(AppException.class, () ->
                coachService.removeStudentsBulk(adminUser, List.of(adminUser.getId()))
        );
        assertEquals(HttpStatus.BAD_REQUEST, exBulk.getStatus());

        // Admin account preserved
        assertTrue(userRepository.findById(adminUser.getId()).isPresent());
    }

    @Test
    @DisplayName("Admin protection: Attempt to delete another admin in single or bulk removal is rejected")
    void testAdminCannotRemoveOtherAdmin() {
        User otherAdmin = createSyntheticUser("Other Admin", "other_admin@placeprep.test", "admin");

        AppException ex = assertThrows(AppException.class, () ->
                coachService.removeStudent(adminUser, otherAdmin.getId())
        );
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().toLowerCase().contains("administrator account"));

        AppException exBulk = assertThrows(AppException.class, () ->
                coachService.removeStudentsBulk(adminUser, List.of(otherAdmin.getId()))
        );
        assertEquals(HttpStatus.BAD_REQUEST, exBulk.getStatus());

        // Other admin preserved
        assertTrue(userRepository.findById(otherAdmin.getId()).isPresent());
    }

    @Test
    @DisplayName("Duplicate and nonexistent IDs: Safely deduplicates and ignores missing IDs without throwing")
    void testDuplicateAndNonexistentIdsInBulk() {
        User student = createSyntheticUser("Dedup Student", "dedup_student@placeprep.test", "user");
        UUID fakeId = UUID.randomUUID();

        // Pass duplicates of the same ID plus a nonexistent UUID
        List<UUID> payload = List.of(student.getId(), student.getId(), fakeId);
        Map<String, Object> result = coachService.removeStudentsBulk(adminUser, payload);

        assertTrue(Boolean.TRUE.equals(result.get("success")));
        assertEquals(1, ((Number) result.get("deletedCount")).intValue());

        List<?> removedIds = (List<?>) result.get("studentUserIds");
        assertEquals(1, removedIds.size());
        assertEquals(student.getId().toString(), removedIds.get(0));

        // Real user deleted
        assertTrue(userRepository.findById(student.getId()).isEmpty());
    }

    @Test
    @DisplayName("Foreign key reference cleanup: User referenced by invites, groups, and APK versions is deleted cleanly")
    void testForeignKeyCleanupOnRemoval() {
        User student = createSyntheticUser("FK Student", "fk_student@placeprep.test", "user");

        // Insert reference in invites
        UUID inviteId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO invites (id, code, role, created_by, used_by, expires_at, created_at, updated_at) " +
                        "VALUES (?, ?, 'user', ?, ?, NOW() + INTERVAL '1 day', NOW(), NOW())",
                inviteId, "TESTCODE-" + UUID.randomUUID(), student.getId(), student.getId()
        );

        // Insert reference in coach_groups
        CoachGroup group = new CoachGroup();
        group.setName("FK Test Group");
        group.setDescription("Group created by student");
        group.setCreatedBy(student.getId());
        CoachGroup createdGroup = coachGroupRepository.createGroup(group);

        // Removal must null out foreign keys and delete student without constraint violation
        Map<String, Object> result = coachService.removeStudent(adminUser, student.getId());
        assertEquals(1, ((Number) result.get("deletedCount")).intValue());
        assertTrue(userRepository.findById(student.getId()).isEmpty());

        // Verify invite has null created_by and used_by
        Map<String, Object> invite = jdbcTemplate.queryForMap("SELECT created_by, used_by FROM invites WHERE id = ?", inviteId);
        assertNull(invite.get("created_by"));
        assertNull(invite.get("used_by"));

        // Clean up synthetic group & invite
        jdbcTemplate.update("DELETE FROM invites WHERE id = ?", inviteId);
        jdbcTemplate.update("DELETE FROM coach_groups WHERE id = ?", createdGroup.getId());
    }

    @Test
    @DisplayName("Isolation: Removing students does not delete or alter unrelated students")
    void testPreservationOfUnrelatedUsers() {
        User victim = createSyntheticUser("Victim Student", "victim@placeprep.test", "user");
        User innocent = createSyntheticUser("Innocent Student", "innocent@placeprep.test", "user");

        coachService.removeStudent(adminUser, victim.getId());

        assertTrue(userRepository.findById(victim.getId()).isEmpty());
        assertTrue(userRepository.findById(innocent.getId()).isPresent());
        assertEquals("Innocent Student", userRepository.findById(innocent.getId()).get().getName());
    }

    @Test
    @DisplayName("Transactional rollback: Mid-batch database constraint failure rolls back entire batch without partial deletion")
    void testTransactionRollbackOnMidBatchFailure() {
        User student1 = createSyntheticUser("Student Rollback One", "student_rollback1@placeprep.test", "user");
        User student2 = createSyntheticUser("Student Rollback Two", "student_rollback2@placeprep.test", "user");

        // Create a foreign key constraint table referencing users with ON DELETE RESTRICT
        jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS test_removal_constraint_blocker (user_id UUID REFERENCES users(id) ON DELETE RESTRICT)");
        try {
            // Block student2 from deletion via foreign key constraint
            jdbcTemplate.update("INSERT INTO test_removal_constraint_blocker (user_id) VALUES (?)", student2.getId());

            // Attempt bulk removal of student1 and student2
            // Since student1 is deleted first, but student2 fails due to the foreign key constraint,
            // @Transactional must rollback the entire transaction!
            assertThrows(Exception.class, () ->
                    coachService.removeStudentsBulk(adminUser, List.of(student1.getId(), student2.getId()))
            );

            // Verify ATOMIC ROLLBACK: student1 was NOT deleted despite being processed before student2!
            assertTrue(userRepository.findById(student1.getId()).isPresent(), "Student 1 must remain present after transaction rollback");
            assertTrue(userRepository.findById(student2.getId()).isPresent(), "Student 2 must remain present after transaction rollback");
        } finally {
            jdbcTemplate.execute("DROP TABLE IF EXISTS test_removal_constraint_blocker");
        }
    }
}
