package com.placeprep;

import com.placeprep.service.StorageService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class ApkManagementTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StorageService storageService;

    @Test
    void testGetLatestApkEndpointAccessible() throws Exception {
        // Unauthenticated access to /api/apk/latest must be allowed by SecurityConfig
        mockMvc.perform(get("/api/apk/latest"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    assertTrue(status == 200 || status == 404,
                            "Status should be 200 (if active APK exists) or 404 (if none seeded yet), but got: " + status);
                });
    }

    @Test
    void testResolveLocalPath() {
        Path path = storageService.resolveLocalPath("/uploads/apk/test.apk");
        assertNotNull(path);
        assertTrue(path.toString().endsWith("apk/test.apk") || path.toString().endsWith("apk\\test.apk"));
    }
}
