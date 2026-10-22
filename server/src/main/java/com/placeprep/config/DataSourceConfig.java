package com.placeprep.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.URI;

@Configuration
public class DataSourceConfig {

    @Value("${spring.datasource.url:}")
    private String rawUrl;

    @Value("${spring.datasource.hikari.maximum-pool-size:${DB_POOL_MAX:5}}")
    private int maxPoolSize;

    @Value("${spring.datasource.hikari.minimum-idle:${DB_POOL_MIN:1}}")
    private int minIdle;

    @Value("${spring.datasource.hikari.connection-timeout:${DB_CONNECTION_TIMEOUT:30000}}")
    private long connectionTimeout;

    @Value("${spring.datasource.hikari.idle-timeout:${DB_IDLE_TIMEOUT:30000}}")
    private long idleTimeout;

    @Value("${spring.datasource.hikari.max-lifetime:${DB_MAX_LIFETIME:1800000}}")
    private long maxLifetime;

    @Value("${placeprep.test.isolation.enforce:false}")
    private boolean enforceTestIsolation;

    @Bean
    @Primary
    public DataSource dataSource() {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new IllegalStateException("DATABASE_URL or spring.datasource.url must be configured.");
        }

        String url = rawUrl.trim();
        if ((url.startsWith("\"") && url.endsWith("\"")) || (url.startsWith("'") && url.endsWith("'"))) {
            if (url.length() >= 2) {
                url = url.substring(1, url.length() - 1).trim();
            }
        }

        if (enforceTestIsolation) {
            String lower = url.toLowerCase(java.util.Locale.ROOT);
            if (lower.contains("supabase.co") || lower.contains("pooler.supabase.com") || lower.contains("aws-1-ap-south-1") || lower.contains("amazonaws.com") || lower.contains("azure.com") || lower.contains("google.com")) {
                throw new SecurityException("CRITICAL SAFETY ENFORCEMENT: Test isolation is active but DataSource URL points to a remote/production host: " + sanitizeUrl(url));
            }
            String host = extractHostFromUrl(url);
            if (!isLoopbackOrLocalhost(host)) {
                throw new SecurityException("CRITICAL SAFETY ENFORCEMENT: Test isolation is active but DataSource URL points to a non-local host ('" + host + "'): " + sanitizeUrl(url));
            }
        }

        HikariConfig config = new HikariConfig();

        if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
            try {
                URI uri = new URI(url);
                String host = uri.getHost();
                int port = uri.getPort() == -1 ? 5432 : uri.getPort();
                String path = uri.getPath();
                String dbName = (path != null && path.length() > 1) ? path.substring(1) : "postgres";

                String userInfo = uri.getUserInfo();
                String username = "postgres";
                String password = "";
                if (userInfo != null && userInfo.contains(":")) {
                    String[] parts = userInfo.split(":", 2);
                    username = parts[0];
                    password = parts[1];
                }

                boolean isLocal = "localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host);
                String sslParam = isLocal ? "sslmode=disable" : "sslmode=require";
                String jdbcUrl = String.format("jdbc:postgresql://%s:%d/%s?%s", host, port, dbName, sslParam);
                config.setJdbcUrl(jdbcUrl);
                config.setUsername(username);
                config.setPassword(password);
            } catch (Exception e) {
                config.setJdbcUrl(url);
            }
        } else {
            config.setJdbcUrl(url);
        }

        config.setDriverClassName("org.postgresql.Driver");
        config.setMaximumPoolSize(maxPoolSize);
        config.setMinimumIdle(minIdle);
        config.setConnectionTimeout(connectionTimeout);
        config.setIdleTimeout(idleTimeout);
        config.setMaxLifetime(maxLifetime);

        HikariDataSource ds = new HikariDataSource(config);
        if (enforceTestIsolation) {
            validateActiveConnection(ds);
        }
        return ds;
    }

    private void validateActiveConnection(DataSource ds) {
        try (java.sql.Connection conn = ds.getConnection()) {
            java.sql.DatabaseMetaData meta = conn.getMetaData();
            String connUrl = meta.getURL();
            if (connUrl != null) {
                String lower = connUrl.toLowerCase(java.util.Locale.ROOT);
                if (lower.contains("supabase.co") || lower.contains("pooler.supabase.com") || lower.contains("aws-1-ap-south-1") || lower.contains("amazonaws.com") || lower.contains("azure.com") || lower.contains("google.com")) {
                    throw new SecurityException("CRITICAL SAFETY ENFORCEMENT: Active JDBC connection points to a remote/production host: " + sanitizeUrl(connUrl));
                }
                String host = extractHostFromUrl(connUrl);
                if (!isLoopbackOrLocalhost(host)) {
                    throw new SecurityException("CRITICAL SAFETY ENFORCEMENT: Active JDBC connection is not strictly local ('" + host + "'): " + sanitizeUrl(connUrl));
                }
            }
        } catch (java.sql.SQLException e) {
            throw new IllegalStateException("CRITICAL SAFETY ENFORCEMENT: Failed to validate local test database connection: " + e.getMessage(), e);
        }
    }

    private String extractHostFromUrl(String url) {
        if (url == null || url.isBlank()) return "";
        String clean = url.trim();
        if (clean.startsWith("jdbc:")) {
            clean = clean.substring(5);
        }
        try {
            URI uri = new URI(clean);
            if (uri.getHost() != null) {
                return uri.getHost();
            }
        } catch (Exception ignored) {
        }
        int schemeIdx = clean.indexOf("://");
        if (schemeIdx != -1) {
            String afterScheme = clean.substring(schemeIdx + 3);
            int atIdx = afterScheme.indexOf("@");
            if (atIdx != -1) {
                afterScheme = afterScheme.substring(atIdx + 1);
            }
            int slashIdx = afterScheme.indexOf("/");
            String hostPort = (slashIdx != -1) ? afterScheme.substring(0, slashIdx) : afterScheme;
            int colonIdx = hostPort.indexOf(":");
            return (colonIdx != -1) ? hostPort.substring(0, colonIdx) : hostPort;
        }
        return "";
    }

    private boolean isLoopbackOrLocalhost(String host) {
        if (host == null || host.isBlank()) {
            return false;
        }
        String h = host.trim().toLowerCase(java.util.Locale.ROOT);
        if ("localhost".equals(h) || "127.0.0.1".equals(h) || "::1".equals(h) || "[::1]".equals(h)) {
            return true;
        }
        try {
            java.net.InetAddress addr = java.net.InetAddress.getByName(h);
            return addr.isLoopbackAddress();
        } catch (Exception ignored) {
            return false;
        }
    }

    private String sanitizeUrl(String url) {
        return url != null ? url.replaceAll("://[^@]+@", "://***:***@") : "";
    }
}
