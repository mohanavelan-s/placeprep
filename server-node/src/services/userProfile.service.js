const userProfileRepository = require('../repositories/userProfile.repository');

function buildDefaultProfile(userId) {
  return {
    id: null,
    userId,
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
  const existingProfile = await userProfileRepository.findByUserId(user.id);

  if (existingProfile) {
    return existingProfile;
  }

  try {
    return await userProfileRepository.createProfile({
      userId: user.id,
    });
  } catch (error) {
    if (error?.code === '23505') {
      const profile = await userProfileRepository.findByUserId(user.id);
      if (profile) {
        return profile;
      }
    }

    if (error?.code !== '23503') {
      throw error;
    }
  }

  return buildDefaultProfile(user.id);
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
