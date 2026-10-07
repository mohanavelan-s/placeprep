# PlacePrep MCP Acceptance Matrix

This matrix tracks empirical test evidence across every layer of the integration. Per critical engineering principles, no layer is marked PASS without concrete evidence.

---

## Acceptance Test Matrix

| Layer | Checkpoint | Verification Method | Status | Evidence / Notes |
|---|---|---|---|---|
| **OAuth** | Protected Resource Metadata | Automated HTTP test `test/oauth.http.test.js:2.1` | **PASS** | HTTP 200, returns resource `.../mcp`, `authorization_servers`, `bearer_methods_supported: ['header']`. |
| **OAuth** | Authorization Server Metadata | Automated HTTP test `test/oauth.http.test.js:2.2` | **PASS** | HTTP 200, RFC 8414 metadata with S256 code challenge method and JWKS URI. |
| **OAuth** | OpenID Configuration Discovery | Automated HTTP test `test/oauth.http.test.js:2.3` | **PASS** | HTTP 200, compatible discovery alias. |
| **OAuth** | PKCE S256 Enforcement | Automated Unit test `test/oauth.unit.test.js:1.1` | **PASS** | Rejects plain or invalid challenges; verifies S256 verifier with timing-safe comparison. |
| **OAuth** | Client & Redirect URI Validation | Automated Unit test `test/oauth.unit.test.js:1.2` | **PASS** | Rejects unregistered clients and untrusted redirect URIs. |
| **OAuth** | Server-side Transaction Lifecycle | Automated Unit test `test/oauth.unit.test.js:1.4` | **PASS** | Transitions `pending_authentication` -> `pending_consent` -> `code_issued`. Prevents tampering. |
| **OAuth** | Code Single-Use & Expiry | Automated Unit test `test/oauth.unit.test.js:1.4` | **PASS** | Replay attack test fails with "Authorization code has already been used". |
| **OAuth** | JWKS Public Key Endpoint | Automated HTTP test `test/oauth.http.test.js:2.4` | **PASS** | Returns active RS256 key with matching `kid`. |
| **OAuth** | Token Revocation (RFC 7009) | Automated HTTP test `test/oauth.http.test.js:2.7` | **PASS** | Revoked token is invalidated in database; subsequent requests rejected. |
| **OAuth** | Audience & Resource Binding | Automated Unit test `test/oauth.unit.test.js:1.4` | **PASS** | Negative test: token presented for different resource is rejected with `null` principal. |
| **MCP** | 401 Unauthenticated Challenge | Automated HTTP test `test/oauth.http.test.js:2.5` | **PASS** | HTTP 401 with `WWW-Authenticate: Bearer resource_metadata="..."`. |
| **MCP** | Invalid Token Challenge | Automated HTTP test `test/oauth.http.test.js:2.6` | **PASS** | HTTP 401 with `error="invalid_token"`. |
| **MCP** | Streamable HTTP Handshake | Automated Protocol test `test/mcp.protocol.test.js:3.1` | **PASS** | `initialize` responds with server info and protocol capabilities. |
| **MCP** | tools/list Complete Catalogue | Automated Protocol test `test/mcp.protocol.test.js:3.2` | **PASS** | Returns all 9 tools with descriptions, Zod schemas, and `_meta.ui` metadata. |
| **MCP** | resources/list & resources/read | Automated Protocol test `test/mcp.protocol.test.js:3.3` | **PASS** | Returns valid HTML with MIME type `text/html;profile=mcp-app`. |
| **MCP** | tools/call User Scope Derivation | Automated Protocol test `test/mcp.protocol.test.js:3.4` | **PASS** | `get_profile` returns data matching authenticated token principal. |
| **MCP** | Task Setup & Review Flow | Automated Protocol test `test/mcp.protocol.test.js:3.5` | **PASS** | Returns draft task structure and non-UI text fallback. |
| **MCP** | Narrow Mutation & Synthetic Rejection | Automated Protocol test `test/mcp.protocol.test.js:3.6` | **PASS** | Rejects `"New task"` placeholder; persists confirmed task to database. |
| **MCP** | Cross-User Ownership Isolation | Automated Protocol test `test/mcp.protocol.test.js:3.9` | **PASS** | Negative test: User B cannot read or delete User A's task. |
| **MCP** | Explicit Task Deletion | Automated Protocol test `test/mcp.protocol.test.js:3.10` | **PASS** | Explicitly deletes task; verifies task no longer exists. |
| **MCP Apps** | Widget Specification Compliance | Automated Reference test `test/ext-apps.reference.test.js:4.1` | **PASS** | HTML includes `ui/initialize`, `ui/notifications/initialized`, and size-change reporting. |
| **MCP Apps** | Bridge Tool Invocation | Automated Reference test `test/ext-apps.reference.test.js:4.3` | **PASS** | Widget script formats and dispatches `callServerTool` over postMessage. |
| **Client** | ChatGPT Web | Real Client Live Test | **Pending Deployment** | Requires stable HTTPS Railway endpoint registration. |
| **Client** | ChatGPT Android | Real Client Live Test | **Pending Deployment** | Requires stable HTTPS Railway endpoint registration. |
| **Client** | Claude Web | Real Client Live Test | **Pending Deployment** | Requires stable HTTPS Railway endpoint registration. |
| **Client** | Claude Android | Real Client Live Test | **Pending Deployment** | Requires stable HTTPS Railway endpoint registration. |
