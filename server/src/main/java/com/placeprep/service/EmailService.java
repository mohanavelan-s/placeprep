package com.placeprep.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.placeprep.model.Notification;
import com.placeprep.model.User;
import com.placeprep.model.UserProfile;
import com.placeprep.repository.UserProfileRepository;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    public record EmailSendResult(
            boolean attempted,
            boolean success,
            String reason,
            String error
    ) {
        public static EmailSendResult sent() {
            return new EmailSendResult(true, true, "sent", null);
        }
        public static EmailSendResult skipped(String reason) {
            return new EmailSendResult(false, false, reason, null);
        }
        public static EmailSendResult failed(String reason, String error) {
            return new EmailSendResult(true, false, reason, error);
        }
    }

    private final UserProfileRepository userProfileRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Value("${placeprep.email.provider:resend}")
    private String emailProvider;

    @Value("${placeprep.email.resend-api-key:}")
    private String resendApiKey;

    @Value("${placeprep.email.resend-from:PlacePrep <onboarding@resend.dev>}")
    private String resendFrom;

    @Value("${placeprep.email.allow-smtp-fallback:false}")
    private boolean allowSmtpFallback;

    @Value("${placeprep.email.smtp-host:}")
    private String smtpHost;

    @Value("${placeprep.email.smtp-port:587}")
    private int smtpPort;

    @Value("${placeprep.email.smtp-user:}")
    private String smtpUser;

    @Value("${placeprep.email.smtp-pass:}")
    private String smtpPass;

    @Value("${placeprep.email.smtp-from:}")
    private String smtpFrom;

    @Value("${placeprep.email.smtp-secure:false}")
    private boolean smtpSecure;

    @Value("${placeprep.app.url:https://mvdev.in}")
    private String appUrl;

    public EmailService(
            UserProfileRepository userProfileRepository,
            ObjectMapper objectMapper
    ) {
        this.userProfileRepository = userProfileRepository;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public boolean isResendConfigured() {
        return resendApiKey != null && !resendApiKey.isBlank();
    }

    public boolean isSmtpConfigured() {
        return smtpHost != null && !smtpHost.isBlank() && smtpUser != null && !smtpUser.isBlank();
    }

    public boolean isEmailConfigured() {
        return isResendConfigured() || isSmtpConfigured();
    }

    public String getPrimaryProvider() {
        if ("smtp".equalsIgnoreCase(emailProvider) && isSmtpConfigured()) {
            return "smtp";
        }
        if (isResendConfigured()) {
            return "resend";
        }
        if (isSmtpConfigured()) {
            return "smtp";
        }
        return null;
    }

    public List<String> getConfiguredProviders() {
        List<String> providers = new ArrayList<>();
        if (isResendConfigured()) providers.add("resend");
        if (isSmtpConfigured()) providers.add("smtp");
        return providers;
    }

    private String getSubjectForType(String type) {
        if (type == null) return "PlacePrep | Placement preparation alert";
        return switch (type) {
            case "coach_capsule" -> "PlacePrep | New practice capsule";
            case "daily_inactivity" -> "PlacePrep | Return to the work";
            case "pending_tasks" -> "PlacePrep | Pending tasks are waiting";
            case "missed_streak" -> "PlacePrep | The streak is gone";
            case "countdown_urgency" -> "PlacePrep | Deadline pressure is rising";
            case "motivation" -> "PlacePrep | Show up tonight";
            case "test_notification" -> "PlacePrep | Notification test";
            default -> "PlacePrep | Placement preparation signal";
        };
    }

    public EmailSendResult sendNotificationEmail(User user, Notification notification) {
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            return EmailSendResult.skipped("recipient_missing_email");
        }

        // Check user preferences (bypass for test_notification)
        if (!"test_notification".equals(notification.getType())) {
            Optional<UserProfile> profileOpt = userProfileRepository.findByUserId(user.getId());
            if (profileOpt.isPresent()) {
                UserProfile profile = profileOpt.get();
                if (!profile.isNotificationsEnabled()) {
                    return EmailSendResult.skipped("notifications_disabled");
                }
                if (!profile.isNotificationEmailEnabled()) {
                    return EmailSendResult.skipped("email_notifications_disabled");
                }
            }
        }

        if (!isEmailConfigured()) {
            log.info("[email] Dev mode: Notification email for {} skipped (provider not configured). Message: {}",
                    user.getEmail(), notification.getMessage());
            return EmailSendResult.skipped("email_not_configured");
        }

        String subject = getSubjectForType(notification.getType());
        String htmlBody = buildHtmlEmail(user, notification, subject);
        String textBody = buildTextEmail(user, notification, subject);

        // Attempt primary provider
        String provider = getPrimaryProvider();
        if ("resend".equalsIgnoreCase(provider)) {
            EmailSendResult resendResult = sendViaResend(user.getEmail(), subject, htmlBody, textBody);
            if (resendResult.success()) {
                return resendResult;
            }
            // Fallback to SMTP only if configured and explicitly allowed
            if (isSmtpConfigured() && allowSmtpFallback) {
                log.warn("[email] Resend failed ({}); falling back to SMTP.", resendResult.error());
                return sendViaSmtp(user.getEmail(), subject, htmlBody, textBody);
            }
            return resendResult;
        } else if ("smtp".equalsIgnoreCase(provider)) {
            EmailSendResult smtpResult = sendViaSmtp(user.getEmail(), subject, htmlBody, textBody);
            if (smtpResult.success()) {
                return smtpResult;
            }
            // Fallback to Resend if available
            if (isResendConfigured()) {
                log.warn("[email] SMTP failed ({}); falling back to Resend.", smtpResult.error());
                return sendViaResend(user.getEmail(), subject, htmlBody, textBody);
            }
            return smtpResult;
        }

        return EmailSendResult.skipped("email_not_configured");
    }

    private EmailSendResult sendViaResend(String recipientEmail, String subject, String htmlBody, String textBody) {
        String primaryFrom = (resendFrom != null && !resendFrom.isBlank()) ? resendFrom : "PlacePrep <onboarding@resend.dev>";
        EmailSendResult result = executeResendRequest(primaryFrom, recipientEmail, subject, htmlBody, textBody);

        // If Resend failed due to unverified custom domain (HTTP 403 / domain validation error),
        // and we were not already using onboarding@resend.dev, immediately retry with onboarding@resend.dev
        if (!result.success() && !primaryFrom.contains("onboarding@resend.dev") &&
                result.error() != null && (result.error().contains("403") || result.error().toLowerCase().contains("domain"))) {
            log.warn("[email] Resend sender '{}' failed with domain validation error ({}). Retrying with onboarding@resend.dev",
                    primaryFrom, result.error());
            return executeResendRequest("PlacePrep <onboarding@resend.dev>", recipientEmail, subject, htmlBody, textBody);
        }

        return result;
    }

    private EmailSendResult executeResendRequest(String from, String recipientEmail, String subject, String htmlBody, String textBody) {
        try {
            Map<String, Object> payload = Map.of(
                    "from", from,
                    "to", List.of(recipientEmail),
                    "subject", subject,
                    "html", htmlBody,
                    "text", textBody
            );

            String requestBody = objectMapper.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.resend.com/emails"))
                    .timeout(Duration.ofSeconds(15))
                    .header("Authorization", "Bearer " + resendApiKey.trim())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("[email] Successfully sent email via Resend to {} from {}", recipientEmail, from);
                return EmailSendResult.sent();
            } else {
                log.error("[email] Resend API error {}: {}", response.statusCode(), response.body());
                return EmailSendResult.failed("resend_delivery_failed", "HTTP " + response.statusCode() + ": " + response.body());
            }
        } catch (Exception e) {
            log.error("[email] Exception sending email via Resend to {}: {}", recipientEmail, e.getMessage());
            return EmailSendResult.failed("resend_delivery_failed", e.getMessage());
        }
    }

    private EmailSendResult sendViaSmtp(String recipientEmail, String subject, String htmlBody, String textBody) {
        try {
            JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
            mailSender.setHost(smtpHost);
            mailSender.setPort(smtpPort);
            if (smtpUser != null && !smtpUser.isBlank()) {
                mailSender.setUsername(smtpUser);
            }
            if (smtpPass != null && !smtpPass.isBlank()) {
                mailSender.setPassword(smtpPass);
            }

            Properties props = mailSender.getJavaMailProperties();
            props.put("mail.transport.protocol", "smtp");
            props.put("mail.smtp.auth", String.valueOf(smtpUser != null && !smtpUser.isBlank()));
            props.put("mail.smtp.starttls.enable", String.valueOf(!smtpSecure));
            props.put("mail.smtp.ssl.enable", String.valueOf(smtpSecure));
            props.put("mail.smtp.connectiontimeout", "10000");
            props.put("mail.smtp.timeout", "10000");

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            String from = (smtpFrom != null && !smtpFrom.isBlank()) ? smtpFrom : (smtpUser != null ? smtpUser : "notifications@placeprep.app");
            helper.setFrom(from);
            helper.setTo(recipientEmail);
            helper.setSubject(subject);
            helper.setText(textBody, htmlBody);

            mailSender.send(message);
            log.info("[email] Successfully sent email via SMTP to {}", recipientEmail);
            return EmailSendResult.sent();
        } catch (Exception e) {
            log.error("[email] Exception sending email via SMTP to {}: {}", recipientEmail, e.getMessage());
            String reason = "smtp_delivery_failed";
            if (e.getMessage() != null && e.getMessage().toLowerCase().contains("authentication")) {
                reason = "smtp_auth_failed";
            } else if (e.getMessage() != null && e.getMessage().toLowerCase().contains("timeout")) {
                reason = "smtp_connection_timeout";
            }
            return EmailSendResult.failed(reason, e.getMessage());
        }
    }

    private String buildHtmlEmail(User user, Notification notification, String subject) {
        String userName = user.getName() != null && !user.getName().isBlank() ? user.getName() : "Student";
        String message = notification.getMessage() != null ? notification.getMessage() : "Stay focused on your preparation goals.";
        String actionUrl = appUrl.replaceAll("/$", "") + "/tasks";

        return """
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>%s</title>
              <style>
                body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6; }
                .container { max-width: 600px; margin: 40px auto; background-color: #111827; border-radius: 12px; border: 1px solid #1f2937; overflow: hidden; }
                .header { background: linear-gradient(135deg, #1e1b4b 0%%, #0f172a 100%%); padding: 32px 24px; border-bottom: 1px solid #1f2937; text-align: center; }
                .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #6366f1; text-transform: uppercase; }
                .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background-color: rgba(99, 102, 241, 0.2); color: #818cf8; margin-top: 12px; border: 1px solid rgba(99, 102, 241, 0.3); }
                .content { padding: 32px 24px; }
                .greeting { font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #f9fafb; }
                .signal-card { background-color: #1f2937; border-left: 4px solid #6366f1; padding: 18px; border-radius: 6px; margin: 20px 0; font-size: 15px; line-height: 1.6; color: #e5e7eb; }
                .cta-block { text-align: center; margin-top: 32px; }
                .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4); }
                .footer { padding: 24px; border-top: 1px solid #1f2937; text-align: center; font-size: 12px; color: #6b7280; }
                .footer a { color: #818cf8; text-decoration: none; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="logo">PLACEPREP</div>
                  <div class="badge">Tactical Signal</div>
                </div>
                <div class="content">
                  <div class="greeting">Commander %s,</div>
                  <div class="signal-card">
                    %s
                  </div>
                  <div class="cta-block">
                    <a href="%s" class="btn">Open Command Chamber &rarr;</a>
                  </div>
                </div>
                <div class="footer">
                  <p>You received this signal because email notifications are enabled for your PlacePrep account.</p>
                  <p>&copy; PlacePrep. Intelligent placement execution engine.</p>
                </div>
              </div>
            </body>
            </html>
            """.formatted(subject, userName, message, actionUrl);
    }

    private String buildTextEmail(User user, Notification notification, String subject) {
        String userName = user.getName() != null && !user.getName().isBlank() ? user.getName() : "Student";
        String message = notification.getMessage() != null ? notification.getMessage() : "Stay focused on your preparation goals.";
        String actionUrl = appUrl.replaceAll("/$", "") + "/tasks";

        return """
            PLACEPREP | %s

            Commander %s,

            %s

            Review your missions and live stats:
            %s

            ----------------------------------------
            You received this signal because email notifications are enabled for your PlacePrep account.
            """.formatted(subject, userName, message, actionUrl);
    }
}
