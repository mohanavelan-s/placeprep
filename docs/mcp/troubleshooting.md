# PlacePrep MCP Troubleshooting Guide

This guide details common failure modes and diagnostic steps when integrating AI clients with PlacePrep MCP.

---

## 1. Forensic Debugging Ladder

When an issue occurs with a client:

1. **Verify Reachability & Metadata**:
   ```bash
   curl -i https://<host>/.well-known/oauth-protected-resource
   curl -i https://<host>/.well-known/oauth-authorization-server
   ```
2. **Verify 401 Challenge on `/mcp`**:
   ```bash
   curl -i -X POST https://<host>/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```
   Must return HTTP 401 with `WWW-Authenticate: Bearer resource_metadata="..."`.
3. **Verify Streamable HTTP Accept Header**:
   Streamable HTTP transports return HTTP 406 (`Not Acceptable`) if the request lacks `Accept: application/json, text/event-stream`.
4. **Inspect JWKS**:
   ```bash
   curl -i https://<host>/oauth/jwks
   ```
   Ensure key ID matches the `kid` header in JWT tokens.
5. **Verify Database Connection**:
   Ensure `oauth_authorization_transactions`, `oauth_authorization_codes`, and `oauth_access_tokens` exist in PostgreSQL.

---

## 2. Common Issues & Resolutions

### Issue: "Unable to reach PlacePrep" / 401 loop in AI Client
- **Cause**: Client attempted to hit `/mcp` without initiating the OAuth flow, or the resource URL in the token does not match `OAUTH_RESOURCE`.
- **Fix**: Check that `MCP_PUBLIC_URL`, `OAUTH_ISSUER`, and `OAUTH_RESOURCE` all use the same exact public HTTPS origin (no trailing slashes).

### Issue: "Invalid OAuth client or redirect URI" (400)
- **Cause**: The client ID or redirect URI is not registered in `OAUTH_CLIENTS`.
- **Fix**: Add the client ID and exact callback URL into `OAUTH_CLIENTS` JSON in the environment.

### Issue: "PKCE verification failed: invalid code_verifier"
- **Cause**: The client hashed the verifier incorrectly or passed a plain verifier without S256 method.
- **Fix**: Ensure the client sends `code_challenge_method=S256` during `/oauth/authorize` and the raw verifier during `/oauth/token`.

### Issue: MCP App iframe clipped or cut off on mobile
- **Cause**: The iframe layout is using fixed pixel heights or the host did not receive dynamic size updates.
- **Fix**: Ensure the widget initializes `ResizeObserver` and dispatches `ui/notifications/size-changed` on DOM mutation. PlacePrep widgets have this built-in.
