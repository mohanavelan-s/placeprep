package com.placeprep.controller;

import com.placeprep.dto.AuthResponse;
import com.placeprep.dto.LoginRequest;
import com.placeprep.repository.OAuthRepository;
import com.placeprep.service.AuthService;
import com.placeprep.service.OAuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
public class OAuthController {

    private final OAuthService oAuthService;
    private final AuthService authService;

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

    @org.springframework.beans.factory.annotation.Value("${placeprep.auth.google-client-id:142236988060-7stjhr2uo0nj92h94b5bds92t2qlqakp.apps.googleusercontent.com}")
    private String googleClientId;

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

        StringBuilder scopeHtml = new StringBuilder();
        for (String sc : tx.scopes) {
            scopeHtml.append("<li><strong>").append(sc).append("</strong>: Access PlacePrep resource.</li>");
        }

        return String.format("""
            <!doctype html>
            <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Authorize PlacePrep MCP Connector</title>
              <link rel="icon" type="image/svg+xml" href="/logo.svg">
              <script src="https://accounts.google.com/gsi/client" async defer></script>
              <style>
                :root {
                  --bg: #090c15;
                  --card: #111524;
                  --border: #3b1818;
                  --text: #f1f5f9;
                  --muted: #94a3b8;
                  --primary: #d44b4b;
                  --primary-hover: #b83d3d;
                  --badge-bg: rgba(212, 75, 75, 0.15);
                  --badge-text: #fca5a5;
                  --badge-border: rgba(212, 75, 75, 0.35);
                }
                body {
                  margin: 0;
                  padding: 24px;
                  background: var(--bg);
                  color: var(--text);
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  box-sizing: border-box;
                }
                .card {
                  background: var(--card);
                  border: 1px solid var(--border);
                  border-radius: 16px;
                  padding: 36px;
                  max-width: 480px;
                  width: 100%%;
                  box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 40px rgba(212, 75, 75, 0.08);
                }
                .brand-header {
                  display: flex;
                  align-items: center;
                  gap: 14px;
                  margin-bottom: 24px;
                  padding-bottom: 20px;
                  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
                }
                .brand-title {
                  font-size: 1.5rem;
                  font-weight: 800;
                  color: #f1f5f9;
                  letter-spacing: -0.02em;
                  line-height: 1.1;
                }
                .brand-tagline {
                  font-size: 0.75rem;
                  letter-spacing: 0.22em;
                  text-transform: uppercase;
                  color: #94a3b8;
                  margin-top: 4px;
                }
                h1 { margin: 0 0 10px 0; font-size: 1.35rem; font-weight: 700; color: #fff; }
                p { color: var(--muted); line-height: 1.5; font-size: 0.95rem; margin: 10px 0; }
                .client-badge {
                  display: inline-block;
                  background: var(--badge-bg);
                  color: var(--badge-text);
                  padding: 4px 10px;
                  border-radius: 6px;
                  font-weight: 600;
                  font-size: 0.88rem;
                  border: 1px solid var(--badge-border);
                }
                ul { padding-left: 20px; color: var(--muted); font-size: 0.9rem; line-height: 1.6; }
                strong { color: var(--text); }
                .google-section {
                  margin: 24px 0 16px 0;
                  display: flex;
                  justify-content: center;
                }
                .divider {
                  display: flex;
                  align-items: center;
                  text-align: center;
                  margin: 20px 0;
                  color: #64748b;
                  font-size: 0.78rem;
                  text-transform: uppercase;
                  letter-spacing: 0.08em;
                }
                .divider span:first-child, .divider span:last-child {
                  flex: 1;
                  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                }
                .divider span:nth-child(2) {
                  padding: 0 12px;
                }
                .form-group { margin-bottom: 16px; }
                label { display: block; margin-bottom: 6px; font-size: 0.85rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
                input {
                  width: 100%%;
                  padding: 12px 14px;
                  border-radius: 8px;
                  background: #080a10;
                  border: 1px solid #282f45;
                  color: var(--text);
                  font-size: 1rem;
                  box-sizing: border-box;
                  transition: border-color 0.15s ease;
                }
                input:focus { outline: none; border-color: var(--primary); }
                .actions { display: flex; gap: 12px; margin-top: 24px; }
                button {
                  flex: 1;
                  padding: 13px;
                  border-radius: 8px;
                  border: none;
                  font-weight: 600;
                  font-size: 0.95rem;
                  cursor: pointer;
                  transition: all 0.15s ease;
                }
                .btn-primary {
                  background: linear-gradient(135deg, #d44b4b 0%%, #b88a43 100%%);
                  color: #fff;
                  box-shadow: 0 4px 14px rgba(212, 75, 75, 0.35);
                }
                .btn-primary:hover { opacity: 0.92; transform: translateY(-1px); }
                .btn-secondary { background: transparent; border: 1px solid #282f45; color: var(--muted); }
                .btn-secondary:hover { background: rgba(255,255,255,0.05); color: var(--text); }
                .notice { font-size: 0.8rem; color: var(--muted); margin-top: 22px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; text-align: center; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="brand-header">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48" style="flex-shrink:0;">
                    <defs>
                      <linearGradient id="placeprep-auth-favicon" x1="0%%" y1="0%%" x2="100%%" y2="100%%">
                        <stop offset="0%%" stop-color="#d44b4b" />
                        <stop offset="100%%" stop-color="#b88a43" />
                      </linearGradient>
                    </defs>
                    <rect x="4" y="4" width="56" height="56" rx="18" fill="#111116" stroke="#662626" />
                    <path d="M20 46V18h16.5c7 0 11.5 3.8 11.5 10.1 0 6.5-4.7 10.5-12 10.5H28.5V46H20Z" fill="url(#placeprep-auth-favicon)" />
                    <path d="M28.5 32.1h7.1c3.2 0 4.9-1.5 4.9-4 0-2.6-1.7-4-4.9-4h-7.1v8Z" fill="#111116" opacity="0.75" />
                  </svg>
                  <div>
                    <div class="brand-title">PlacePrep</div>
                    <div class="brand-tagline">Focus. Discipline. Growth.</div>
                  </div>
                </div>

                <h1>Authorize MCP Connector</h1>
                <p>The client <span class="client-badge">%s</span> is requesting permission to act on behalf of your PlacePrep account.</p>

                <p><strong>Permissions requested:</strong></p>
                <ul>%s</ul>

                <!-- Google OAuth Sign In Button -->
                <div class="google-section">
                  <div id="g_id_onload"
                       data-client_id="%s"
                       data-context="signin"
                       data-callback="handleGoogleCredential"
                       data-auto_prompt="false">
                  </div>
                  <div class="g_id_signin"
                       data-type="standard"
                       data-shape="rectangular"
                       data-theme="filled_black"
                       data-text="signin_with"
                       data-size="large"
                       data-logo_alignment="left"
                       data-width="408">
                  </div>
                </div>

                <div class="divider">
                  <span></span>
                  <span>or sign in with password</span>
                  <span></span>
                </div>

                <!-- Hidden form for Google OAuth submit -->
                <form id="google-consent-form" method="post" action="/oauth/consent" style="display:none;">
                  <input type="hidden" name="transaction_id" value="%s">
                  <input type="hidden" name="decision" value="approve">
                  <input type="hidden" id="google-credential-input" name="google_credential" value="">
                </form>

                <!-- Standard Email & Password Form -->
                <form method="post" action="/oauth/consent">
                  <input type="hidden" name="transaction_id" value="%s">
                  <div class="form-group">
                    <label for="identifier">Email or Username</label>
                    <input id="identifier" name="identifier" autocomplete="username" placeholder="student@example.com">
                  </div>
                  <div class="form-group">
                    <label for="password">Password</label>
                    <input id="password" name="password" type="password" autocomplete="current-password" placeholder="••••••••">
                  </div>
                  <div class="actions">
                    <button type="submit" name="decision" value="approve" class="btn-primary">Sign In &amp; Authorize</button>
                    <button type="submit" name="decision" value="reject" class="btn-secondary">Cancel</button>
                  </div>
                </form>

                <script>
                  function handleGoogleCredential(response) {
                    if (response && response.credential) {
                      document.getElementById("google-credential-input").value = response.credential;
                      document.getElementById("google-consent-form").submit();
                    }
                  }
                </script>

                <div class="notice">Protected with PKCE S256 &bull; User-scoped bearer token</div>
              </div>
            </body>
            </html>
            """, tx.clientId, scopeHtml.toString(), googleClientId, tx.id, tx.id);
    }

    private String renderErrorHtml(String title, String message) {
        return String.format("""
            <!doctype html>
            <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>%s - PlacePrep</title>
              <link rel="icon" type="image/svg+xml" href="/logo.svg">
              <style>
                :root {
                  --bg: #090c15;
                  --card: #111524;
                  --border: #3b1818;
                  --text: #f1f5f9;
                  --muted: #94a3b8;
                  --primary: #d44b4b;
                }
                body {
                  margin: 0;
                  padding: 24px;
                  background: var(--bg);
                  color: var(--text);
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  box-sizing: border-box;
                }
                .card {
                  background: var(--card);
                  border: 1px solid var(--border);
                  border-radius: 16px;
                  padding: 36px;
                  max-width: 480px;
                  width: 100%%;
                  text-align: center;
                  box-shadow: 0 20px 40px rgba(0,0,0,0.6);
                }
                h1 { margin: 0 0 12px 0; font-size: 1.35rem; font-weight: 700; color: #f87171; }
                p { color: var(--muted); line-height: 1.6; font-size: 0.95rem; margin: 16px 0 24px 0; }
                button {
                  padding: 12px 24px;
                  border-radius: 8px;
                  border: none;
                  font-weight: 600;
                  font-size: 0.95rem;
                  cursor: pointer;
                  background: linear-gradient(135deg, #d44b4b 0%%, #b88a43 100%%);
                  color: #fff;
                }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>%s</h1>
                <p>%s</p>
                <button onclick="window.history.back()">Go Back &amp; Retry</button>
              </div>
            </body>
            </html>
            """, title, title, message);
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
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED).contentType(MediaType.TEXT_HTML)
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
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED).body(resp);
    }
}
