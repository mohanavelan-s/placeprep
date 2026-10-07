# PlacePrep MCP Testing Guide

This document details the multi-tiered test suite for PlacePrep OAuth, MCP Server, and MCP Apps.

---

## 1. Test Levels

| Level | File | Role | Verification Target |
|---|---|---|---|
| **Level 1** | `server/test/oauth.unit.test.js` | Unit & Security | PKCE S256 verification, state management, transaction lifecycle, code single-use & expiry, RS256 JWKS export, audience/resource binding, scope validation, token revocation. |
| **Level 2** | `server/test/oauth.http.test.js` | HTTP Endpoints | RFC 9470 protected resource discovery, RFC 8414 authorization server discovery, OpenID config, JWKS endpoint, 401 WWW-Authenticate challenge, browser consent redirect, token exchange, token revocation. |
| **Level 3** | `server/test/mcp.protocol.test.js` | Protocol & Tools | Streamable HTTP transport handshake, `tools/list` catalogue & schemas, `resources/list`, `resources/read`, all tool executions (`get_profile`, `task_setup`, `create_task`, `update_task_status`, `delete_task`, `prep_dashboard_view`), cross-user authorization negative tests, placeholder input rejection. |
| **Level 4** | `server/test/ext-apps.reference.test.js` | Ext-Apps Reference | Widget compliance with `@modelcontextprotocol/ext-apps` 2026-01-26 specification, `ui://` resource MIME types (`text/html;profile=mcp-app`), `ui/initialize` handshake, size notifications, postMessage bridge dispatch. |
| **Level 5** | Real Clients | Manual Acceptance | Real client testing on ChatGPT Web/Android and Claude Web/Android using persistent HTTPS deployment. |

---

## 2. Running Automated Tests

Run the complete test suite from the `server/` directory:

```bash
cd server
npm test
```

To run individual test levels:

```bash
# Level 1: OAuth Unit & Security
node --test test/oauth.unit.test.js

# Level 2: HTTP Discovery & Endpoints
node --test test/oauth.http.test.js

# Level 3: MCP Protocol & Tools
node --test test/mcp.protocol.test.js

# Level 4: MCP Apps Reference
node --test test/ext-apps.reference.test.js
```

---

## 3. Negative Security Tests Included

- **PKCE downgrade attempt**: Supplying `code_challenge_method=plain` is rejected with HTTP 400.
- **PKCE verifier tampering**: Submitting an invalid `code_verifier` during token exchange is rejected.
- **Code replay attack**: Re-exchanging an already consumed authorization code is rejected with HTTP 400.
- **Cross-resource token presentation**: Presenting an access token issued for resource A against resource B is rejected.
- **Cross-user access attempt**: User B attempting to read (`get_task`) or delete (`delete_task`) a task created by User A is rejected with 404 / access denied.
- **Placeholder input rejection**: Submitting synthetic placeholder titles like `"New task"` or `"Task"` to `create_task` is rejected.
- **Token revocation**: A revoked token presented to `/mcp` is immediately rejected with HTTP 401.
