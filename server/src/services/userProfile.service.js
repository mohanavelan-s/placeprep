const userProfileRepository = require('../repositories/userProfile.repository');

function normalizeUrl(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!value) {
    return null;
  }

  return String(value).trim();
}

function normalizeBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  return Boolean(value);
}

function normalizePermission(value) {
  if (value === undefined) {
    return undefined;
  }

  return value ? String(value) : 'default';
}

async function getProfile(user) {
  const profile = await userProfileRepository.findByUserId(user.id);

  if (profile) {
    return profile;
  }

  return {
    id: null,
    userId: user.id,
    linkedinUrl: null,
    githubUrl: null,
    leetcodeUrl: null,
    portfolioUrl: null,
    resumeUrl: null,
    avatarUrl: null,
    notificationsEnabled: true,
    notificationEmailEnabled: true,
    notificationBrowserEnabled: false,
    notificationBrowserPermission: 'default',
    createdAt: null,
    updatedAt: null,
  };
}

async function upsertProfile(user, payload) {
  return userProfileRepository.upsertProfile({
    userId: user.id,
    linkedinUrl: normalizeUrl(payload.linkedinUrl),
    githubUrl: normalizeUrl(payload.githubUrl),
    leetcodeUrl: normalizeUrl(payload.leetcodeUrl),
    portfolioUrl: normalizeUrl(payload.portfolioUrl),
    resumeUrl: normalizeUrl(payload.resumeUrl),
    avatarUrl: normalizeUrl(payload.avatarUrl),
    notificationsEnabled: normalizeBoolean(payload.notificationsEnabled, undefined),
    notificationEmailEnabled: normalizeBoolean(payload.notificationEmailEnabled, undefined),
    notificationBrowserEnabled: normalizeBoolean(payload.notificationBrowserEnabled, undefined),
    notificationBrowserPermission: normalizePermission(payload.notificationBrowserPermission),
  });
}

module.exports = {
  getProfile,
  upsertProfile,
};
