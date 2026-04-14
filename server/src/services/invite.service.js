const { randomBytes } = require('crypto');

const env = require('../config/env');
const inviteRepository = require('../repositories/invite.repository');
const AppError = require('../utils/appError');

function normalizeInviteCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function generateInviteCode() {
  return randomBytes(6).toString('base64url').toUpperCase();
}

function buildInviteLink(code) {
  return `${env.appUrl.replace(/\/$/, '')}/invite?code=${encodeURIComponent(code)}`;
}

function getObserverAccessCode() {
  const explicitCode = normalizeInviteCode(env.bootstrapObserverInviteCode);
  if (explicitCode) {
    return explicitCode;
  }

  return normalizeInviteCode(env.bootstrapUserInviteCode);
}

function buildObserverAccessGrant(code) {
  const normalizedCode = normalizeInviteCode(code);
  const observerCode = getObserverAccessCode();

  if (!normalizedCode || !observerCode || normalizedCode !== observerCode) {
    return null;
  }

  return {
    id: null,
    code: observerCode,
    role: 'user',
    displayRole: 'observer',
    accessTier: 'observer',
    expiresAt: null,
    used: false,
    metadata: {
      bootstrap: true,
      bootstrapRole: 'observer',
      createdFrom: 'observer-access-code',
      reusable: true,
      persistent: true,
      accessTier: 'observer',
    },
  };
}

function resolveInviteStatus(invite) {
  if (!invite) {
    return 'missing';
  }

  if (invite.used && !invite.metadata?.reusable) {
    return 'used';
  }

  if (new Date(invite.expiresAt).getTime() <= Date.now()) {
    return 'expired';
  }

  return 'valid';
}

function buildInviteView(invite) {
  if (!invite) {
    return null;
  }

  const status = resolveInviteStatus(invite);

  return {
    ...invite,
    status,
    inviteLink: buildInviteLink(invite.code),
  };
}

async function previewInviteCode(code) {
  const normalizedCode = normalizeInviteCode(code);

  if (!normalizedCode) {
    return {
      code: '',
      valid: false,
      status: 'missing',
      message: 'Invite code is required.',
    };
  }

  const observerGrant = buildObserverAccessGrant(normalizedCode);
  if (observerGrant) {
    return {
      code: normalizedCode,
      valid: true,
      status: 'valid',
      role: 'observer',
      accessTier: 'observer',
      persistent: true,
      inviteLink: buildInviteLink(normalizedCode),
      message: 'Observer access accepted.',
    };
  }

  const invite = await inviteRepository.findByCode(normalizedCode);
  const status = resolveInviteStatus(invite);

  if (!invite || status !== 'valid') {
    return {
      code: normalizedCode,
      valid: false,
      status,
      message:
        status === 'used'
          ? 'This invite has already been used.'
          : status === 'expired'
            ? 'This invite has expired.'
            : 'Invite code not found.',
    };
  }

  return {
    code: normalizedCode,
    valid: true,
    status,
    role: invite.role,
    expiresAt: invite.expiresAt,
    inviteLink: buildInviteLink(normalizedCode),
    message: 'Invite code accepted.',
  };
}

async function assertInviteAvailable(code, client = null) {
  const normalizedCode = normalizeInviteCode(code);

  if (!normalizedCode) {
    throw new AppError('Invite code is required.', 400);
  }

  const observerGrant = buildObserverAccessGrant(normalizedCode);
  if (observerGrant) {
    return observerGrant;
  }

  const invite = await inviteRepository.findByCode(normalizedCode, client);
  const status = resolveInviteStatus(invite);

  if (!invite || status !== 'valid') {
    throw new AppError(
      status === 'used'
        ? 'This invite has already been used.'
        : status === 'expired'
          ? 'This invite has expired.'
          : 'Invite code not found.',
      403
    );
  }

  return invite;
}

async function generateInvite(adminUser, payload = {}) {
  const role = payload.role === 'admin' ? 'admin' : 'user';
  const expiresInDays = Math.min(Math.max(Number(payload.expiresInDays || 7), 1), 90);
  const code = normalizeInviteCode(payload.code) || generateInviteCode();
  const expiresAt = payload.expiresAt
    ? new Date(payload.expiresAt)
    : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  if (Number.isNaN(expiresAt.getTime())) {
    throw new AppError('Invite expiration is invalid.', 400);
  }

  const invite = await inviteRepository.createInvite({
    code,
    role,
    createdBy: adminUser?.id || null,
    expiresAt: expiresAt.toISOString(),
    metadata: {
      label: payload.label || null,
      createdFrom: payload.createdFrom || 'dashboard',
    },
  });

  return buildInviteView(invite);
}

async function listInvites(limit = 25) {
  const invites = await inviteRepository.listInvites(limit);
  return invites.map(buildInviteView);
}

async function markInviteUsed(inviteId, userId, client = null) {
  return inviteRepository.markInviteUsed(inviteId, userId, client);
}

function buildBootstrapInviteDefinitions() {
  const definitions = [];
  const expiresAt = new Date(Date.now() + env.bootstrapInviteExpiresDays * 24 * 60 * 60 * 1000);
  const observerCode = getObserverAccessCode();

  const adminCode = normalizeInviteCode(env.bootstrapAdminInviteCode);
  if (adminCode) {
    definitions.push({
      code: adminCode,
      role: 'admin',
      expiresAt,
      metadata: {
        bootstrap: true,
        bootstrapRole: 'admin',
        createdFrom: 'startup',
      },
    });
  }

  const userCode = normalizeInviteCode(env.bootstrapUserInviteCode);
  if (userCode && userCode !== observerCode) {
    definitions.push({
      code: userCode,
      role: 'user',
      expiresAt,
      metadata: {
        bootstrap: true,
        bootstrapRole: 'user',
        createdFrom: 'startup',
      },
    });
  }

  const legacyCode = normalizeInviteCode(env.bootstrapInviteCode);
  if (legacyCode && !definitions.some((definition) => definition.code === legacyCode)) {
    definitions.push({
      code: legacyCode,
      role: env.bootstrapInviteRole === 'admin' ? 'admin' : 'user',
      expiresAt,
      metadata: {
        bootstrap: true,
        bootstrapRole: env.bootstrapInviteRole === 'admin' ? 'admin' : 'user',
        createdFrom: 'startup',
        legacy: true,
      },
    });
  }

  return definitions;
}

async function ensureBootstrapInvites() {
  const definitions = buildBootstrapInviteDefinitions();
  if (!definitions.length) {
    return [];
  }

  const invites = [];

  for (const definition of definitions) {
    const existingInvite = await inviteRepository.findByCode(definition.code);
    if (existingInvite) {
      invites.push(buildInviteView(existingInvite));
      continue;
    }

    const invite = await inviteRepository.createInvite({
      code: definition.code,
      role: definition.role,
      expiresAt: definition.expiresAt.toISOString(),
      metadata: definition.metadata,
    });

    invites.push(buildInviteView(invite));
  }

  return invites;
}

module.exports = {
  normalizeInviteCode,
  buildInviteLink,
  previewInviteCode,
  assertInviteAvailable,
  generateInvite,
  listInvites,
  markInviteUsed,
  ensureBootstrapInvites,
};
