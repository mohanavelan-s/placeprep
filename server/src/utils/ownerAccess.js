const env = require('../config/env');

const OWNER_TIER = 'college';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isOwnerEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  return Boolean(normalizedEmail && env.ownerEmails.includes(normalizedEmail));
}

function isAndroidPublisherEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  return Boolean(normalizedEmail && env.androidPublisherEmails.includes(normalizedEmail));
}

function isAndroidPublisherUser(user) {
  return Boolean(user && isAndroidPublisherEmail(user.email));
}

function buildOwnerCoachMetadata(coachMetadata = {}) {
  return {
    ...(isPlainObject(coachMetadata) ? coachMetadata : {}),
    accessTier: 'standard',
    owner: true,
  };
}

function applyOwnerAccess(user) {
  if (!user || !isOwnerEmail(user.email)) {
    return user;
  }

  return {
    ...user,
    role: 'admin',
    tier: OWNER_TIER,
    accessTier: 'standard',
    coachMetadata: buildOwnerCoachMetadata(user.coachMetadata),
  };
}

module.exports = {
  OWNER_TIER,
  applyOwnerAccess,
  buildOwnerCoachMetadata,
  isAndroidPublisherEmail,
  isAndroidPublisherUser,
  isOwnerEmail,
  normalizeEmail,
};
