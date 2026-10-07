/*

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

*/
const OpenAI = require('openai');
const env = require('./env');

let client = null;
let aiStatus = {
  aiEnabled: Boolean(env.openaiApiKey),
  reason: env.openaiApiKey ? 'working' : 'no_key',
  provider: env.aiProvider,
  model: env.aiModel,
  modelChain: env.aiModelChain || [env.aiModel],
  activeModel: env.aiModel,
  attempts: [],
  fallbackMode: !env.openaiApiKey,
  lastCheckedAt: null,
  lastError: null,
};

function updateAIStatus(updates) {
  aiStatus = {
    ...aiStatus,
    ...updates,
    provider: env.aiProvider,
    model: updates.model || env.aiModel,
    activeModel: updates.activeModel || updates.model || aiStatus.activeModel || env.aiModel,
    modelChain: env.aiModelChain || [env.aiModel],
    lastCheckedAt: new Date().toISOString(),
  };
}

function markAIWorking(details = {}) {
  updateAIStatus({
    aiEnabled: true,
    reason: 'working',
    fallbackMode: false,
    lastError: null,
    ...details,
  });
}

function markAIUnavailable(reason, error = null, details = {}) {
  const safeReason = reason || 'ai_request_failed';
  updateAIStatus({
    aiEnabled: false,
    reason: safeReason,
    fallbackMode: true,
    lastError: error ? (error.message || String(error)) : null,
    ...details,
  });
}

function normalizeErrorReason(error) {
  if (!env.openaiApiKey) {
    return 'no_key';
  }

  if (error?.status === 429 || error?.code === 'insufficient_quota' || /quota/i.test(error?.message || '')) {
    return 'quota_exceeded';
  }

  if (error?.status === 401 || error?.status === 403 || /api key|auth/i.test(error?.message || '')) {
    return 'no_key';
  }

  return null;
}

function getOpenAIClient() {
  if (!env.openaiEnabled) {
    markAIUnavailable('no_key');
    return null;
  }

  if (!client) {
    const options = {
      apiKey: env.openaiApiKey,
    };

    if (env.aiBaseUrl) {
      options.baseURL = env.aiBaseUrl;
    }

    if (env.aiProvider === 'openrouter') {
      options.defaultHeaders = {
        'HTTP-Referer': env.clientUrl,
        'X-Title': 'PlacePrep',
      };
    }

    client = new OpenAI(options);
  }

  return client;
}

module.exports = {
  getOpenAIClient,
  isOpenAIConfigured: env.openaiEnabled,
  getAIStatus: () => ({ ...aiStatus }),
  markAIWorking,
  markAIUnavailable,
  normalizeErrorReason,
};
