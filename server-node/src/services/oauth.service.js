const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query, withTransaction } = require('../config/database');
const AppError = require('../utils/appError');

const SCOPES = new Set([
  'placeprep.profile.read',
  'placeprep.tasks.read',
  'placeprep.tasks.write',
  'placeprep.progress.read',
]);

const DEFAULT_SCOPES = ['placeprep.profile.read', 'placeprep.tasks.read'];
const TX_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const hash = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

// In-memory stable keypair fallback if OAUTH_PRIVATE_KEY_PEM is not provided in env.
let activeKeyPair = null;

function getKeyPair() {
  if (activeKeyPair) {
    return activeKeyPair;
  }

  const kid = process.env.OAUTH_KEY_ID || 'placeprep-oauth-key-1';

  if (process.env.OAUTH_PRIVATE_KEY_PEM) {
    const privPem = process.env.OAUTH_PRIVATE_KEY_PEM.replace(/\\n/g, '\n');
    const privateKey = crypto.createPrivateKey(privPem);
    const publicKey = crypto.createPublicKey(privateKey);
    const jwk = publicKey.export({ format: 'jwk' });
    activeKeyPair = {
      kid,
      privateKey: privPem,
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
      jwk: {
        kty: jwk.kty,
        use: 'sig',
        alg: 'RS256',
        kid,
        n: jwk.n,
        e: jwk.e,
      },
    };
    return activeKeyPair;
  }

  // Generate ephemeral 2048-bit RSA keypair
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
  const jwk = publicKey.export({ format: 'jwk' });

  activeKeyPair = {
    kid,
    privateKey: privPem,
    publicKey: pubPem,
    jwk: {
      kty: jwk.kty,
      use: 'sig',
      alg: 'RS256',
      kid,
      n: jwk.n,
      e: jwk.e,
    },
  };
  return activeKeyPair;
}

function getJwks() {
  const { jwk } = getKeyPair();
  return {
    keys: [jwk],
  };
}

function supportedScopes() {
  return [...SCOPES];
}

function clients() {
  try {
    const parsed = JSON.parse(process.env.OAUTH_CLIENTS || '[]');
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    // fall through
  }

  // Default predefined test client for local development
  return [
    {
      clientId: 'local-mcp-test',
      redirectUris: [
        'http://127.0.0.1:3000/oauth/callback',
        'http://localhost:3000/oauth/callback',
        'https://oauth.pstmn.io/v1/callback',
      ],
    },
  ];
}

function clientFor(id, redirectUri) {
  const clientList = clients();
  const client = clientList.find((item) => item.clientId === id);
  if (!client || !Array.isArray(client.redirectUris) || !client.redirectUris.includes(redirectUri)) {
    throw new AppError('Invalid OAuth client or redirect URI.', 400);
  }
  return client;
}

