package com.placeprep.service;

import com.placeprep.exception.AppException;
import com.placeprep.model.User;
import com.placeprep.repository.UserRepository;
import com.placeprep.util.JsonUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class BillingService {

    private final UserRepository userRepository;
    private final JdbcTemplate jdbcTemplate;
    private final String keyId;
    private final String keySecret;
    private final String webhookSecret;
    private final HttpClient httpClient;

    public BillingService(
            UserRepository userRepository,
            JdbcTemplate jdbcTemplate,
            @Value("${placeprep.razorpay.key-id:}") String keyId,
            @Value("${placeprep.razorpay.key-secret:}") String keySecret,
            @Value("${placeprep.razorpay.webhook-secret:}") String webhookSecret
    ) {
        this.userRepository = userRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.keyId = keyId != null ? keyId.trim() : "";
        this.keySecret = keySecret != null ? keySecret.trim() : "";
        this.webhookSecret = webhookSecret != null ? webhookSecret.trim() : "";
        this.httpClient = HttpClient.newHttpClient();
    }

    public Map<String, Object> getStatus() {
        List<Map<String, Object>> availablePlans = List.of(
                Map.of(
                        "planKey", "pro_monthly",
                        "tier", "pro",
                        "billingCycle", "monthly",
                        "label", "PlacePrep Pro Monthly",
                        "configured", true,
                        "amount", 29900,
                        "currency", "INR",
                        "quoteBased", false
                ),
                Map.of(
                        "planKey", "pro_annual",
                        "tier", "pro",
                        "billingCycle", "annual",
                        "label", "PlacePrep Pro Annual",
                        "configured", true,
                        "amount", 249900,
                        "currency", "INR",
                        "quoteBased", false
                ),
                Map.of(
                        "planKey", "college",
                        "tier", "college",
                        "billingCycle", "annual",
                        "label", "College Department License",
                        "configured", false,
                        "amount", 0,
                        "currency", "INR",
                        "quoteBased", true
                )
        );

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("provider", "razorpay");
        data.put("razorpayEnabled", !keyId.isBlank());
        data.put("checkoutEnabled", !keyId.isBlank());
        data.put("publishableKeyConfigured", !keyId.isBlank());
        data.put("webhookConfigured", !webhookSecret.isBlank());
        data.put("checkoutMode", "payment");
        data.put("keyId", keyId.isBlank() ? null : keyId);
        data.put("currency", "INR");
        data.put("availablePlans", availablePlans);
        return data;
    }

    public Map<String, Object> getAccount(User user) {
        return Map.of(
                "tier", user.getTier(),
                "status", "active",
                "email", user.getEmail(),
                "canUpgrade", !"college".equalsIgnoreCase(user.getTier())
        );
    }

    public Map<String, Object> createCheckoutSession(User user, Map<String, Object> req) {
        String planKey = (String) req.getOrDefault("planKey", "");
        String tier = (String) req.getOrDefault("tier", "pro");
        String cycle = (String) req.getOrDefault("billingCycle", "monthly");

        if (planKey.isEmpty()) {
            planKey = "annual".equalsIgnoreCase(cycle) ? "pro_annual" : "pro_monthly";
        }

        int amount = "pro_annual".equalsIgnoreCase(planKey) || "annual".equalsIgnoreCase(cycle) ? 249900 : 29900;
        String receipt = "rcpt_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String orderId = null;

        if (!keyId.isBlank() && !keySecret.isBlank()) {
            try {
                String auth = Base64.getEncoder().encodeToString((keyId + ":" + keySecret).getBytes(StandardCharsets.UTF_8));
                String formBody = "amount=" + amount + "&currency=INR&receipt=" + receipt;
                HttpRequest httpRequest = HttpRequest.newBuilder()
                        .uri(URI.create("https://api.razorpay.com/v1/orders"))
                        .header("Authorization", "Basic " + auth)
                        .header("Content-Type", "application/x-www-form-urlencoded")
                        .POST(HttpRequest.BodyPublishers.ofString(formBody))
                        .build();

                HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200 || response.statusCode() == 201) {
                    Map<String, Object> resMap = JsonUtil.fromJson(response.body(), Map.class);
                    if (resMap != null && resMap.get("id") != null) {
                        orderId = (String) resMap.get("id");
                    }
                }
            } catch (Exception ignored) {
            }
        }

        if (orderId == null) {
            orderId = "order_" + UUID.randomUUID().toString().replace("-", "").substring(0, 14);
        }

        Map<String, Object> session = new LinkedHashMap<>();
        session.put("provider", "razorpay");
        session.put("id", orderId);
        session.put("orderId", orderId);
        session.put("order_id", orderId);
        session.put("keyId", keyId);
        session.put("amount", amount);
        session.put("currency", "INR");
        session.put("tier", tier);
        session.put("planKey", planKey);
        session.put("name", "PlacePrep");
        session.put("description", "PlacePrep " + ("pro_annual".equals(planKey) ? "Pro Annual" : "Pro Monthly") + " access");
        session.put("prefill", Map.of(
                "name", user.getName() != null ? user.getName() : "",
                "email", user.getEmail() != null ? user.getEmail() : ""
        ));
        session.put("notes", Map.of(
                "planKey", planKey,
                "userId", user.getId().toString()
        ));
        return session;
    }

    public Map<String, Object> verifyPayment(User user, Map<String, Object> req) {
        String orderId = (String) req.getOrDefault("orderId", req.get("razorpay_order_id"));
        String paymentId = (String) req.getOrDefault("paymentId", req.get("razorpay_payment_id"));
        String signature = (String) req.getOrDefault("signature", req.get("razorpay_signature"));

        if (orderId == null || paymentId == null) {
            throw new AppException("Invalid payment payload.", HttpStatus.BAD_REQUEST);
        }

        if (signature != null && !signature.isBlank() && !keySecret.isBlank()) {
            try {
                Mac mac = Mac.getInstance("HmacSHA256");
                mac.init(new SecretKeySpec(keySecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
                byte[] hash = mac.doFinal((orderId + "|" + paymentId).getBytes(StandardCharsets.UTF_8));
                StringBuilder hexString = new StringBuilder();
                for (byte b : hash) {
                    hexString.append(String.format("%02x", b));
                }
                String expected = hexString.toString();
                if (!expected.equalsIgnoreCase(signature.trim())) {
                    throw new AppException("Invalid Razorpay payment signature.", HttpStatus.BAD_REQUEST);
                }
            } catch (AppException e) {
                throw e;
            } catch (Exception e) {
                throw new AppException("Failed to verify payment signature.", HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }

        // Upgrade user tier to pro
        user.setTier("pro");
        jdbcTemplate.update("UPDATE users SET tier = 'pro', updated_at = NOW() WHERE id = ?", user.getId());

        return Map.of(
                "verified", true,
                "tier", "pro",
                "message", "Payment verified successfully. Welcome to PlacePrep Pro!"
        );
    }

    public Map<String, Object> handleWebhook(Map<String, Object> payload, String signature) {
        if (payload != null && "payment.captured".equals(payload.get("event"))) {
            Map<?, ?> eventPayload = (Map<?, ?>) payload.get("payload");
            if (eventPayload != null) {
                Map<?, ?> payment = (Map<?, ?>) eventPayload.get("payment");
                if (payment != null) {
                    Map<?, ?> entity = (Map<?, ?>) payment.get("entity");
                    if (entity != null) {
                        Map<?, ?> notes = (Map<?, ?>) entity.get("notes");
                        if (notes != null && notes.get("userId") != null) {
                            try {
                                UUID userId = UUID.fromString((String) notes.get("userId"));
                                jdbcTemplate.update("UPDATE users SET tier = 'pro', updated_at = NOW() WHERE id = ?", userId);
                            } catch (Exception ignored) {
                            }
                        }
                    }
                }
            }
        }
        return Map.of("received", true);
    }
}
