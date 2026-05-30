const bcrypt = require('bcryptjs');

const env = require('../config/env');
const { withTransaction } = require('../config/database');
const userProfileRepository = require('../repositories/userProfile.repository');
const userRepository = require('../repositories/user.repository');
const { sendInviteSignupAlertEmail, sendWelcomeEmail } = require('./email.service');
const inviteService = require('./invite.service');
const AppError = require('../utils/appError');
const { signAccessToken } = require('../utils/jwt');

function normalizeUsername(value) {
  if (!value) {
    return null;
  }

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return normalized || null;
}

async function ensureUniqueUsername(username, currentUserId = null) {
  if (!username) {
    return null;
  }

  const existingUser = await userRepository.findByUsername(username);
  if (existingUser && existingUser.id !== currentUserId) {
    throw new AppError('That username is already taken.', 409);
  }

  return username;
}

async function buildAvailableUsername(input, fallbackSeed) {
  const preferred = normalizeUsername(input) || normalizeUsername(fallbackSeed);
  if (!preferred) {
    return null;
  }

  const directMatch = await userRepository.findByUsername(preferred);
  if (!directMatch) {
    return preferred;
  }

  for (let index = 2; index <= 200; index += 1) {
    const candidate = `${preferred}-${index}`.slice(0, 60);
    const existingUser = await userRepository.findByUsername(candidate);
    if (!existingUser) {
      return candidate;
    }
  }

  return `${preferred}-${Date.now().toString().slice(-4)}`.slice(0, 60);
}

function triggerNotificationEmailSync(userId, source) {
  const timer = setTimeout(() => {
    const notificationService = require('./notification.service');
    void notificationService.syncNotificationsForUser(userId, {
      source,
      deliverEmail: true,
      processDeliveryNow: true,
    }).catch((error) => {
      console.error(`[auth] ${source} notification email sync failed.`, error);
    });
  }, 0);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
}

async function register(payload) {
  const email = payload.email.trim().toLowerCase();
  const existingUser = await userRepository.findByEmail(email);

  if (existingUser) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const username = payload.username
    ? await ensureUniqueUsername(normalizeUsername(payload.username))
    : await buildAvailableUsername(payload.name, email.split('@')[0]);
  const passwordHash = await bcrypt.hash(payload.password, 12);

  const registration = await withTransaction(async (client) => {
    const invite = payload.inviteCode
      ? await inviteService.assertInviteAvailable(payload.inviteCode, client)
      : null;
    const accessTier = invite?.accessTier === 'observer' ? 'observer' : 'standard';
    const tier = invite ? 'college' : 'free';

    const createdUser = await userRepository.createUser({
      name: payload.name.trim(),
      username,
      role: invite?.role === 'admin' ? 'admin' : 'user',
      email,
      passwordHash,
      weakAreas: payload.weakAreas || [],
      targetRole: payload.targetRole || null,
      placementDate: payload.placementDate || null,
      timezone: payload.timezone || env.defaultTimezone,
      tier,
      planGenerations: 0,
      mentorMessages: 0,
      coachMetadata: accessTier === 'observer'
        ? {
            accessTier: 'observer',
          }
        : {},
    }, client);

    await userProfileRepository.createProfile({
      userId: createdUser.id,
    }, client);

    if (invite?.id) {
      await inviteService.markInviteUsed(invite.id, createdUser.id, client);
    }

    return {
      user: createdUser,
      invite,
    };
  });
  const { user, invite } = registration;

  const emailJobs = [
    {
      label: 'welcome email',
      run: () => sendWelcomeEmail({ user }),
    },
  ];

  if (invite) {
    emailJobs.push({
      label: 'invite signup alert email',
      run: () => sendInviteSignupAlertEmail({ user, invite }),
    });
  }

  const emailResults = await Promise.allSettled(
    emailJobs.map((job) => job.run())
  );

  emailResults.forEach((result, index) => {
    const job = emailJobs[index];

    if (result.status === 'rejected') {
      console.error(`[auth] ${job.label} dispatch failed.`, result.reason);
      return;
    }

    if (result.value?.attempted && !result.value.sent) {
      console.error(`[auth] ${job.label} was not sent.`, result.value.reason);
    }
  });

  return {
    token: signAccessToken(user),
    user,
  };
}

async function login(payload) {
  const identifier = String(payload.identifier || payload.email || '').trim();
  const user = await userRepository.findByIdentifier(identifier);

  if (!user) {
    throw new AppError('Invalid username/email or password.', 401);
  }

  const isPasswordValid = await bcrypt.compare(payload.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError('Invalid username/email or password.', 401);
  }

  const loggedInUser = await userRepository.touchLastLogin(user.id) || user;
  const { passwordHash, ...safeUser } = loggedInUser;
  triggerNotificationEmailSync(safeUser.id, 'login_email_sync');

  return {
    token: signAccessToken(safeUser),
    user: safeUser,
  };
}

async function getProfile(userId) {
  const user = await userRepository.findById(userId);

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  return user;
}

async function updateProfile(userId, updates) {
  const normalizedUpdates = {
    ...updates,
  };

  if (updates.username !== undefined) {
    const username = normalizeUsername(updates.username);
    if (!username) {
      throw new AppError('Username must contain letters, numbers, dot, underscore, or hyphen.', 400);
    }
    normalizedUpdates.username = await ensureUniqueUsername(username, userId);
  }

  if (updates.preferredLanguage !== undefined) {
    const existingUser = await userRepository.findById(userId);
    if (!existingUser) {
      throw new AppError('User not found.', 404);
    }

    normalizedUpdates.coachMetadata = {
      ...(existingUser.coachMetadata || {}),
      preferredLanguage: updates.preferredLanguage,
    };
    delete normalizedUpdates.preferredLanguage;
  }

  const user = await userRepository.updateUser(userId, normalizedUpdates);

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  return user;
}

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  normalizeUsername,
};
