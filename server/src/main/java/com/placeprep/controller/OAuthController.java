package com.placeprep.controller;

import com.placeprep.dto.AuthResponse;
import com.placeprep.dto.LoginRequest;
import com.placeprep.repository.OAuthRepository;
import com.placeprep.service.AuthService;
import com.placeprep.service.OAuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
public class OAuthController {

    private final OAuthService oAuthService;
    private final AuthService authService;

    @Value("${placeprep.auth.google-client-id:142236988060-7stjhr2uo0nj92h94b5bds92t2qlqakp.apps.googleusercontent.com}")
    private String googleClientId;

    public OAuthController(OAuthService oAuthService, AuthService authService) {
        this.oAuthService = oAuthService;
        this.authService = authService;
    }

    @GetMapping(value = {"/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getProtectedResourceMetadata(HttpServletRequest req) {
        String resource = oAuthService.getResource(req);
        String issuer = oAuthService.getIssuer(req);
        String baseUrl = oAuthService.getPublicBaseUrl(req);
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("resource", resource);
        map.put("authorization_servers", List.of(issuer));
        map.put("bearer_methods_supported", List.of("header"));
        map.put("scopes_supported", oAuthService.getSupportedScopes());
        map.put("resource_documentation", baseUrl + "/docs/mcp/tools.md");
        map.put("logo_uri", baseUrl + "/logo.png");
        map.put("logo_svg", baseUrl + "/logo.svg");
        return map;
    }

    @GetMapping(value = {"/.well-known/oauth-authorization-server", "/.well-known/openid-configuration"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getAuthorizationServerMetadata(HttpServletRequest req) {
        String issuer = oAuthService.getIssuer(req);
        String baseUrl = oAuthService.getPublicBaseUrl(req);
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("issuer", issuer);
        map.put("authorization_endpoint", issuer + "/oauth/authorize");
        map.put("token_endpoint", issuer + "/oauth/token");
        map.put("revocation_endpoint", issuer + "/oauth/revoke");
        map.put("jwks_uri", issuer + "/oauth/jwks");
        map.put("response_types_supported", List.of("code"));
        map.put("grant_types_supported", List.of("authorization_code"));
        map.put("code_challenge_methods_supported", List.of("S256"));
        map.put("token_endpoint_auth_methods_supported", List.of("none"));
        map.put("scopes_supported", oAuthService.getSupportedScopes());
        map.put("registration_endpoint", issuer + "/oauth/register");
        map.put("logo_uri", baseUrl + "/logo.png");
        map.put("service_documentation", baseUrl);
        return map;
    }

    @GetMapping(value = {"/oauth/jwks", "/.well-known/jwks.json"}, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getJwks() {
        return oAuthService.getJwks();
    }

    // Client metadata descriptor
    public static class ClientInfo {
        public final String name;
        public final String brand;
        public final String badge;
        public final String host;
        public final String iconSvg;

        public ClientInfo(String name, String brand, String badge, String host, String iconSvg) {
            this.name = name;
            this.brand = brand;
            this.badge = badge;
            this.host = host;
            this.iconSvg = iconSvg;
        }
    }

    // Scope metadata descriptor
    public static class ScopeItem {
        public final String rawScope;
        public final String titleKey;
        public final String defaultTitle;
        public final String descKey;
        public final String defaultDesc;
        public final String typeBadge; // "READ" or "WRITE"
        public final String badgeClass; // "badge-read" or "badge-write"

        public ScopeItem(String rawScope, String titleKey, String defaultTitle, String descKey, String defaultDesc, String typeBadge, String badgeClass) {
            this.rawScope = rawScope;
            this.titleKey = titleKey;
            this.defaultTitle = defaultTitle;
            this.descKey = descKey;
            this.defaultDesc = defaultDesc;
            this.typeBadge = typeBadge;
            this.badgeClass = badgeClass;
        }
    }

    private ClientInfo resolveClientInfo(String clientId, String redirectUri) {
        String cIdLower = clientId != null ? clientId.toLowerCase() : "";
        String uriLower = redirectUri != null ? redirectUri.toLowerCase() : "";
        String host = "";
        try {
            if (redirectUri != null && !redirectUri.isBlank()) {
                URI u = new URI(redirectUri);
                host = u.getHost();
                if (host == null || host.isBlank()) host = redirectUri;
            }
        } catch (Exception ignored) {
            host = redirectUri != null ? redirectUri : "";
        }

        if (cIdLower.contains("chatgpt") || uriLower.contains("chatgpt.com") || uriLower.contains("openai.com")) {
            return new ClientInfo("ChatGPT", "OpenAI", "AI Assistant", host.isEmpty() ? "chatgpt.com" : host, SVG_CHATGPT);
        } else if (cIdLower.contains("claude") || uriLower.contains("claude.ai") || uriLower.contains("anthropic.com")) {
            return new ClientInfo("Claude", "Anthropic", "AI Assistant", host.isEmpty() ? "claude.ai" : host, SVG_CLAUDE);
        } else if (cIdLower.contains("cursor") || uriLower.contains("cursor.sh") || uriLower.contains("cursor.com")) {
            return new ClientInfo("Cursor", "Anysphere", "AI Code Editor", host.isEmpty() ? "cursor.com" : host, SVG_CURSOR);
        } else if (cIdLower.contains("postman") || uriLower.contains("pstmn.io")) {
            return new ClientInfo("Postman", "Postman, Inc.", "API Client", host.isEmpty() ? "pstmn.io" : host, SVG_POSTMAN);
        } else if ("local-mcp-test".equalsIgnoreCase(clientId)) {
            return new ClientInfo("Local MCP Test Client", "Development Suite", "Local Workspace", host.isEmpty() ? "127.0.0.1" : host, SVG_DEV);
        } else {
            String name = clientId;
            if (name != null && name.length() > 20 && name.contains("-")) {
                name = "External MCP Connector";
            }
            return new ClientInfo(name != null ? name : "MCP Client", "Verified Client", "MCP Agent", host.isEmpty() ? "mcp-service" : host, SVG_GENERIC);
        }
    }

    private ScopeItem resolveScopeItem(String scope) {
        if ("placeprep.tasks.read".equals(scope)) {
            return new ScopeItem(scope, "scope_tasks_read_title", "Tasks", "scope_tasks_read_desc", "View your tasks, milestones, and daily schedule", "READ", "badge-read");
        } else if ("placeprep.tasks.write".equals(scope)) {
            return new ScopeItem(scope, "scope_tasks_write_title", "Task Management", "scope_tasks_write_desc", "Create, update, reschedule, and complete tasks", "WRITE", "badge-write");
        } else if ("placeprep.progress.read".equals(scope)) {
            return new ScopeItem(scope, "scope_progress_read_title", "Preparation Progress", "scope_progress_read_desc", "View readiness diagnostics, analytics, and consistency scores", "READ", "badge-read");
        } else if ("placeprep.profile.read".equals(scope)) {
            return new ScopeItem(scope, "scope_profile_read_title", "Account Profile", "scope_profile_read_desc", "View your profile information, target company tracks, and settings", "READ", "badge-read");
        } else {
            boolean isWrite = scope.toLowerCase().contains("write");
            return new ScopeItem(scope, "scope_custom_title", scope, "scope_custom_desc", "Access PlacePrep resource for " + scope, isWrite ? "WRITE" : "READ", isWrite ? "badge-write" : "badge-read");
        }
    }

    @GetMapping(value = "/oauth/authorize", produces = MediaType.TEXT_HTML_VALUE)
    public String authorize(
            HttpServletRequest req,
            @RequestParam("response_type") String responseType,
            @RequestParam("client_id") String clientId,
            @RequestParam("redirect_uri") String redirectUri,
            @RequestParam("state") String state,
            @RequestParam("code_challenge") String codeChallenge,
            @RequestParam("code_challenge_method") String codeChallengeMethod,
            @RequestParam(value = "resource", required = false) String resource
    ) {
        OAuthRepository.Transaction tx = oAuthService.begin(
                req, responseType, clientId, redirectUri, state, codeChallenge, codeChallengeMethod, resource
        );

        ClientInfo client = resolveClientInfo(tx.clientId, tx.redirectUri);

        StringBuilder scopesHtml = new StringBuilder();
        int scopeCount = tx.scopes != null ? tx.scopes.size() : 0;
        if (tx.scopes != null) {
            for (String sc : tx.scopes) {
                ScopeItem item = resolveScopeItem(sc);
                scopesHtml.append(String.format("""
                    <div class="scope-card" data-scope="%s">
                      <div class="scope-row">
                        <div class="scope-title-group">
                          <span class="scope-name" data-i18n="%s">%s</span>
                          <span class="scope-badge %s" data-i18n="%s">%s</span>
                        </div>
                        <div class="scope-desc" data-i18n="%s">%s</div>
                        <div class="scope-code">%s</div>
                      </div>
                    </div>
                    """,
                        item.rawScope,
                        item.titleKey, item.defaultTitle,
                        item.badgeClass, item.typeBadge.toLowerCase() + "_badge", item.typeBadge,
                        item.descKey, item.defaultDesc,
                        item.rawScope
                ));
            }
        }

        String template = getAuthorizeHtmlTemplate();
        return template
                .replace("{{TX_ID}}", tx.id.toString())
                .replace("{{RAW_CLIENT_ID}}", tx.clientId != null ? tx.clientId : "")
                .replace("{{CLIENT_NAME}}", client.name)
                .replace("{{CLIENT_BRAND}}", client.brand)
                .replace("{{CLIENT_BADGE}}", client.badge)
                .replace("{{CLIENT_HOST}}", client.host)
                .replace("{{CLIENT_ICON}}", client.iconSvg)
                .replace("{{REDIRECT_URI}}", tx.redirectUri != null ? tx.redirectUri : "")
                .replace("{{SCOPES_HTML}}", scopesHtml.toString())
                .replace("{{SCOPES_COUNT}}", String.valueOf(scopeCount))
                .replace("{{GOOGLE_CLIENT_ID}}", googleClientId);
    }

    private String getAuthorizeHtmlTemplate() {
        return """
            <!doctype html>
            <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
              <title>Authorize PlacePrep MCP Connector - PlacePrep</title>
              <link rel="icon" type="image/svg+xml" href="/logo.svg">
              <link rel="preconnect" href="https://fonts.googleapis.com">
              <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
              <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
              <script src="https://accounts.google.com/gsi/client" async defer></script>
              <style>
                :root {
                  --bg: #07080d;
                  --card: #0f121b;
                  --card-inner: #141724;
                  --border: rgba(255, 255, 255, 0.08);
                  --border-focus: rgba(225, 29, 72, 0.45);
                  --text: #f3f4f6;
                  --text-muted: #9ca3af;
                  --text-sub: #64748b;
                  --primary: #e11d48;
                  --primary-hover: #be123c;
                  --primary-gradient: linear-gradient(135deg, #e11d48 0%, #be123c 60%, #9f1239 100%);
                  --accent: #d97706;
                  --read-color: #06b6d4;
                  --read-bg: rgba(6, 182, 212, 0.12);
                  --read-border: rgba(6, 182, 212, 0.3);
                  --write-color: #f59e0b;
                  --write-bg: rgba(245, 158, 11, 0.12);
                  --write-border: rgba(245, 158, 11, 0.3);
                }

                * { box-sizing: border-box; margin: 0; padding: 0; }

                body {
                  background-color: var(--bg);
                  background-image:
                    radial-gradient(circle at 50% 0%, rgba(225, 29, 72, 0.12), transparent 45%),
                    radial-gradient(circle at 90% 90%, rgba(217, 119, 6, 0.06), transparent 35%);
                  color: var(--text);
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  min-height: 100vh;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  padding: 24px 16px;
                  overflow-x: hidden;
                }

                .auth-wrapper {
                  max-width: 480px;
                  width: 100%;
                }

                .card {
                  background: var(--card);
                  border: 1px solid var(--border);
                  border-radius: 20px;
                  padding: 32px;
                  box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(225, 29, 72, 0.1);
                  position: relative;
                }

                /* Header bar */
                .header-bar {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding-bottom: 20px;
                  border-bottom: 1px solid var(--border);
                  margin-bottom: 24px;
                }

                .brand-group {
                  display: flex;
                  align-items: center;
                  gap: 12px;
                }

                .brand-title {
                  font-family: 'Cormorant Garamond', Georgia, serif;
                  font-size: 1.55rem;
                  font-weight: 700;
                  letter-spacing: 0.12em;
                  color: #fff;
                  line-height: 1;
                }

                .brand-tagline {
                  font-size: 0.68rem;
                  letter-spacing: 0.22em;
                  text-transform: uppercase;
                  color: #94a3b8;
                  margin-top: 4px;
                }

                /* Language Switcher */
                .lang-switcher {
                  display: flex;
                  background: rgba(255, 255, 255, 0.04);
                  border: 1px solid var(--border);
                  border-radius: 9999px;
                  padding: 2px;
                  gap: 2px;
                }

                .lang-pill {
                  background: transparent;
                  border: none;
                  color: var(--text-muted);
                  font-size: 0.72rem;
                  font-weight: 600;
                  padding: 4px 8px;
                  border-radius: 9999px;
                  cursor: pointer;
                  transition: all 0.15s ease;
                }

                .lang-pill:hover {
                  color: var(--text);
                }

                .lang-pill.active {
                  background: var(--primary);
                  color: #fff;
                }

                /* Client Box */
                .client-box {
                  background: var(--card-inner);
                  border: 1px solid rgba(255, 255, 255, 0.06);
                  border-radius: 14px;
                  padding: 16px;
                  display: flex;
                  align-items: flex-start;
                  gap: 14px;
                  margin-bottom: 20px;
                }

                .client-icon-wrapper {
                  width: 44px;
                  height: 44px;
                  border-radius: 12px;
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px solid var(--border);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: #fca5a5;
                  flex-shrink: 0;
                }

                .client-info-meta {
                  flex: 1;
                  min-width: 0;
                }

                .client-headline {
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  flex-wrap: wrap;
                  margin-bottom: 4px;
                }

                .client-name {
                  font-size: 1.05rem;
                  font-weight: 700;
                  color: #fff;
                }

                .client-brand-badge {
                  font-size: 0.68rem;
                  font-weight: 600;
                  padding: 2px 6px;
                  border-radius: 4px;
                  background: rgba(225, 29, 72, 0.15);
                  color: #fda4af;
                  border: 1px solid rgba(225, 29, 72, 0.3);
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                }

                .client-desc {
                  font-size: 0.84rem;
                  color: var(--text-muted);
                  line-height: 1.4;
                  margin-bottom: 6px;
                }

                .client-host-pill {
                  display: inline-flex;
                  align-items: center;
                  gap: 4px;
                  font-size: 0.72rem;
                  color: #94a3b8;
                  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                  background: rgba(0, 0, 0, 0.25);
                  padding: 2px 6px;
                  border-radius: 4px;
                  border: 1px solid rgba(255, 255, 255, 0.04);
                }

                .client-id-raw {
                  display: none;
                }

                /* Permissions section */
                .perms-section {
                  margin-bottom: 22px;
                }

                .perms-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: 10px;
                }

                .perms-title {
                  font-size: 0.78rem;
                  font-weight: 700;
                  text-transform: uppercase;
                  letter-spacing: 0.08em;
                  color: var(--text-sub);
                }

                .perms-count {
                  font-size: 0.72rem;
                  font-weight: 600;
                  color: #94a3b8;
                  background: rgba(255, 255, 255, 0.06);
                  padding: 1px 7px;
                  border-radius: 9999px;
                }

                .scope-card {
                  background: rgba(255, 255, 255, 0.02);
                  border: 1px solid rgba(255, 255, 255, 0.05);
                  border-radius: 10px;
                  padding: 10px 12px;
                  margin-bottom: 8px;
                }

                .scope-row {
                  display: flex;
                  flex-direction: column;
                  gap: 3px;
                }

                .scope-title-group {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                }

                .scope-name {
                  font-size: 0.88rem;
                  font-weight: 600;
                  color: #f1f5f9;
                }

                .scope-badge {
                  font-size: 0.65rem;
                  font-weight: 700;
                  padding: 2px 6px;
                  border-radius: 4px;
                  letter-spacing: 0.05em;
                }

                .badge-read {
                  background: var(--read-bg);
                  color: var(--read-color);
                  border: 1px solid var(--read-border);
                }

                .badge-write {
                  background: var(--write-bg);
                  color: var(--write-color);
                  border: 1px solid var(--write-border);
                }

                .scope-desc {
                  font-size: 0.78rem;
                  color: var(--text-muted);
                  line-height: 1.35;
                }

                .scope-code {
                  font-size: 0.7rem;
                  color: #64748b;
                  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                  margin-top: 2px;
                }

                /* Google Sign In */
                .google-container {
                  margin: 20px 0 16px 0;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  gap: 8px;
                }

                .google-btn-wrapper {
                  display: flex;
                  justify-content: center;
                  width: 100%;
                  overflow: hidden;
                }

                .status-msg {
                  display: none;
                  font-size: 0.8rem;
                  color: #38bdf8;
                  text-align: center;
                }

                /* Divider */
                .divider {
                  display: flex;
                  align-items: center;
                  text-align: center;
                  margin: 18px 0;
                  color: var(--text-sub);
                  font-size: 0.74rem;
                  text-transform: uppercase;
                  letter-spacing: 0.08em;
                }

                .divider span:first-child, .divider span:last-child {
                  flex: 1;
                  border-bottom: 1px solid var(--border);
                }

                .divider span:nth-child(2) {
                  padding: 0 12px;
                }

                /* Credentials Form */
                .form-group {
                  margin-bottom: 14px;
                }

                label {
                  display: block;
                  margin-bottom: 6px;
                  font-size: 0.78rem;
                  font-weight: 600;
                  color: var(--text-muted);
                  letter-spacing: 0.02em;
                }

                .input-wrapper {
                  position: relative;
                }

                input {
                  width: 100%;
                  padding: 11px 14px;
                  border-radius: 10px;
                  background: #090a10;
                  border: 1px solid #23293d;
                  color: var(--text);
                  font-size: 0.95rem;
                  font-family: inherit;
                  transition: border-color 0.15s ease, box-shadow 0.15s ease;
                }

                input:focus {
                  outline: none;
                  border-color: var(--primary);
                  box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.2);
                }

                .password-input {
                  padding-right: 42px;
                }

                .toggle-password-btn {
                  position: absolute;
                  right: 8px;
                  top: 50%;
                  transform: translateY(-50%);
                  background: transparent;
                  border: none;
                  color: #64748b;
                  padding: 6px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border-radius: 6px;
                  transition: color 0.15s ease;
                }

                .toggle-password-btn:hover {
                  color: var(--text);
                }

                .toggle-password-btn:focus {
                  outline: 2px solid var(--primary);
                }

                /* Buttons row */
                .actions-row {
                  display: flex;
                  gap: 10px;
                  margin-top: 22px;
                }

                .btn {
                  flex: 1;
                  padding: 12px 16px;
                  border-radius: 10px;
                  font-size: 0.92rem;
                  font-weight: 600;
                  cursor: pointer;
                  border: none;
                  transition: all 0.15s ease;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 8px;
                  text-decoration: none;
                  min-height: 46px;
                }

                .btn-primary {
                  background: var(--primary-gradient);
                  color: #fff;
                  box-shadow: 0 4px 14px rgba(225, 29, 72, 0.35);
                  border: 1px solid rgba(255, 255, 255, 0.12);
                }

                .btn-primary:hover:not(:disabled) {
                  opacity: 0.94;
                  transform: translateY(-1px);
                  box-shadow: 0 6px 20px rgba(225, 29, 72, 0.45);
                }

                .btn-primary:disabled {
                  opacity: 0.65;
                  cursor: not-allowed;
                }

                .btn-secondary {
                  background: transparent;
                  color: var(--text-muted);
                  border: 1px solid rgba(255, 255, 255, 0.12);
                }

                .btn-secondary:hover {
                  background: rgba(255, 255, 255, 0.05);
                  color: var(--text);
                }

                /* Spinner */
                .spinner {
                  width: 16px;
                  height: 16px;
                  border: 2px solid rgba(255, 255, 255, 0.3);
                  border-top-color: #fff;
                  border-radius: 50%;
                  animation: spin 0.8s linear infinite;
                }

                @keyframes spin {
                  to { transform: rotate(360deg); }
                }

                /* Trust Footer */
                .trust-footer {
                  margin-top: 20px;
                  padding-top: 16px;
                  border-top: 1px solid var(--border);
                  text-align: center;
                  font-size: 0.74rem;
                  color: var(--text-sub);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 6px;
                }

                @media (max-width: 480px) {
                  .card { padding: 24px 18px; border-radius: 16px; }
                  .actions-row { flex-direction: column; }
                  .brand-title { font-size: 1.35rem; }
                }
              </style>
            </head>
            <body>
              <div class="auth-wrapper">
                <main class="card" role="main">
                  <!-- Header with PlacePrep branding & Language Switcher -->
                  <div class="header-bar">
                    <div class="brand-group">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="40" height="40" aria-hidden="true" style="flex-shrink:0;">
                        <defs>
                          <linearGradient id="sigil-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#e11d48"/>
                            <stop offset="100%" stop-color="#d97706"/>
                          </linearGradient>
                        </defs>
                        <rect x="4" y="4" width="56" height="56" rx="16" fill="#12141e" stroke="#4c1d24" stroke-width="2"/>
                        <path d="M20 46V18h16.5c7 0 11.5 3.8 11.5 10.1 0 6.5-4.7 10.5-12 10.5H28.5V46H20Z" fill="url(#sigil-grad)"/>
                        <path d="M28.5 32.1h7.1c3.2 0 4.9-1.5 4.9-4 0-2.6-1.7-4-4.9-4h-7.1v8Z" fill="#12141e" opacity="0.85"/>
                      </svg>
                      <div>
                        <div class="brand-title">PLACEPREP</div>
                        <div class="brand-tagline" data-i18n="tagline">Focus. Discipline. Growth.</div>
                      </div>
                    </div>

                    <!-- Client-side instant language switcher -->
                    <div class="lang-switcher" role="radiogroup" aria-label="Language selection">
                      <button type="button" class="lang-pill active" data-lang="en" onclick="setLanguage('en')">EN</button>
                      <button type="button" class="lang-pill" data-lang="ta" onclick="setLanguage('ta')">தமிழ்</button>
                      <button type="button" class="lang-pill" data-lang="hi" onclick="setLanguage('hi')">हिन्दी</button>
                    </div>
                  </div>

                  <!-- Client Request Info Box -->
                  <div class="client-box">
                    <div class="client-icon-wrapper">
                      {{CLIENT_ICON}}
                    </div>
                    <div class="client-info-meta">
                      <div class="client-headline">
                        <span class="client-name">{{CLIENT_NAME}}</span>
                        <span class="client-brand-badge">{{CLIENT_BADGE}}</span>
                      </div>
                      <div class="client-desc">
                        <span data-i18n="client_requests_access">is requesting authorization to connect with your PlacePrep account.</span>
                      </div>
                      <div class="client-host-pill" title="Target callback origin">
                        <span data-i18n="callback_label">Callback:</span>
                        <span>{{CLIENT_HOST}}</span>
                      </div>
                      <span class="client-id-raw">{{RAW_CLIENT_ID}}</span>
                    </div>
                  </div>

                  <!-- Requested Scopes -->
                  <div class="perms-section">
                    <div class="perms-header">
                      <span class="perms-title" data-i18n="perms_header">Requested Permissions</span>
                      <span class="perms-count">{{SCOPES_COUNT}}</span>
                    </div>
                    <div class="scopes-list">
                      {{SCOPES_HTML}}
                    </div>
                  </div>

                  <!-- Google OAuth Button -->
                  <div class="google-container">
                    <div id="g_id_onload"
                         data-client_id="{{GOOGLE_CLIENT_ID}}"
                         data-context="signin"
                         data-callback="handleGoogleCredential"
                         data-auto_prompt="false">
                    </div>
                    <div class="google-btn-wrapper">
                      <div class="g_id_signin"
                           data-type="standard"
                           data-shape="rectangular"
                           data-theme="filled_black"
                           data-text="signin_with"
                           data-size="large"
                           data-logo_alignment="left"
                           data-width="416">
                      </div>
                    </div>
                    <div id="google-status" class="status-msg" role="status" aria-live="polite"></div>
                  </div>

                  <div class="divider">
                    <span></span>
                    <span data-i18n="divider_or_password">or sign in with password</span>
                    <span></span>
                  </div>

                  <!-- Hidden form for Google OAuth submit -->
                  <form id="google-consent-form" method="post" action="/oauth/consent" style="display:none;">
                    <input type="hidden" name="transaction_id" value="{{TX_ID}}">
                    <input type="hidden" name="decision" value="approve">
                    <input type="hidden" id="google-credential-input" name="google_credential" value="">
                  </form>

                  <!-- Standard Email & Password Form -->
                  <form method="post" action="/oauth/consent" id="auth-form">
                    <input type="hidden" name="transaction_id" value="{{TX_ID}}">
                    
                    <div class="form-group">
                      <label for="identifier" data-i18n="label_identifier">Email or Username</label>
                      <input id="identifier" name="identifier" autocomplete="username" placeholder="student@example.com" required>
                    </div>

                    <div class="form-group">
                      <label for="password" data-i18n="label_password">Password</label>
                      <div class="input-wrapper">
                        <input id="password" name="password" type="password" class="password-input" autocomplete="current-password" placeholder="••••••••" required>
                        <button type="button" id="toggle-password" class="toggle-password-btn" aria-label="Toggle password visibility" title="Toggle password visibility">
                          <svg id="eye-show" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          <svg id="eye-hide" style="display:none;" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        </button>
                      </div>
                    </div>

                    <div class="actions-row">
                      <button type="submit" name="decision" value="approve" id="btn-approve" class="btn btn-primary">
                        <span data-i18n="btn_authorize">Authorize Connector</span>
                      </button>
                      <button type="submit" name="decision" value="reject" id="btn-cancel" class="btn btn-secondary">
                        <span data-i18n="btn_cancel">Cancel</span>
                      </button>
                    </div>
                  </form>

                  <!-- Trust & Security Footer -->
                  <div class="trust-footer">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span data-i18n="trust_note">Secured via OAuth 2.1 • PKCE S256 • Scoped Bearer Token</span>
                  </div>
                </main>
              </div>

              <script>
                const i18n = {
                  en: {
                    tagline: "Focus. Discipline. Growth.",
                    client_requests_access: "is requesting authorization to connect with your PlacePrep account.",
                    callback_label: "Callback:",
                    perms_header: "Requested Permissions",
                    read_badge: "READ",
                    write_badge: "WRITE",
                    scope_tasks_read_title: "Tasks",
                    scope_tasks_read_desc: "View your tasks, milestones, and daily schedule",
                    scope_tasks_write_title: "Task Management",
                    scope_tasks_write_desc: "Create, update, reschedule, and complete tasks",
                    scope_progress_read_title: "Preparation Progress",
                    scope_progress_read_desc: "View readiness diagnostics, analytics, and consistency scores",
                    scope_profile_read_title: "Account Profile",
                    scope_profile_read_desc: "View your profile information, target company tracks, and settings",
                    divider_or_password: "or sign in with password",
                    label_identifier: "Email or Username",
                    placeholder_identifier: "student@example.com",
                    label_password: "Password",
                    btn_authorize: "Authorize Connector",
                    btn_authorizing: "Authorizing...",
                    btn_cancel: "Cancel",
                    google_verifying: "Verifying Google authentication...",
                    trust_note: "Secured via OAuth 2.1 • PKCE S256 • Scoped Bearer Token"
                  },
                  ta: {
                    tagline: "கவனம். ஒழுக்கம். வளர்ச்சி.",
                    client_requests_access: "உங்கள் PlacePrep கணக்கை அணுக அனுமதி கோருகிறது.",
                    callback_label: "திரும்பும் முகவரி:",
                    perms_header: "கோரப்பட்ட அனுமதிகள்",
                    read_badge: "பார்வை",
                    write_badge: "மாற்று",
                    scope_tasks_read_title: "பணிகள்",
                    scope_tasks_read_desc: "உங்கள் பணிகள், மைல்கற்கள் மற்றும் தினசரி அட்டவணையைப் பார்க்கவும்",
                    scope_tasks_write_title: "பணி மேலாண்மை",
                    scope_tasks_write_desc: "உங்கள் பணிகளை உருவாக்கவும், புதுப்பிக்கவும், நிர்வகிக்கவும்",
                    scope_progress_read_title: "தயாரிப்பு முன்னேற்றம்",
                    scope_progress_read_desc: "உங்கள் பகுப்பாய்வு, தொடர்ச்சி மற்றும் தயார்நிலை அளவீடுகளைப் பார்க்கவும்",
                    scope_profile_read_title: "சுயவிவரம்",
                    scope_profile_read_desc: "உங்கள் சுயவிவர தகவல் மற்றும் இலக்கு பணிகளைப் பார்க்கவும்",
                    divider_or_password: "அல்லது கடவுச்சொல் மூலம் உள்நுழைக",
                    label_identifier: "மின்னஞ்சல் அல்லது பயனர்பெயர்",
                    placeholder_identifier: "student@example.com",
                    label_password: "கடவுச்சொல்",
                    btn_authorize: "இணைப்பியை அங்கீகரி",
                    btn_authorizing: "அங்கீகரிக்கிறது...",
                    btn_cancel: "ரத்து செய்",
                    google_verifying: "Google உள்நுழைவு சரிபார்க்கப்படுகிறது...",
                    trust_note: "OAuth 2.1 • PKCE S256 • மறைகுறியாக்கப்பட்ட டோக்கன் மூலம் பாதுகாப்பானது"
                  },
                  hi: {
                    tagline: "फोकस. अनुशासन. विकास.",
                    client_requests_access: "आपके PlacePrep खाते तक पहुँचने की अनुमति का अनुरोध कर रहा है.",
                    callback_label: "कॉलबैक:",
                    perms_header: "अनुरोधित अनुमतियाँ",
                    read_badge: "पठन",
                    write_badge: "लेखन",
                    scope_tasks_read_title: "कार्य",
                    scope_tasks_read_desc: "अपने कार्य, मील के पत्थर और दैनिक कार्यक्रम देखें",
                    scope_tasks_write_title: "कार्य प्रबंधन",
                    scope_tasks_write_desc: "अपने कार्य बनाएं, अपडेट करें और प्रबंधित करें",
                    scope_progress_read_title: "तैयारी प्रगति",
                    scope_progress_read_desc: "अपने एनालिटिक्स, स्ट्रीक और तैयारी मेट्रिक्स देखें",
                    scope_profile_read_title: "खाता प्रोफ़ाइल",
                    scope_profile_read_desc: "अपनी प्रोफ़ाइल जानकारी और लक्ष्य ट्रैक देखें",
                    divider_or_password: "या पासवर्ड से साइन इन करें",
                    label_identifier: "ईमेल या यूज़रनेम",
                    placeholder_identifier: "student@example.com",
                    label_password: "पासवर्ड",
                    btn_authorize: "कनेक्टर अधिकृत करें",
                    btn_authorizing: "अधिकृत हो रहा है...",
                    btn_cancel: "रद्द करें",
                    google_verifying: "Google साइन-इन सत्यापित किया जा रहा है...",
                    trust_note: "OAuth 2.1 • PKCE S256 • एन्क्रिप्टेड टोकन द्वारा सुरक्षित"
                  }
                };

                let currentLang = 'en';

                function setLanguage(lang) {
                  if (!i18n[lang]) lang = 'en';
                  currentLang = lang;
                  try { localStorage.setItem('placeprep.ui-language', lang); } catch (e) {}

                  document.querySelectorAll('.lang-pill').forEach(btn => {
                    btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
                  });

                  const dict = i18n[lang];
                  document.querySelectorAll('[data-i18n]').forEach(el => {
                    const key = el.getAttribute('data-i18n');
                    if (dict[key]) {
                      el.textContent = dict[key];
                    }
                  });

                  const ident = document.getElementById('identifier');
                  if (ident && dict.placeholder_identifier) {
                    ident.placeholder = dict.placeholder_identifier;
                  }
                }

                // Initialize language preference
                (function() {
                  let saved = 'en';
                  try {
                    saved = localStorage.getItem('placeprep.ui-language') || 'en';
                  } catch (e) {}
                  if (saved === 'tamil') saved = 'ta';
                  if (saved === 'hindi') saved = 'hi';
                  if (saved === 'english') saved = 'en';
                  if (saved !== 'en' && saved !== 'ta' && saved !== 'hi') saved = 'en';
                  setLanguage(saved);
                })();

                // Password toggle
                const toggleBtn = document.getElementById('toggle-password');
                const pwdInput = document.getElementById('password');
                const eyeShow = document.getElementById('eye-show');
                const eyeHide = document.getElementById('eye-hide');

                if (toggleBtn && pwdInput) {
                  toggleBtn.addEventListener('click', function() {
                    const isPwd = pwdInput.type === 'password';
                    pwdInput.type = isPwd ? 'text' : 'password';
                    eyeShow.style.display = isPwd ? 'none' : 'block';
                    eyeHide.style.display = isPwd ? 'block' : 'none';
                  });
                }

                // Form submit handler with double-submit guard
                const authForm = document.getElementById('auth-form');
                const approveBtn = document.getElementById('btn-approve');
                const cancelBtn = document.getElementById('btn-cancel');

                if (authForm && approveBtn) {
                  authForm.addEventListener('submit', function(e) {
                    if (document.activeElement === cancelBtn) return;
                    if (!authForm.checkValidity()) return;

                    approveBtn.disabled = true;
                    const dict = i18n[currentLang] || i18n.en;
                    approveBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> <span>' + dict.btn_authorizing + '</span>';
                  });
                }

                // Google callback handler
                function handleGoogleCredential(response) {
                  if (response && response.credential) {
                    const statusEl = document.getElementById('google-status');
                    const dict = i18n[currentLang] || i18n.en;
                    if (statusEl) {
                      statusEl.textContent = dict.google_verifying;
                      statusEl.style.display = 'block';
                    }
                    document.getElementById('google-credential-input').value = response.credential;
                    document.getElementById('google-consent-form').submit();
                  }
                }
              </script>
            </body>
            </html>
            """;
    }

    private String renderErrorHtml(String title, String message) {
        String template = """
            <!doctype html>
            <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
              <title>{{TITLE}} - PlacePrep</title>
              <link rel="icon" type="image/svg+xml" href="/logo.svg">
              <link rel="preconnect" href="https://fonts.googleapis.com">
              <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
              <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
              <style>
                :root {
                  --bg: #07080d;
                  --card: #0f121b;
                  --border: rgba(255, 255, 255, 0.08);
                  --text: #f3f4f6;
                  --text-muted: #9ca3af;
                  --primary: #e11d48;
                  --primary-gradient: linear-gradient(135deg, #e11d48 0%, #be123c 60%, #9f1239 100%);
                }

                * { box-sizing: border-box; margin: 0; padding: 0; }

                body {
                  background-color: var(--bg);
                  background-image:
                    radial-gradient(circle at 50% 0%, rgba(225, 29, 72, 0.12), transparent 45%);
                  color: var(--text);
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  min-height: 100vh;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  padding: 24px 16px;
                }

                .card {
                  background: var(--card);
                  border: 1px solid var(--border);
                  border-radius: 20px;
                  padding: 36px 32px;
                  max-width: 460px;
                  width: 100%;
                  text-align: center;
                  box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(225, 29, 72, 0.1);
                }

                .brand-header {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 10px;
                  margin-bottom: 24px;
                }

                .brand-title {
                  font-family: 'Cormorant Garamond', Georgia, serif;
                  font-size: 1.45rem;
                  font-weight: 700;
                  letter-spacing: 0.12em;
                  color: #fff;
                }

                .error-icon-box {
                  width: 56px;
                  height: 56px;
                  border-radius: 16px;
                  background: rgba(225, 29, 72, 0.12);
                  border: 1px solid rgba(225, 29, 72, 0.3);
                  color: #fb7185;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin: 0 auto 18px auto;
                }

                h1 {
                  font-size: 1.25rem;
                  font-weight: 700;
                  color: #fff;
                  margin-bottom: 10px;
                }

                p {
                  color: var(--text-muted);
                  font-size: 0.92rem;
                  line-height: 1.5;
                  margin-bottom: 24px;
                }

                button {
                  width: 100%;
                  padding: 12px 20px;
                  border-radius: 10px;
                  border: none;
                  font-weight: 600;
                  font-size: 0.95rem;
                  cursor: pointer;
                  background: var(--primary-gradient);
                  color: #fff;
                  box-shadow: 0 4px 14px rgba(225, 29, 72, 0.35);
                  transition: all 0.15s ease;
                }

                button:hover {
                  opacity: 0.94;
                  transform: translateY(-1px);
                }

                .footer-note {
                  margin-top: 20px;
                  font-size: 0.74rem;
                  color: #64748b;
                  border-top: 1px solid var(--border);
                  padding-top: 14px;
                }
              </style>
            </head>
            <body>
              <div class="card" role="alert">
                <div class="brand-header">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="34" height="34" aria-hidden="true">
                    <rect x="4" y="4" width="56" height="56" rx="16" fill="#12141e" stroke="#4c1d24" stroke-width="2"/>
                    <path d="M20 46V18h16.5c7 0 11.5 3.8 11.5 10.1 0 6.5-4.7 10.5-12 10.5H28.5V46H20Z" fill="#e11d48"/>
                    <path d="M28.5 32.1h7.1c3.2 0 4.9-1.5 4.9-4 0-2.6-1.7-4-4.9-4h-7.1v8Z" fill="#12141e" opacity="0.85"/>
                  </svg>
                  <div class="brand-title">PLACEPREP</div>
                </div>

                <div class="error-icon-box">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>

                <h1>{{TITLE}}</h1>
                <p>{{MESSAGE}}</p>
                <button onclick="window.history.back()">Go Back &amp; Retry</button>
                <div class="footer-note">PlacePrep Authentication Gateway</div>
              </div>
            </body>
            </html>
            """;
        return template.replace("{{TITLE}}", title != null ? title : "Authentication Error")
                       .replace("{{MESSAGE}}", message != null ? message : "An error occurred during authentication.");
    }

    @PostMapping(value = "/oauth/consent")
    public Object consent(
            @RequestParam("transaction_id") UUID transactionId,
            @RequestParam("decision") String decision,
            @RequestParam(value = "identifier", required = false) String identifier,
            @RequestParam(value = "password", required = false) String password,
            @RequestParam(value = "google_credential", required = false) String googleCredential
    ) {
        OAuthRepository.Transaction tx;
        try {
            tx = oAuthService.getTransaction(transactionId);
        } catch (Exception e) {
            return ResponseEntity.badRequest().contentType(MediaType.TEXT_HTML)
                    .body(renderErrorHtml("Authorization Session Expired", "This authorization transaction has expired or is invalid. Please restart the connector authorization in Claude or ChatGPT."));
        }

        if (!"approve".equalsIgnoreCase(decision)) {
            oAuthService.approve(transactionId, tx.userId, false);
            String url = tx.redirectUri + "?error=access_denied&error_description=" + URLEncoder.encode("The user denied the authorization request.", StandardCharsets.UTF_8);
            if (tx.externalState != null) url += "&state=" + URLEncoder.encode(tx.externalState, StandardCharsets.UTF_8);
            return new RedirectView(url);
        }

        AuthResponse authRes;
        try {
            if (googleCredential != null && !googleCredential.isBlank()) {
                authRes = authService.loginWithGoogle(googleCredential);
            } else if (identifier != null && !identifier.isBlank() && password != null && !password.isBlank()) {
                LoginRequest loginReq = new LoginRequest();
                loginReq.setIdentifier(identifier);
                loginReq.setPassword(password);
                authRes = authService.login(loginReq);
            } else {
                return ResponseEntity.badRequest().contentType(MediaType.TEXT_HTML)
                        .body(renderErrorHtml("Credentials Required", "Please sign in with Google or enter your email and password."));
            }
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "Invalid credentials";
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).contentType(MediaType.TEXT_HTML)
                    .body(renderErrorHtml("Authentication Failed", msg + ". Please go back and try again."));
        }

        try {
            oAuthService.authenticateTransaction(transactionId, authRes.getUser().getId());
            Map<String, String> approved = oAuthService.approve(transactionId, authRes.getUser().getId(), true);

            String code = approved.get("code");
            String state = approved.get("state");
            String targetUrl = tx.redirectUri + "?code=" + URLEncoder.encode(code, StandardCharsets.UTF_8);
            if (state != null) {
                targetUrl += "&state=" + URLEncoder.encode(state, StandardCharsets.UTF_8);
            }

            return new RedirectView(targetUrl);
        } catch (Exception e) {
            return ResponseEntity.badRequest().contentType(MediaType.TEXT_HTML)
                    .body(renderErrorHtml("Authorization Error", "Failed to complete authorization: " + e.getMessage()));
        }
    }

    @PostMapping(value = "/oauth/token", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> token(
            HttpServletRequest req,
            @RequestParam("grant_type") String grantType,
            @RequestParam("code") String code,
            @RequestParam("client_id") String clientId,
            @RequestParam("redirect_uri") String redirectUri,
            @RequestParam("code_verifier") String codeVerifier,
            @RequestParam(value = "resource", required = false) String resource
    ) {
        return oAuthService.exchange(req, grantType, code, clientId, redirectUri, codeVerifier, resource);
    }

    @PostMapping(value = "/oauth/token", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> tokenJson(
            HttpServletRequest req,
            @RequestBody Map<String, String> body
    ) {
        return oAuthService.exchange(
                req,
                body.get("grant_type"),
                body.get("code"),
                body.get("client_id"),
                body.get("redirect_uri"),
                body.get("code_verifier"),
                body.get("resource")
        );
    }

    @PostMapping(value = "/oauth/revoke", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> revoke(@RequestParam(value = "token", required = false) String token) {
        oAuthService.revoke(token);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping(value = "/oauth/register", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> register(
            HttpServletRequest req,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        String clientId = "chatgpt-" + UUID.randomUUID().toString().substring(0, 8);
        Map<String, Object> resp = new LinkedHashMap<>();
        if (body != null) {
            resp.putAll(body);
        }
        resp.put("client_id", clientId);
        resp.put("client_id_issued_at", System.currentTimeMillis() / 1000);
        resp.put("token_endpoint_auth_method", "none");
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    // Client SVGs
    private static final String SVG_CHATGPT = """
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.064l-4.83 2.79a4.5 4.5 0 0 1-6.15-1.647zm-1.258-9.67a4.466 4.466 0 0 1 2.34-1.972V12.2a.78.78 0 0 0 .388.676l5.839 3.37-2.02 1.168a.08.08 0 0 1-.073.006l-4.83-2.79a4.505 4.505 0 0 1-1.644-6.16zM18.84 10.3l-5.844-3.37 2.02-1.168a.076.076 0 0 1 .074-.006l4.83 2.79a4.508 4.508 0 0 1 1.64 6.164 4.47 4.47 0 0 1-2.332 1.972V10.98a.785.785 0 0 0-.388-.68zm2.946-2.883l-.142-.085-4.78-2.759a.775.775 0 0 0-.782 0L10.24 7.943V5.61a.08.08 0 0 1 .033-.064l4.83-2.79a4.5 4.5 0 0 1 6.683 4.661zm-12.64 4.135l-2.02-1.168a.08.08 0 0 1-.038-.057V4.747a4.5 4.5 0 0 1 7.37-3.453l-.142.08-4.779 2.758a.795.795 0 0 0-.391.681zm1.096 1.724l2.56-1.477 2.56 1.477v2.955l-2.56 1.477-2.56-1.477z"/></svg>
        """;

    private static final String SVG_CLAUDE = """
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M12 2a1.5 1.5 0 0 1 1.5 1.5v3.1a1.5 1.5 0 0 1-3 0V3.5A1.5 1.5 0 0 1 12 2zm6.36 3.64a1.5 1.5 0 0 1 0 2.12l-2.19 2.19a1.5 1.5 0 1 1-2.12-2.12l2.19-2.19a1.5 1.5 0 0 1 2.12 0zm3.14 7.86a1.5 1.5 0 0 1-1.5 1.5h-3.1a1.5 1.5 0 0 1 0-3h3.1a1.5 1.5 0 0 1 1.5 1.5zm-5.33 6.36a1.5 1.5 0 0 1-2.12 0l-2.19-2.19a1.5 1.5 0 1 1 2.12-2.12l2.19 2.19a1.5 1.5 0 0 1 0 2.12zm-6.67 2.14a1.5 1.5 0 0 1-1.5-1.5v-3.1a1.5 1.5 0 0 1 3 0v3.1a1.5 1.5 0 0 1-1.5 1.5zm-6.36-3.64a1.5 1.5 0 0 1 0-2.12l2.19-2.19a1.5 1.5 0 1 1 2.12 2.12l-2.19 2.19a1.5 1.5 0 0 1-2.12 0zm-2.14-6.86a1.5 1.5 0 0 1 1.5-1.5h3.1a1.5 1.5 0 0 1 0 3H3.5a1.5 1.5 0 0 1-1.5-1.5zm5.33-6.36a1.5 1.5 0 0 1 2.12 0l2.19 2.19a1.5 1.5 0 1 1-2.12 2.12l-2.19-2.19a1.5 1.5 0 0 1 0-2.12z"/></svg>
        """;

    private static final String SVG_CURSOR = """
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M4 2l16 11-7.5 1.5L8.5 22 4 2z"/></svg>
        """;

    private static final String SVG_POSTMAN = """
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.5v-5l4.5 2.5-4.5 2.5zm-2-2.5L6.5 11.5 11 9v5z"/></svg>
        """;

    private static final String SVG_DEV = """
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        """;

    private static final String SVG_GENERIC = """
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        """;
}
