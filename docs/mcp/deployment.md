# PlacePrep MCP & OAuth Deployment Guide (Google Cloud Run & Vercel)

This document covers deployment configuration for the PlacePrep remote MCP server on Google Cloud Run and Vercel.

---

## 1. Environment & Secret Configuration

Set these variables and secrets in Google Cloud Run for the Spring Boot backend service:

| Variable | Target Type | Example Value | Description |
|---|---|---|---|
| `APP_PUBLIC_BASE_URL` | Environment Variable | `https://placeprep-backend-xxxx.a.run.app` | Public HTTPS origin for the backend service (determines OAuth discovery and MCP resource URL). |
| `CLIENT_URLS` | Environment Variable | `https://placeprep-nine.vercel.app` | Allowed CORS origins for frontend requests. |
| `OAUTH_KEY_ID` | Environment Variable | `placeprep-oauth-key-1` | Key identifier exposed in JWKS. |
| `OAUTH_CLIENTS` | Environment Variable | `[{"clientId":"claude-web","redirectUris":["https://claude.ai/api/mcp/oauth_callback"]},{"clientId":"chatgpt-web","redirectUris":["https://chatgpt.com/api/mcp/oauth_callback"]},{"clientId":"local-mcp-test","redirectUris":["http://127.0.0.1:3000/oauth/callback"]}]` | JSON allowlist of permitted OAuth clients and their exact callback URLs. |
| `OAUTH_PRIVATE_KEY_PEM` | Secret Manager | `placeprep-oauth-private-key:latest` | RSA 2048 private key (PKCS#8 PEM) for asymmetric RS256 token signing across instances. |

> [!IMPORTANT]
> Never commit `OAUTH_PRIVATE_KEY_PEM` to source control. In development environments without this variable, the server automatically generates an ephemeral in-memory 2048-bit RSA keypair on boot.

---

## 2. Generating Production RSA Keys for Secret Manager

To generate a dedicated PKCS#8 RS256 keypair for Cloud Run Secret Manager:

```bash
# 1. Generate 2048-bit RSA private key
openssl genpkey -algorithm RSA -out oauth_private.key -pkeyopt rsa_keygen_bits:2048

# 2. Convert to PKCS#8 PEM format
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in oauth_private.key -out oauth_private_pkcs8.pem

# 3. Create secret in Google Cloud Secret Manager
gcloud secrets create placeprep-oauth-private-key --data-file=oauth_private_pkcs8.pem

# 4. Clean up local key files
rm oauth_private.key oauth_private_pkcs8.pem
```

---

## 3. Remote MCP Endpoints on Cloud Run

Once deployed to Cloud Run, MCP clients (such as Claude Desktop, Claude Web, or ChatGPT) connect to:

- **SSE Stream**: `GET https://<cloud-run-url>/mcp`
- **JSON-RPC Messages**: `POST https://<cloud-run-url>/mcp`
- **Protected Resource Metadata**: `GET https://<cloud-run-url>/.well-known/oauth-protected-resource/mcp`
- **Authorization Server Discovery**: `GET https://<cloud-run-url>/.well-known/oauth-authorization-server`
- **JWKS Endpoint**: `GET https://<cloud-run-url>/oauth/jwks` (or alias `/.well-known/jwks.json`)

---

## 4. Local Development Tunnel (Development Only)

Temporary tunnels (e.g. ngrok) are strictly for local testing when Cloud Run is not yet deployed:

```bash
# 1. Start local tunnel for port 8080
ngrok http 8080

# 2. Configure local development environment in server/.env
MCP_PUBLIC_URL=https://your-temporary-subdomain.ngrok-free.app
```
*(Note: Cloud Run replaces all need for tunnels in staging and production).*

