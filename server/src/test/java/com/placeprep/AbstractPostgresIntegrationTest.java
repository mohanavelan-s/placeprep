package com.placeprep;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import javax.sql.DataSource;
import java.net.Socket;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Locale;

/**
 * Base class for all integration tests requiring a PostgreSQL database.
 *
 * Production Safety Guarantees:
 * 1. Strictly isolates test execution to dedicated disposable or ephemeral test databases.
 * 2. Never falls back to production DATABASE_URL or remote Supabase hosts.
 * 3. Enforces strict URL validation: fail-fast if the target contains remote host indicators
 *    (e.g., supabase.co, pooler.supabase.com, aws-1-ap-south-1).
 * 4. Resolves TEST_DATABASE_URL or the dedicated local test database instance (port 5433).
 */
public abstract class AbstractPostgresIntegrationTest {

    public static final String DEFAULT_LOCAL_TEST_DB = "postgresql://postgres:test@localhost:5433/placeprep_test";
    private static final String RESOLVED_TEST_DB_URL;
    private static org.testcontainers.containers.PostgreSQLContainer<?> postgresContainer;

    static {
        String testUrl = System.getenv("TEST_DATABASE_URL");
        if (testUrl == null || testUrl.isBlank()) {
            testUrl = System.getProperty("test.database.url");
        }

        if (testUrl != null && !testUrl.isBlank()) {
            assertSafeTestDatabaseUrl(testUrl);
            RESOLVED_TEST_DB_URL = testUrl.trim();
        } else if (isLocalPortOpen("127.0.0.1", 5433)) {
            assertSafeTestDatabaseUrl(DEFAULT_LOCAL_TEST_DB);
            RESOLVED_TEST_DB_URL = DEFAULT_LOCAL_TEST_DB;
        } else {
            try {
                org.testcontainers.containers.PostgreSQLContainer<?> container =
                        new org.testcontainers.containers.PostgreSQLContainer<>("postgres:16-alpine")
                                .withDatabaseName("placeprep_test")
                                .withUsername("postgres")
                                .withPassword("test")
                                .withInitScript("test-schema.sql");
                container.start();
                postgresContainer = container;
                String tcUrl = container.getJdbcUrl();
                assertSafeTestDatabaseUrl(tcUrl);
                RESOLVED_TEST_DB_URL = tcUrl;
            } catch (Throwable t) {
                throw new IllegalStateException(
                        "CRITICAL SAFETY FAILURE: No dedicated test database found.\n"
                        + "Port 5433 is not open and dynamic Testcontainers provisioning failed: " + t.getMessage() + "\n"
                        + "Please start the local test database (e.g., docker run -d --name placeprep-test-postgres -p 5433:5432 -e POSTGRES_DB=placeprep_test -e POSTGRES_PASSWORD=test postgres:16-alpine) or provide TEST_DATABASE_URL.\n"
                        + "Integration tests will NEVER connect or fall back to production DATABASE_URL.", t
                );
            }
        }
    }

    private static boolean isLocalPortOpen(String host, int port) {
        try (Socket socket = new Socket(host, port)) {
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @DynamicPropertySource
    static void configureTestDatasource(DynamicPropertyRegistry registry) {
        assertSafeTestDatabaseUrl(RESOLVED_TEST_DB_URL);
        registry.add("spring.datasource.url", () -> RESOLVED_TEST_DB_URL);
    }

    /**
     * Fail-fast security validation: Ensures database URLs are strictly safe for test execution.
     */
    public static void assertSafeTestDatabaseUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new IllegalStateException("CRITICAL SAFETY FAILURE: Test database URL is empty or undefined.");
        }
        String lower = rawUrl.toLowerCase(Locale.ROOT);
        if (lower.contains("supabase.co") || lower.contains("pooler.supabase.com") || lower.contains("aws-1-ap-south-1")
                || lower.contains("amazonaws.com") || lower.contains("azure.com") || lower.contains("google.com")) {
            throw new SecurityException("CRITICAL SAFETY VIOLATION: Test database URL points to a remote/cloud host: "
                    + sanitizeUrl(rawUrl));
        }
        boolean isLocalTarget = lower.contains("localhost") || lower.contains("127.0.0.1");
        if (!isLocalTarget) {
            throw new SecurityException("SAFETY CHECK FAILED: Test database URL must strictly target 'localhost' or '127.0.0.1'. Provided: "
                    + sanitizeUrl(rawUrl));
        }
    }

    /**
     * Validates active connection metadata at runtime directly against the JDBC connection.
     */
    public static void assertSafeActiveConnection(DataSource dataSource) throws SQLException {
        if (dataSource == null) {
            throw new IllegalStateException("SAFETY CHECK FAILED: DataSource is null.");
        }
        try (Connection conn = dataSource.getConnection()) {
            String actualUrl = conn.getMetaData().getURL();
            assertSafeTestDatabaseUrl(actualUrl);
        }
    }

    private static String sanitizeUrl(String url) {
        return url.replaceAll("://[^@]+@", "://***:***@");
    }
}
