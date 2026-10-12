package com.placeprep;

import com.placeprep.model.MobileDevice;
import com.placeprep.model.Notification;
import com.placeprep.model.User;
import com.placeprep.model.UserProfile;
import com.placeprep.repository.MobileDeviceRepository;
import com.placeprep.repository.UserProfileRepository;
import com.placeprep.repository.UserRepository;
import com.placeprep.service.FcmService;
import com.placeprep.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class FcmNotificationTest {

    @Autowired
    private FcmService fcmService;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private MobileDeviceRepository mobileDeviceRepository;

    @Autowired
    private UserProfileRepository userProfileRepository;

    @Autowired
    private UserRepository userRepository;

    private User testUser;

    @BeforeEach
    void setup() {
        testUser = userRepository.findByEmail("fcm_test_user@placeprep.test").orElseGet(() -> {
            User u = new User();
            u.setName("FCM Test Candidate");
            u.setUsername("fcm_test_candidate");
            u.setEmail("fcm_test_user@placeprep.test");
            u.setPasswordHash("$2a$10$abcdefghijklmnopqrstuvwxyz1234567890");
            u.setRole("user");
            return userRepository.createUser(u);
        });
    }

    @Test
    void testTokenMaskingDoesNotLeakFullToken() {
        String shortToken = "short";
        assertEquals("***", FcmService.maskToken(shortToken));

        String longToken = "fcm_token_1234567890_abcdefghijklmnopqrstuvwxyz";
        String masked = FcmService.maskToken(longToken);
        assertTrue(masked.startsWith("fcm_to..."));
        assertTrue(masked.endsWith("wxyz"));
        assertFalse(masked.contains("1234567890_abcdefgh"));
    }

    @Test
    void testDeviceRegistrationAndCleanup() {
        String testToken = "test_device_token_" + UUID.randomUUID();
        MobileDevice reg = mobileDeviceRepository.registerDevice(
                testUser.getId(),
                testToken,
                "android",
                "Pixel 9 Pro",
                "2.0.0"
        );

        assertNotNull(reg);
        assertEquals(testToken, reg.getDeviceToken());
        assertEquals("Pixel 9 Pro", reg.getDeviceName());

        List<MobileDevice> devices = mobileDeviceRepository.listByUserId(testUser.getId());
        assertTrue(devices.stream().anyMatch(d -> d.getDeviceToken().equals(testToken)));

        // Verify invalid token cleanup
        boolean deleted = mobileDeviceRepository.deleteByToken(testToken);
        assertTrue(deleted, "Dead/invalid token should be cleanable by token");

        List<MobileDevice> postDelete = mobileDeviceRepository.listByUserId(testUser.getId());
        assertFalse(postDelete.stream().anyMatch(d -> d.getDeviceToken().equals(testToken)));
    }

    @Test
    void testUnconfiguredFcmGracefulHandling() {
        // When server has not received Railway service account JSON, it must not throw
        Notification note = new Notification();
        note.setId(UUID.randomUUID());
        note.setUserId(testUser.getId());
        note.setType("test_notification");
        note.setMessage("Testing graceful fallback when FCM is unconfigured");

        String dummyToken = "fcm_dummy_token_" + UUID.randomUUID();
        mobileDeviceRepository.registerDevice(testUser.getId(), dummyToken, "android", "Test Device", "2.0.0");

        try {
            FcmService.FcmDeliveryResult result = fcmService.sendNotificationToUser(testUser.getId(), note);
            assertNotNull(result);
            if (!fcmService.isConfigured()) {
                assertFalse(result.attempted());
                assertEquals("fcm_not_configured", result.reason());
            }
        } finally {
            mobileDeviceRepository.deleteByToken(dummyToken);
        }
    }

    @Test
    void testNotificationPreferenceEnforcement() {
        // If user mutes notifications in UserProfile, FCM dispatch must be skipped
        UserProfile profile = userProfileRepository.findByUserId(testUser.getId()).orElseGet(() -> {
            UserProfile p = new UserProfile();
            p.setUserId(testUser.getId());
            return userProfileRepository.upsertProfile(p);
        });

        profile.setNotificationsEnabled(false);
        userProfileRepository.upsertProfile(profile);

        Notification note = new Notification();
        note.setId(UUID.randomUUID());
        note.setUserId(testUser.getId());
        note.setType("test_notification");
        note.setMessage("Muted notification");

        FcmService.FcmDeliveryResult result = fcmService.sendNotificationToUser(testUser.getId(), note);
        assertNotNull(result);
        assertFalse(result.attempted());
        assertEquals("user_disabled_notifications", result.reason());

        // Restore preference
        profile.setNotificationsEnabled(true);
        userProfileRepository.upsertProfile(profile);
    }

    @Test
    void testNotificationServiceTestPushIncludesFcmStatus() {
        Map<String, Object> testPushResult = notificationService.testPushNotification(testUser);
        assertNotNull(testPushResult);
        assertTrue(testPushResult.containsKey("fcmReady"));
        assertTrue(testPushResult.containsKey("fcmAttempted"));
        assertTrue(testPushResult.containsKey("fcmReason"));
    }
}
