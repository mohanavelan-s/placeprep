package com.placeprep;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.nio.charset.StandardCharsets;

@SpringBootApplication
@EnableScheduling
public class PlacePrepApplication {

    static {
        System.setProperty("java.net.preferIPv4Stack", "true");
        sanitizeEnvironment();
        loadDotEnv();
    }

    private static void sanitizeEnvironment() {
        try {
            System.getenv().forEach((k, v) -> {
                if (v != null && ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'")))) {
                    if (v.length() >= 2) {
                        System.setProperty(k, v.substring(1, v.length() - 1).trim());
                    }
                }
            });
        } catch (Exception ignored) {
        }
    }

    public static void main(String[] args) {
        SpringApplication.run(PlacePrepApplication.class, args);
    }

    private static void loadDotEnv() {
        String[] candidatePaths = {
            ".env",
            "server/.env",
            "../server/.env",
            "../.env",
            "secrets/credentials.secrets.json",
            "server/secrets/credentials.secrets.json",
            "../server/secrets/credentials.secrets.json"
        };

        for (String path : candidatePaths) {
            File f = new File(path);
            if (f.exists() && f.isFile()) {
                try (BufferedReader reader = new BufferedReader(new FileReader(f, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#")) continue;
                        int eqIdx = line.indexOf('=');
                        if (eqIdx > 0) {
                            String key = line.substring(0, eqIdx).trim();
                            String val = line.substring(eqIdx + 1).trim();
                            if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
                                if (val.length() >= 2) {
                                    val = val.substring(1, val.length() - 1);
                                }
                            }
                            if (System.getProperty(key) == null && System.getenv(key) == null) {
                                System.setProperty(key, val);
                            }
                        }
                    }
                } catch (Exception ignored) {
                }
            }
        }
    }
}

