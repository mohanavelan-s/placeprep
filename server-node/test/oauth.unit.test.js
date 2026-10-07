const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { pool } = require('../src/config/database');
const oauth = require('../src/services/oauth.service');
const userRepository = require('../src/repositories/user.repository');

function base64url(buffer) {
  return buffer.toString('base64url');
}

function generatePkcePair() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

test('Level 1: OAuth Unit & Security Tests', async (t) => {
  let testUser;

  t.before(async () => {
    // Create test user if not exists
    const email = `mcp-unit-test-${Date.now()}@placeprep.test`;
    testUser = await userRepository.createUser({
      name: 'MCP Unit Test User',
      email,
      username: `mcp-unit-${Date.now().toString().slice(-6)}`,
      passwordHash: '$2a$12$dummyHashForUnitTestsOnly...',
      timezone: 'Asia/Calcutta',
      role: 'user',
      tier: 'free',
    });
  });

  t.after(async () => {
    if (testUser?.id) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
  });

  await t.test('1.1: Rejects missing or non-S256 PKCE challenges', async () => {
    const mockReq = {
      query: {
        response_type: 'code',
        client_id: 'local-mcp-test',
        redirect_uri: 'http://127.0.0.1:3000/oauth/callback',
        state: 'xyz123',
        code_challenge: 'short',
        code_challenge_method: 'plain',
      },
      protocol: 'http',
      get: (h) => (h === 'host' ? '127.0.0.1:5000' : null),
    };

    await assert.rejects(
      async () => oauth.begin(mockReq),
      /PKCE code_challenge with method S256 is required/
    );
  });

  await t.test('1.2: Rejects unauthorized redirect URI or client ID', async () => {
    const { challenge } = generatePkcePair();
    const mockReq = {
      query: {
        response_type: 'code',
        client_id: 'local-mcp-test',
        redirect_uri: 'https://evil.attacker.com/callback',
        state: 'xyz123',
        code_challenge: challenge,
        code_challenge_method: 'S256',
      },
      protocol: 'http',
      get: (h) => (h === 'host' ? '127.0.0.1:5000' : null),
    };

    await assert.rejects(
      async () => oauth.begin(mockReq),
      /Invalid OAuth client or redirect URI/
    );
  });

  await t.test('1.3: Rejects invalid or unsupported scopes', async () => {
    const { challenge } = generatePkcePair();
    const mockReq = {
      query: {
        response_type: 'code',
        client_id: 'local-mcp-test',
        redirect_uri: 'http://127.0.0.1:3000/oauth/callback',
        state: 'xyz123',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        scope: 'placeprep.profile.read admin.godmode',
      },
      protocol: 'http',
      get: (h) => (h === 'host' ? '127.0.0.1:5000' : null),
    };

    await assert.rejects(
      async () => oauth.begin(mockReq),
      /Requested scope "admin.godmode" is invalid/
    );
  });

  await t.test('1.4: Server-side transaction state progression and single-use code exchange', async () => {
    const { verifier, challenge } = generatePkcePair();
    const state = 'client-random-state-42';

    const beginReq = {
      query: {
        response_type: 'code',
        client_id: 'local-mcp-test',
        redirect_uri: 'http://127.0.0.1:3000/oauth/callback',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        scope: 'placeprep.profile.read placeprep.tasks.read placeprep.tasks.write',
      },
      protocol: 'http',
      get: (h) => (h === 'host' ? '127.0.0.1:5000' : null),
    };

    // Step 1: Begin
    const tx = await oauth.begin(beginReq);
    assert.ok(tx.id, 'Transaction ID should be returned');
    assert.equal(tx.clientId, 'local-mcp-test');

    // Step 2: Authenticate transaction with user identity
    const authTx = await oauth.authenticateTransaction(tx.id, testUser.id);
    assert.equal(authTx.id, tx.id);

    // Step 3: Approve and issue authorization code
    const approval = await oauth.approve(tx.id, testUser.id, true);
    assert.ok(approval.code, 'Authorization code should be issued');
    assert.equal(approval.state, state, 'External state must be preserved untouched');
    assert.equal(approval.redirectUri, 'http://127.0.0.1:3000/oauth/callback');

    // Step 4: Token exchange with invalid verifier must fail
    const badTokenReq = {
      body: {
        grant_type: 'authorization_code',
        code: approval.code,
        client_id: 'local-mcp-test',
        redirect_uri: 'http://127.0.0.1:3000/oauth/callback',
        code_verifier: 'incorrect_verifier_value_that_fails_sha256_hash',
      },
      protocol: 'http',
      get: (h) => (h === 'host' ? '127.0.0.1:5000' : null),
    };

    await assert.rejects(
      async () => oauth.exchange(badTokenReq),
      /PKCE verification failed: invalid code_verifier/
    );

    // Step 5: Token exchange with valid verifier must succeed
    const validTokenReq = {
      body: {
        grant_type: 'authorization_code',
        code: approval.code,
        client_id: 'local-mcp-test',
        redirect_uri: 'http://127.0.0.1:3000/oauth/callback',
        code_verifier: verifier,
      },
      protocol: 'http',
      get: (h) => (h === 'host' ? '127.0.0.1:5000' : null),
    };

    const tokenRes = await oauth.exchange(validTokenReq);
    assert.ok(tokenRes.access_token, 'Access token should be issued');
    assert.equal(tokenRes.token_type, 'Bearer');
    assert.ok(tokenRes.expires_in > 0);

    // Step 6: Code single-use enforcement: replay attempt MUST be rejected
    await assert.rejects(
      async () => oauth.exchange(validTokenReq),
      /Authorization code has already been used/
    );

    // Step 7: Resolve principal from token
    const expectedResource = 'http://127.0.0.1:5000/mcp';
    const principal = await oauth.principal(tokenRes.access_token, expectedResource);
    assert.ok(principal, 'Principal must resolve from valid token');
    assert.equal(principal.userId, testUser.id, 'Principal must bind to correct user');
    assert.equal(principal.clientId, 'local-mcp-test');
    assert.ok(principal.scopes.includes('placeprep.profile.read'));

    // Step 8: Resource binding negative test: token presented for different resource must be rejected
    const foreignResourcePrincipal = await oauth.principal(tokenRes.access_token, 'https://foreign.domain/mcp');
    assert.equal(foreignResourcePrincipal, null, 'Token must be rejected on foreign resource');

    // Step 9: Token revocation
    await oauth.revoke(tokenRes.access_token);
    const revokedPrincipal = await oauth.principal(tokenRes.access_token, expectedResource);
    assert.equal(revokedPrincipal, null, 'Revoked token must be rejected');
  });

  await t.test('1.5: JWKS exports valid RS256 key configuration', async () => {
    const jwks = oauth.getJwks();
    assert.ok(Array.isArray(jwks.keys) && jwks.keys.length > 0, 'JWKS must contain keys');
    const key = jwks.keys[0];
    assert.equal(key.kty, 'RSA');
    assert.equal(key.use, 'sig');
    assert.equal(key.alg, 'RS256');
    assert.ok(key.kid, 'Key ID must be present');
    assert.ok(key.n, 'RSA modulus must be present');
    assert.ok(key.e, 'RSA exponent must be present');
  });
});
