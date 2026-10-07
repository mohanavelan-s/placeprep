const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/database');
const userRepository = require('../src/repositories/user.repository');

function base64url(buffer) {
  return buffer.toString('base64url');
}

function generatePkcePair() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

test('Level 2: OAuth HTTP Endpoints & Discovery Tests', async (t) => {
  let server;
  let baseUrl;
  let testUser;
  const rawPassword = 'HttpSecurePassword123!';

  t.before(async () => {
    // Create test user with bcrypt password
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const email = `mcp-http-test-${Date.now()}@placeprep.test`;
    testUser = await userRepository.createUser({
      name: 'MCP HTTP Test User',
      email,
      username: `mcp-http-${Date.now().toString().slice(-6)}`,
      passwordHash,
      timezone: 'Asia/Calcutta',
      role: 'user',
      tier: 'free',
    });

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  t.after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (testUser?.id) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
  });

  await t.test('2.1: Protected resource discovery endpoint returns correct metadata', async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.resource.endsWith('/mcp'));
    assert.ok(Array.isArray(data.authorization_servers));
    assert.deepEqual(data.bearer_methods_supported, ['header']);
    assert.ok(data.scopes_supported.includes('placeprep.profile.read'));
  });

  await t.test('2.2: Authorization server metadata returns RFC 8414 compliant discovery payload', async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.issuer);
    assert.ok(data.authorization_endpoint.endsWith('/oauth/authorize'));
    assert.ok(data.token_endpoint.endsWith('/oauth/token'));
    assert.ok(data.revocation_endpoint.endsWith('/oauth/revoke'));
    assert.ok(data.jwks_uri.endsWith('/oauth/jwks'));
    assert.deepEqual(data.code_challenge_methods_supported, ['S256']);
    assert.deepEqual(data.grant_types_supported, ['authorization_code']);
  });

  await t.test('2.3: OpenID configuration endpoint returns metadata', async () => {
    const res = await fetch(`${baseUrl}/.well-known/openid-configuration`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.authorization_endpoint);
    assert.ok(data.token_endpoint);
  });

  await t.test('2.4: JWKS endpoint returns active public signing key', async () => {
    const res = await fetch(`${baseUrl}/oauth/jwks`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.keys) && data.keys.length > 0);
    const key = data.keys[0];
    assert.equal(key.kty, 'RSA');
    assert.equal(key.alg, 'RS256');
    assert.ok(key.kid);
  });

  await t.test('2.5: Unauthenticated request to /mcp returns 401 with WWW-Authenticate header challenge', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });

    assert.equal(res.status, 401);
    const authHeader = res.headers.get('www-authenticate');
    assert.ok(authHeader && authHeader.includes('Bearer'));
    assert.ok(authHeader.includes('resource_metadata='));
    const body = await res.json();
    assert.equal(body.error?.code, -32001);
  });

  await t.test('2.6: Invalid token request to /mcp returns 401 with error="invalid_token"', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid_opaque_or_tampered_token',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });

    assert.equal(res.status, 401);
    const authHeader = res.headers.get('www-authenticate');
    assert.ok(authHeader && authHeader.includes('invalid_token'));
  });

  await t.test('2.7: Full HTTP OAuth flow: /authorize -> /consent -> /token -> /revoke', async () => {
    const { verifier, challenge } = generatePkcePair();
    const state = 'http-flow-state-99';
    const redirectUri = 'http://127.0.0.1:3000/oauth/callback';

    // 1. Authorize GET
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: 'local-mcp-test',
      redirect_uri: redirectUri,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      scope: 'placeprep.profile.read placeprep.tasks.read',
    });

    const authRes = await fetch(`${baseUrl}/oauth/authorize?${authParams}`);
    assert.equal(authRes.status, 200);
    const authHtml = await authRes.text();
    assert.ok(authHtml.includes('Authorize PlacePrep MCP Connector'));
    assert.ok(authHtml.includes('local-mcp-test'));

    // Extract transaction_id from rendered HTML form
    const match = authHtml.match(/name="transaction_id"\s+value="([^"]+)"/);
    assert.ok(match && match[1], 'Transaction ID must be in form');
    const transactionId = match[1];

    // 2. Consent POST (User approves and submits credentials)
    const consentParams = new URLSearchParams({
      transaction_id: transactionId,
      identifier: testUser.email,
      password: rawPassword,
      decision: 'approve',
    });

    const consentRes = await fetch(`${baseUrl}/oauth/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: consentParams.toString(),
      redirect: 'manual', // do not follow redirect to 3000
    });

    assert.equal(consentRes.status, 302);
    const location = consentRes.headers.get('location');
    assert.ok(location && location.startsWith(redirectUri));

    const callbackUrl = new URL(location);
    const code = callbackUrl.searchParams.get('code');
    const returnedState = callbackUrl.searchParams.get('state');
    assert.ok(code, 'Authorization code must be present in callback');
    assert.equal(returnedState, state, 'State must match original value');

    // 3. Token exchange POST
    const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: 'local-mcp-test',
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });

    assert.equal(tokenRes.status, 200);
    const tokenData = await tokenRes.json();
    assert.ok(tokenData.access_token, 'Access token must be returned');
    assert.equal(tokenData.token_type, 'Bearer');

    // 4. Revocation POST
    const revokeRes = await fetch(`${baseUrl}/oauth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenData.access_token }),
    });
    assert.equal(revokeRes.status, 200);
  });
});
