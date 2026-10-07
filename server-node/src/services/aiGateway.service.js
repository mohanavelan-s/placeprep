const env = require('../config/env');
const {
  getAIStatus,
  getOpenAIClient,
  markAIUnavailable,
  markAIWorking,
  normalizeErrorReason,
} = require('../config/openai');

const DEFAULT_TIMEOUT_MS = 12000;

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(`AI request timed out after ${timeoutMs}ms`);
        error.code = 'ai_timeout';
        reject(error);
      }, timeoutMs);
    }),
  ]);
}

function providerFromModel(model) {
  const prefix = String(model || '').split('/')[0] || env.aiProvider || 'openrouter';
  if (prefix === 'openai' || prefix === 'anthropic' || prefix === 'google') {
    return prefix;
  }

  return env.aiProvider || prefix;
}

function normalizeModelChain() {
  return Array.from(new Set(
    (env.aiModelChain?.length ? env.aiModelChain : [env.aiModel])
      .map((model) => String(model || '').trim())
      .filter(Boolean)
  ));
}

function extractMessageText(content) {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (part?.type === 'text' && typeof part.text === 'string') {
          return part.text;
        }

        if (typeof part?.content === 'string') {
          return part.content;
        }

        return '';
      })
      .join('\n')
      .trim();
  }

  if (content && typeof content === 'object') {
    return String(content.text || content.content || '').trim();
  }

  return '';
}

function normalizeJsonContent(content) {
  const trimmed = String(content || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() || trimmed;
}

function safeJsonParse(content) {
  const normalized = normalizeJsonContent(content);

  try {
    return JSON.parse(normalized);
  } catch (error) {
    const objectMatch = normalized.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }

    const arrayMatch = normalized.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }

    throw error;
  }
}

function normalizeFailureReason(error) {
  const baseReason = normalizeErrorReason(error);
  if (baseReason) {
    return baseReason;
  }

  const message = String(error?.message || error || '').toLowerCase();
  if (error?.code === 'ai_timeout' || /timed out|timeout/.test(message)) {
    return 'timeout';
  }

  if (/empty|no content/.test(message)) {
    return 'empty_content';
  }

  if (/json|parse/.test(message)) {
    return 'invalid_json';
  }

  if (/unsupported|parameter|response_format|temperature/.test(message)) {
    return 'unsupported_parameter';
  }

  if (error?.status === 404 || /model.*not.*found|not found/.test(message)) {
    return 'model_unavailable';
  }

  if (error?.status >= 500 || /server error|bad gateway|service unavailable/.test(message)) {
    return 'provider_error';
  }

  if (/network|fetch|socket|econn|enotfound/.test(message)) {
    return 'network_error';
  }

  return 'ai_request_failed';
}

function buildMessages({ systemPrompt, userPrompt, messages }) {
  if (Array.isArray(messages) && messages.length) {
    return messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
  }

  return [
    { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
    { role: 'user', content: userPrompt || '' },
  ];
}

async function requestWithModelChain({
  systemPrompt,
  userPrompt,
  messages,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  parse,
  validate,
  fallbackFactory,
  label = 'ai_request',
}) {
  const currentStatus = getAIStatus();
  const client = getOpenAIClient();
  const modelChain = normalizeModelChain();
  const attempts = [];

  if (!client || !modelChain.length) {
    const fallback = fallbackFactory ? fallbackFactory() : null;
    markAIUnavailable(currentStatus.reason || 'no_key', null, {
      attempts,
      activeModel: null,
    });

    return {
      data: fallback,
      text: typeof fallback === 'string' ? fallback : '',
      usedFallback: true,
      fallbackReason: currentStatus.reason || 'no_key',
      attempts,
      provider: env.aiProvider,
      model: modelChain[0] || env.aiModel,
    };
  }

  const requestMessages = buildMessages({ systemPrompt, userPrompt, messages });
  let lastError = null;
  let fallbackReason = 'ai_request_failed';

  for (const model of modelChain) {
    const provider = providerFromModel(model);
    const attempt = {
      label,
      provider,
      model,
      status: 'started',
      startedAt: new Date().toISOString(),
    };
    attempts.push(attempt);

    try {
      const response = await withTimeout(
        client.chat.completions.create({
          model,
          messages: requestMessages,
        }),
        timeoutMs,
      );

      const text = extractMessageText(response.choices?.[0]?.message?.content);
      if (!text) {
        throw new Error('AI response returned empty content.');
      }

      const data = parse ? parse(text) : text;
      if (validate && !validate(data)) {
        throw new Error('AI response failed validation.');
      }

      attempt.status = 'success';
      attempt.finishedAt = new Date().toISOString();
      markAIWorking({
        model,
        activeModel: model,
        attempts,
      });

      return {
        data,
        text,
        usedFallback: false,
        fallbackReason: null,
        attempts,
        provider,
        model,
      };
    } catch (error) {
      lastError = error;
      fallbackReason = normalizeFailureReason(error);
      attempt.status = 'failed';
      attempt.reason = fallbackReason;
      attempt.error = error?.message || String(error);
      attempt.finishedAt = new Date().toISOString();
    }
  }

  const fallback = fallbackFactory ? fallbackFactory(lastError) : null;
  markAIUnavailable(fallbackReason, lastError, {
    attempts,
    activeModel: attempts.find((attempt) => attempt.status === 'success')?.model || null,
  });

  return {
    data: fallback,
    text: typeof fallback === 'string' ? fallback : '',
    usedFallback: true,
    fallbackReason,
    attempts,
    provider: env.aiProvider,
    model: modelChain[0] || env.aiModel,
  };
}

function requestJson(systemPrompt, userPrompt, fallbackFactory, options = {}) {
  return requestWithModelChain({
    systemPrompt,
    userPrompt,
    fallbackFactory,
    parse: safeJsonParse,
    validate: (data) => data !== null && typeof data === 'object',
    label: options.label || 'json_request',
    timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
  });
}

function requestText({ messages, systemPrompt, userPrompt, fallbackFactory, timeoutMs, label }) {
  return requestWithModelChain({
    messages,
    systemPrompt,
    userPrompt,
    fallbackFactory,
    validate: (data) => typeof data === 'string' && data.trim().length > 0,
    label: label || 'text_request',
    timeoutMs: timeoutMs || DEFAULT_TIMEOUT_MS,
  });
}

module.exports = {
  requestJson,
  requestText,
  requestWithModelChain,
  safeJsonParse,
  extractMessageText,
};
