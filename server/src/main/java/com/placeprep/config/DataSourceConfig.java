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

                String jdbcUrl = String.format("jdbc:postgresql://%s:%d/%s?sslmode=require", host, port, dbName);
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

        return new HikariDataSource(config);
    }
}
