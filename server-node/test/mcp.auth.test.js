const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/config/database');
const userRepository = require('../src/repositories/user.repository');
const oauth = require('../src/services/oauth.service');

function base64url(buffer) {
  return buffer.toString('base64url');
}

function generatePkcePair() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

async function getAccessTokenForUser(user, baseUrl) {
  const { verifier, challenge } = generatePkcePair();
  const tx = await oauth.begin({
    query: {
      response_type: 'code',
      client_id: 'local-mcp-test',
      redirect_uri: 'http://127.0.0.1:3000/oauth/callback',
      state: 'mcp-auth-test-state',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      scope: 'placeprep.profile.read placeprep.tasks.read',
    },
    protocol: 'http',
    get: (h) => (h === 'host' ? new URL(baseUrl).host : null),
  });

  await oauth.authenticateTransaction(tx.id, user.id);
  const approval = await oauth.approve(tx.id, user.id, true);

  const tokenRes = await oauth.exchange({
    body: {
      grant_type: 'authorization_code',
      code: approval.code,
      client_id: 'local-mcp-test',
      redirect_uri: 'http://127.0.0.1:3000/oauth/callback',
      code_verifier: verifier,
    },
    protocol: 'http',
    get: (h) => (h === 'host' ? new URL(baseUrl).host : null),
  });

  return tokenRes.access_token;
}

async function parseMcpResponse(res) {
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/data:\s*({.+})/);
    if (match && match[1]) {
      return JSON.parse(match[1]);
    }
    return { raw };
  }
}

test('Level 3: MCP Gateway & Authentication Enforcement', async (t) => {
  let server;
  let baseUrl;
  let testUser;
  let validAccessToken;

  t.before(async () => {
    const passwordHash = await bcrypt.hash('SecureMcpPassword123!', 10);
    const email = `mcp-gateway-test-${Date.now()}@placeprep.test`;
    testUser = await userRepository.createUser({
      name: 'MCP Gateway Tester',
      email,
      username: `mcp-gateway-${Date.now().toString().slice(-6)}`,
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

    validAccessToken = await getAccessTokenForUser(testUser, baseUrl);
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

  await t.test('3.1: Rejects unauthenticated request with RFC 9470 WWW-Authenticate challenge', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });

    assert.equal(res.status, 401);
    const authHeader = res.headers.get('www-authenticate');
    assert.ok(authHeader && authHeader.includes('Bearer'));
    assert.ok(authHeader.includes('resource_metadata='));
    const body = await parseMcpResponse(res);
    assert.equal(body.error?.code, -32001);
  });

  await t.test('3.2: Rejects invalid or tampered token with error="invalid_token"', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer invalid.opaque.or.tampered.token',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });

    assert.equal(res.status, 401);
    const authHeader = res.headers.get('www-authenticate');
    assert.ok(authHeader && authHeader.includes('invalid_token'));
  });

  await t.test('3.3: Rejects PlacePrep internal symmetric HS256 JWT at /mcp', async () => {
    // Generate PlacePrep internal login JWT using symmetric HMAC
    const secret = process.env.JWT_SECRET || 'dev_secret_key_12345';
    const internalJwt = jwt.sign(
      { id: testUser.id, email: testUser.email, role: testUser.role },
      secret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${internalJwt}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });

    // Must be rejected with 401: Internal HS256 tokens are strictly forbidden at /mcp
    assert.equal(res.status, 401);
    const authHeader = res.headers.get('www-authenticate');
    assert.ok(authHeader && authHeader.includes('invalid_token'));
  });

  await t.test('3.4: Rejects revoked OAuth access token at /mcp', async () => {
    // Generate dedicated token to revoke
    const tokenToRevoke = await getAccessTokenForUser(testUser, baseUrl);

    // Revoke token
    await oauth.revoke(tokenToRevoke);

    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${tokenToRevoke}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });

    assert.equal(res.status, 401);
    const authHeader = res.headers.get('www-authenticate');
    assert.ok(authHeader && authHeader.includes('invalid_token'));
  });

  await t.test('3.5: Accepts valid RS256 OAuth access token and completes MCP initialize', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${validAccessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 5,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });

    assert.equal(res.status, 200);
    const body = await parseMcpResponse(res);
    assert.equal(body.jsonrpc, '2.0');
    assert.equal(body.id, 5);
    assert.ok(body.result);
    assert.equal(body.result.serverInfo?.name, 'PlacePrep MCP');
    assert.equal(body.result.serverInfo?.version, '0.1.0');
    // Closed-by-default verification: Server advertises empty capabilities
    assert.deepEqual(body.result.capabilities, {});
  });

  await t.test('3.6: Phase 2 closed-by-default boundary: tools/list returns method not found error', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${validAccessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/list',
      }),
    });

    assert.equal(res.status, 200);
    const body = await parseMcpResponse(res);
    assert.equal(body.jsonrpc, '2.0');
    assert.equal(body.id, 6);
    // Closed-by-default verification: zero tools exposed, tools capability not enabled
    assert.ok(body.error);
    assert.equal(body.error.code, -32601);
  });
});
