const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const oauth = require('../services/oauth.service');
const authService = require('../services/auth.service');

const router = express.Router();

function authorizationServerMetadata(req) {
  const issuer = oauth.issuerFor(req);
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    jwks_uri: `${issuer}/oauth/jwks`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: oauth.supportedScopes(),
  };
}

function protectedResourceMetadata(req) {
  const resource = oauth.resourceFor(req);
  const issuer = oauth.issuerFor(req);
  return {
    resource,
    authorization_servers: [issuer],
    bearer_methods_supported: ['header'],
    scopes_supported: oauth.supportedScopes(),
    resource_documentation: `${oauth.publicBaseUrl(req)}/docs/mcp/tools.md`,
  };
}

// ── OAuth Discovery Endpoints ──────────────────────────────────────────────

router.get('/.well-known/oauth-protected-resource', (req, res) => {
  res.json(protectedResourceMetadata(req));
});

router.get('/.well-known/oauth-protected-resource/mcp', (req, res) => {
  res.json(protectedResourceMetadata(req));
});

router.get('/.well-known/oauth-authorization-server', (req, res) => {
  res.json(authorizationServerMetadata(req));
});

router.get('/.well-known/openid-configuration', (req, res) => {
  res.json(authorizationServerMetadata(req));
});

// ── JWKS Public Key Discovery ──────────────────────────────────────────────

router.get('/oauth/jwks', (req, res) => {
  res.json(oauth.getJwks());
});

// ── Authorization & Consent ────────────────────────────────────────────────

router.get('/oauth/authorize', asyncHandler(async (req, res) => {
  const tx = await oauth.begin(req);

  const scopeDescriptions = {
    'placeprep.profile.read': 'View your placement readiness profile, target role, and streak.',
    'placeprep.tasks.read': 'View your placement preparation tasks and schedule.',
    'placeprep.tasks.write': 'Create, update, or remove preparation tasks on your behalf.',
    'placeprep.progress.read': 'View your topic strengths, readiness score, and coach guidance.',
  };

  const scopeListHtml = tx.scopes
    .map((s) => `<li><strong>${s}</strong>: ${scopeDescriptions[s] || 'Access PlacePrep resource.'}</li>`)
    .join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize PlacePrep MCP Connector</title>
  <style>
    :root {
      --bg: #090d16;
      --card: #131b2e;
      --border: #23314f;
      --text: #f1f5f9;
      --muted: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --danger: #ef4444;
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
      border-radius: 12px;
      padding: 32px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    h1 {
      margin-top: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text);
    }
    p {
      color: var(--muted);
      line-height: 1.5;
      font-size: 0.95rem;
    }
    .client-badge {
      display: inline-block;
      background: rgba(59, 130, 246, 0.15);
      color: #93c5fd;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.9rem;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    ul {
      padding-left: 20px;
      color: var(--muted);
      font-size: 0.9rem;
      line-height: 1.6;
    }
    strong {
      color: var(--text);
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      margin-bottom: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    input {
      width: 100%;
      padding: 10px 12px;
      border-radius: 6px;
      background: #0b1120;
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 1rem;
      box-sizing: border-box;
    }
    input:focus {
      outline: none;
      border-color: var(--primary);
    }
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }
    button {
      flex: 1;
      padding: 12px;
      border-radius: 6px;
      border: none;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .btn-primary {
      background: var(--primary);
      color: #fff;
    }
    .btn-primary:hover {
      background: var(--primary-hover);
    }
    .btn-secondary {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--muted);
    }
    .btn-secondary:hover {
      background: rgba(255,255,255,0.05);
      color: var(--text);
    }
    .notice {
      font-size: 0.8rem;
      color: var(--muted);
      margin-top: 20px;
      border-top: 1px solid var(--border);
      padding-top: 16px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize PlacePrep MCP Connector</h1>
    <p>The client <span class="client-badge">${tx.clientId}</span> is requesting permission to act on behalf of your PlacePrep account.</p>

    <p><strong>Permissions requested:</strong></p>
    <ul>
      ${scopeListHtml}
    </ul>

    <form method="post" action="/oauth/consent">
      <input type="hidden" name="transaction_id" value="${tx.id}">
      <div class="form-group">
        <label for="identifier">Email or Username</label>
        <input id="identifier" name="identifier" autocomplete="username" required autofocus placeholder="student@example.com">
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required placeholder="••••••••">
      </div>
      <div class="actions">
        <button type="submit" name="decision" value="approve" class="btn-primary">Sign In &amp; Authorize</button>
        <button type="submit" name="decision" value="reject" class="btn-secondary">Cancel</button>
      </div>
    </form>
    <div class="notice">
      Protected with PKCE S256 &bull; User-scoped bearer token
    </div>
  </div>
</body>
</html>`;

  res.type('html').send(html);
}));

router.post('/oauth/consent', asyncHandler(async (req, res) => {
  const transactionId = String(req.body.transaction_id || '').trim();
  const decision = String(req.body.decision || '').trim();

  if (!transactionId) {
    res.status(400).type('html').send('<h3>Missing authorization transaction.</h3>');
    return;
  }

  const tx = await oauth.getTransaction(transactionId);

  if (decision !== 'approve') {
    await oauth.approve(transactionId, tx.userId, false);
    const location = new URL(tx.redirectUri);
    location.searchParams.set('error', 'access_denied');
    location.searchParams.set('error_description', 'The user denied the authorization request.');
    if (tx.state) location.searchParams.set('state', tx.state);
    res.redirect(302, location.toString());
    return;
  }

  const identifier = String(req.body.identifier || '').trim();
  const password = String(req.body.password || '').trim();

  if (!identifier || !password) {
    res.status(400).type('html').send('<h3>Please provide both email/username and password.</h3>');
    return;
  }

  // Authenticate human with PlacePrep identity system
  const session = await authService.login({ identifier, password });

  // Bind human identity to OAuth transaction
  await oauth.authenticateTransaction(transactionId, session.user.id);

  // Approve and issue single-use authorization code
  const result = await oauth.approve(transactionId, session.user.id, true);

  const location = new URL(result.redirectUri);
  location.searchParams.set('code', result.code);
  if (result.state) {
    location.searchParams.set('state', result.state);
  }

  res.redirect(302, location.toString());
}));

router.post('/oauth/token', asyncHandler(async (req, res) => {
  const tokenResponse = await oauth.exchange(req);
  res.json(tokenResponse);
}));

router.post('/oauth/revoke', asyncHandler(async (req, res) => {
  const token = String(req.body?.token || req.query?.token || '').trim();
  await oauth.revoke(token);
  // RFC 7009: Revocation endpoint responds with 200 OK
  res.status(200).json({ success: true });
}));

// ── MCP Endpoint ───────────────────────────────────────────────────────────

router.all('/mcp', asyncHandler(async (req, res) => {
  const { handleMcpRequest } = await import('../mcp/handler.mjs');
  await handleMcpRequest(req, res);
}));

module.exports = router;
