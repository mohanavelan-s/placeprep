const userRepository = require('../repositories/user.repository');
const AppError = require('../utils/appError');

const FREE_LIMITS = {
  plan_generations: 1,
  mentor_messages: 10,
};

const COUNTER_FIELDS = {
  plan_generations: 'planGenerations',
  mentor_messages: 'mentorMessages',
};

const FEATURE_LABELS = {
  plan_generations: 'AI plan generation',
  mentor_messages: 'mentor messages',
};

function normalizeTier(user) {
  return user?.tier || 'free';
}

function getCounterValue(user, feature) {
  return Number(user?.[COUNTER_FIELDS[feature]] || 0);
}

function assertSupportedFeature(feature) {
  if (!Object.prototype.hasOwnProperty.call(FREE_LIMITS, feature)) {
    throw new Error(`Unsupported tier feature: ${feature}`);
  }
}

async function getCurrentUser(user) {
  const currentUser = await userRepository.findById(user.id);
  if (!currentUser) {
    throw new AppError('User not found.', 404);
  }

  return currentUser;
}

async function assertCanUse(user, feature) {
  assertSupportedFeature(feature);
  const currentUser = await getCurrentUser(user);

  if (normalizeTier(currentUser) !== 'free') {
    return currentUser;
  }

  const used = getCounterValue(currentUser, feature);
  const limit = FREE_LIMITS[feature];
  if (used >= limit) {
    throw new AppError(
      `Free accounts include ${limit} ${FEATURE_LABELS[feature]}. Enter a college invite or upgrade later to continue.`,
      402
    );
  }

  return currentUser;
}

async function consumeFeature(user, feature) {
  assertSupportedFeature(feature);
  const currentUser = await getCurrentUser(user);

  if (normalizeTier(currentUser) !== 'free') {
    return currentUser;
  }

  return userRepository.incrementUsageCounter(currentUser.id, feature);
}

module.exports = {
  FREE_LIMITS,
  assertCanUse,
  consumeFeature,
};