function publicBaseUrl(req) {
  const configured = String(process.env.MCP_PUBLIC_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  return `${proto}://${req.get('host')}`;
}

function issuerFor(req) {
  const configured = String(process.env.OAUTH_ISSUER || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  return publicBaseUrl(req);
}

function resourceFor(req) {
  const configured = String(process.env.OAUTH_RESOURCE || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  return `${publicBaseUrl(req)}/mcp`;
}

function parseScopes(scope) {
  if (!scope || !String(scope).trim()) {
    return DEFAULT_SCOPES;
  }
  const scopes = String(scope).trim().split(/\s+/).filter(Boolean);
  if (!scopes.length) {
    return DEFAULT_SCOPES;
  }
  for (const item of scopes) {
    if (!SCOPES.has(item)) {
      throw new AppError(`Requested scope "${item}" is invalid.`, 400);
    }
  }
  return [...new Set(scopes)];
}

function assertPkce(challenge, method) {
  if (!challenge || !/^[A-Za-z0-9_-]{43,128}$/.test(challenge) || method !== 'S256') {
    throw new AppError('PKCE code_challenge with method S256 is required.', 400);
  }
}

async function begin(req) {
  const p = req.query || {};
  if (p.response_type !== 'code') {
    throw new AppError('Unsupported response_type. Must be "code".', 400);
  }
  if (!p.client_id || !p.redirect_uri || !p.state) {
    throw new AppError('Missing required OAuth parameter: client_id, redirect_uri, or state.', 400);
  }

  clientFor(p.client_id, p.redirect_uri);
  assertPkce(p.code_challenge, p.code_challenge_method);

  const expectedResource = resourceFor(req);
  if (p.resource && p.resource.replace(/\/$/, '') !== expectedResource) {
    throw new AppError(`Requested resource "${p.resource}" does not match server resource "${expectedResource}".`, 400);
  }

  const id = crypto.randomUUID();
  const scopes = parseScopes(p.scope);
  const expiresAt = new Date(Date.now() + TX_TTL_MS);

  await query(
    `INSERT INTO oauth_authorization_transactions (id, client_id, redirect_uri, scopes, resource, code_challenge, external_state, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, p.client_id, p.redirect_uri, scopes, expectedResource, p.code_challenge, p.state, expiresAt]
  );

  return { id, clientId: p.client_id, scopes, resource: expectedResource };
}

async function getTransaction(id) {
  const result = await query(
    `SELECT id, client_id AS "clientId", user_id AS "userId", redirect_uri AS "redirectUri",
            scopes, resource, external_state AS "state", status, expires_at AS "expiresAt"
     FROM oauth_authorization_transactions
     WHERE id = $1`,
    [id]
  );
  const tx = result.rows[0];
  if (!tx || new Date(tx.expiresAt) <= new Date()) {
    throw new AppError('Authorization transaction has expired or is invalid.', 400);
  }
  return tx;
}

async function authenticateTransaction(id, userId) {
  const result = await query(
    `UPDATE oauth_authorization_transactions
     SET user_id = $2, status = 'pending_consent'
     WHERE id = $1 AND status = 'pending_authentication' AND expires_at > NOW()
     RETURNING id, client_id AS "clientId", scopes, resource`,
    [id, userId]
  );
  if (!result.rows[0]) {
    throw new AppError('Authorization transaction is expired or in an invalid state.', 400);
  }
  return result.rows[0];
}

async function approve(id, userId, approved) {
  return withTransaction(async (db) => {
    const result = await db.query(
      `SELECT * FROM oauth_authorization_transactions WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const tx = result.rows[0];
    if (!tx || tx.user_id !== userId || tx.status !== 'pending_consent' || new Date(tx.expires_at) <= new Date()) {
      throw new AppError('Authorization transaction is expired or invalid.', 400);
    }

    if (!approved) {
      await db.query(
        `UPDATE oauth_authorization_transactions SET status = 'rejected', completed_at = NOW() WHERE id = $1`,
        [id]
      );
      return { rejected: true, redirectUri: tx.redirect_uri, state: tx.external_state };
    }

    const code = crypto.randomBytes(32).toString('base64url');
    const codeId = crypto.randomUUID();
    const codeExpiresAt = new Date(Date.now() + CODE_TTL_MS);

    await db.query(
      `INSERT INTO oauth_authorization_codes (id, transaction_id, code_hash, user_id, client_id, redirect_uri, resource, scopes, code_challenge, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [codeId, id, hash(code), tx.user_id, tx.client_id, tx.redirect_uri, tx.resource, tx.scopes, tx.code_challenge, codeExpiresAt]
    );

    await db.query(
      `UPDATE oauth_authorization_transactions SET status = 'code_issued', completed_at = NOW() WHERE id = $1`,
      [id]
    );

    return { code, redirectUri: tx.redirect_uri, state: tx.external_state };
  });
}

async function exchange(req) {
  const { grant_type, code, client_id, redirect_uri, code_verifier, resource } = req.body || {};

  if (grant_type !== 'authorization_code') {
    throw new AppError('Unsupported grant_type. Must be "authorization_code".', 400);
  }
  if (!code || !client_id || !redirect_uri || !code_verifier) {
    throw new AppError('Token request is missing required parameters (code, client_id, redirect_uri, code_verifier).', 400);
  }

  clientFor(client_id, redirect_uri);

  const verifierHash = crypto.createHash('sha256').update(code_verifier).digest('base64url');

  return withTransaction(async (db) => {
    const result = await db.query(
      `SELECT * FROM oauth_authorization_codes WHERE code_hash = $1 FOR UPDATE`,
      [hash(code)]
    );
    const row = result.rows[0];

    if (!row) {
      throw new AppError('Authorization code is invalid.', 400);
    }
    if (row.used_at) {
      throw new AppError('Authorization code has already been used.', 400);
    }
    if (new Date(row.expires_at) <= new Date()) {
      throw new AppError('Authorization code has expired.', 400);
    }
    if (row.client_id !== client_id || row.redirect_uri !== redirect_uri) {
      throw new AppError('Client ID or redirect URI does not match authorization code.', 400);
    }

    if (resource && resource.replace(/\/$/, '') !== row.resource) {
      throw new AppError('Target resource does not match authorized resource.', 400);
    }

    const expectedChallengeBuffer = Buffer.from(row.code_challenge);
    const providedVerifierBuffer = Buffer.from(verifierHash);
    if (
      expectedChallengeBuffer.length !== providedVerifierBuffer.length ||
      !crypto.timingSafeEqual(expectedChallengeBuffer, providedVerifierBuffer)
    ) {
      throw new AppError('PKCE verification failed: invalid code_verifier.', 400);
    }

    // Mark single-use code as used immediately
    await db.query(`UPDATE oauth_authorization_codes SET used_at = NOW() WHERE id = $1`, [row.id]);

    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    const keyPair = getKeyPair();
    const issuer = issuerFor(req);

    const tokenPayload = {
      iss: issuer,
      sub: row.user_id,
      aud: row.resource,
      client_id: row.client_id,
      scope: row.scopes.join(' '),
      jti: tokenId,
    };

    const accessToken = jwt.sign(tokenPayload, keyPair.privateKey, {
      algorithm: 'RS256',
      keyid: keyPair.kid,
      expiresIn: Math.floor(TOKEN_TTL_MS / 1000),
    });

    await db.query(
      `INSERT INTO oauth_access_tokens (id, token_hash, user_id, client_id, resource, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tokenId, hash(accessToken), row.user_id, row.client_id, row.resource, row.scopes, expiresAt]
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: Math.floor(TOKEN_TTL_MS / 1000),
      scope: row.scopes.join(' '),
    };
  });
}

async function principal(token, expectedResource, requiredScope = null) {
  if (!token) return null;

  const keyPair = getKeyPair();
  let decoded;
  try {
    decoded = jwt.verify(token, keyPair.publicKey, {
      algorithms: ['RS256'],
    });
  } catch {
    return null;
  }

  // Audience / Resource validation
  const tokenAudience = String(decoded.aud || '').replace(/\/$/, '');
  const cleanExpected = String(expectedResource || '').replace(/\/$/, '');
  if (tokenAudience !== cleanExpected) {
    return null;
  }

  // Check revocation and expiration in database
  const tokenId = decoded.jti;
  const tokenHash = hash(token);
  const result = await query(
    `SELECT id, user_id, client_id, resource, scopes, expires_at, revoked_at
     FROM oauth_access_tokens
     WHERE (id = $1 OR token_hash = $2) AND revoked_at IS NULL AND expires_at > NOW()`,
    [tokenId, tokenHash]
  );
  const row = result.rows[0];
  if (!row) return null;

  const scopes = Array.isArray(row.scopes) ? row.scopes : (decoded.scope || '').split(/\s+/).filter(Boolean);

  if (requiredScope && !scopes.includes(requiredScope)) {
    return null;
  }

  return {
    userId: row.user_id,
    clientId: row.client_id,
    scopes,
    resource: row.resource,
    tokenId: row.id,
  };
}

async function revoke(token) {
  if (!token) return;

  const keyPair = getKeyPair();
  let tokenId = null;
  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.jti) {
      tokenId = decoded.jti;
    }
  } catch {
    // ignore decode error
  }

  const tokenHash = hash(token);
  if (tokenId) {
    await query(
      `UPDATE oauth_access_tokens SET revoked_at = NOW() WHERE (id = $1 OR token_hash = $2) AND revoked_at IS NULL`,
      [tokenId, tokenHash]
    );
  } else {
    await query(
      `UPDATE oauth_access_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash]
    );
  }
}

module.exports = {
  supportedScopes,
  publicBaseUrl,
  issuerFor,
  resourceFor,
  getJwks,
  getKeyPair,
  begin,
  getTransaction,
  authenticateTransaction,
  approve,
  exchange,
  principal,
  revoke,
};
