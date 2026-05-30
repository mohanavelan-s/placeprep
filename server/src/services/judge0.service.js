const env = require('../config/env');
const AppError = require('../utils/appError');

const LANGUAGE_LABELS = {
  python: 'Python',
  c: 'C',
  cpp: 'C++',
  java: 'Java',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  go: 'Go',
  rust: 'Rust',
  csharp: 'C#',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
};

const DEFAULT_LANGUAGE_KEYS = ['python', 'javascript', 'typescript', 'c', 'cpp', 'java', 'go', 'rust', 'csharp', 'mysql', 'postgresql'];

const LANGUAGE_MATCHERS = {
  python: [/python/i],
  c: [/^c\s*(\(|$)/i, /\bc\s*\(gcc/i],
  cpp: [/c\+\+/i, /\bcpp\b/i],
  java: [/java/i],
  javascript: [/javascript/i, /node\.?js/i],
  typescript: [/typescript/i],
  go: [/^go\s*\(/i, /\bgolang\b/i],
  rust: [/rust/i],
  csharp: [/c#/i, /csharp/i],
  mysql: [/mysql/i],
  postgresql: [/postgres/i, /postgresql/i],
};

const TERMINAL_STATUS_IDS = new Set([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
let cachedRegistry = null;

function normalizeLanguageKey(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (/^\d+$/.test(normalized)) {
    return `judge0:${normalized}`;
  }
  if (['py', 'python3'].includes(normalized)) {
    return 'python';
  }
  if (['js', 'node', 'nodejs', 'node.js'].includes(normalized)) {
    return 'javascript';
  }
  if (['ts'].includes(normalized)) {
    return 'typescript';
  }
  if (['golang'].includes(normalized)) {
    return 'go';
  }
  if (['c#', 'cs'].includes(normalized)) {
    return 'csharp';
  }
  if (['c++', 'cpp17', 'cpp20', 'cplusplus'].includes(normalized)) {
    return 'cpp';
  }
  if (['postgres', 'psql'].includes(normalized)) {
    return 'postgresql';
  }

  return normalized;
}

function getPreferredLanguageKeys() {
  const configured = env.judge0AllowedLanguages
    .map(normalizeLanguageKey)
    .filter((language) => LANGUAGE_LABELS[language]);

  return Array.from(new Set([
    ...configured,
    ...DEFAULT_LANGUAGE_KEYS,
  ]));
}

function buildProviderKey(languageId) {
  return `judge0:${Number(languageId)}`;
}

function buildProviderLabel(language) {
  const name = String(language?.name || '').trim();
  return name || `Judge0 language ${language?.id}`;
}

function buildHeaders() {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (env.judge0ApiKey) {
    headers[env.judge0AuthHeader || 'X-Auth-Token'] = env.judge0ApiKey;
  }

  if (env.judge0RapidApiHost) {
    headers['X-RapidAPI-Host'] = env.judge0RapidApiHost;
    if (env.judge0ApiKey && !headers['X-RapidAPI-Key']) {
      headers['X-RapidAPI-Key'] = env.judge0ApiKey;
    }
  }

  return headers;
}

function buildUrl(pathname, params = {}) {
  const base = String(env.judge0BaseUrl || '').replace(/\/+$/, '');
  const url = new URL(`${base}${pathname.startsWith('/') ? pathname : `/${pathname}`}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function encodeBase64(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return Buffer.from(String(value), 'utf8').toString('base64');
}

function decodeBase64(value) {
  if (!value) {
    return null;
  }

  try {
    return Buffer.from(String(value), 'base64').toString('utf8');
  } catch {
    return String(value);
  }
}

function normalizeProviderLanguage(language) {
  return {
    id: Number(language?.id),
    name: String(language?.name || '').trim(),
    isArchived: Boolean(language?.is_archived || language?.isArchived),
  };
}

function matchProviderLanguage(languageKey, providerLanguages = []) {
  const matchers = LANGUAGE_MATCHERS[languageKey] || [];
  return providerLanguages.find((language) => {
    if (!language.id || language.isArchived) {
      return false;
    }

    if (languageKey === 'c' && /c\+\+/i.test(language.name)) {
      return false;
    }

    return matchers.some((matcher) => matcher.test(language.name));
  }) || null;
}

function providerDisabledRegistry() {
  return {
    enabled: false,
    fetchedAt: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 1000,
    languages: getPreferredLanguageKeys().map((key) => ({
      key,
      label: LANGUAGE_LABELS[key],
      enabled: false,
      id: null,
      providerName: null,
      unavailableReason: 'Judge0 execution is not enabled on the backend.',
    })),
    providerLanguages: [],
  };
}

async function requestJudge0(pathname, options = {}) {
  const response = await fetch(buildUrl(pathname, options.params), {
    method: options.method || 'GET',
    headers: buildHeaders(),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 || response.status === 403) {
    throw new AppError('Judge0 authentication failed. Check the configured API key and auth header.', 503, {
      code: 'judge0_auth_failed',
    });
  }

  if (response.status === 429) {
    throw new AppError('Judge0 queue is full or rate limited. Try again in a moment.', 503, {
      code: 'judge0_queue_full',
    });
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new AppError(
      data?.message || data?.error || `Judge0 request failed with status ${response.status}.`,
      503,
      {
        code: 'judge0_provider_error',
        status: response.status,
      },
    );
  }

  return data;
}

async function fetchLanguageRegistry({ force = false } = {}) {
  if (!env.judge0Enabled) {
    cachedRegistry = providerDisabledRegistry();
    return cachedRegistry;
  }

  if (!force && cachedRegistry?.expiresAt > Date.now()) {
    return cachedRegistry;
  }

  const providerLanguages = (await requestJudge0('/languages')).map(normalizeProviderLanguage);
  const preferredLanguageKeys = getPreferredLanguageKeys();
  const preferredIds = new Set();
  const preferredLanguages = preferredLanguageKeys.map((key) => {
    const matchedLanguage = matchProviderLanguage(key, providerLanguages);
    if (matchedLanguage?.id) {
      preferredIds.add(Number(matchedLanguage.id));
    }

    return {
      key,
      label: LANGUAGE_LABELS[key],
      enabled: Boolean(matchedLanguage),
      id: matchedLanguage?.id || null,
      providerName: matchedLanguage?.name || null,
      unavailableReason: matchedLanguage
        ? null
        : `${LANGUAGE_LABELS[key]} execution is not configured on this Judge0 provider.`,
    };
  });
  const providerLanguageOptions = providerLanguages
    .filter((language) => language.id && !language.isArchived && !preferredIds.has(Number(language.id)))
    .map((language) => ({
      key: buildProviderKey(language.id),
      label: buildProviderLabel(language),
      enabled: true,
      id: Number(language.id),
      providerName: buildProviderLabel(language),
      unavailableReason: null,
    }));

  cachedRegistry = {
    enabled: true,
    fetchedAt: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 1000,
    languages: [...preferredLanguages, ...providerLanguageOptions],
    providerLanguages,
  };

  return cachedRegistry;
}

async function listLanguages() {
  const registry = await fetchLanguageRegistry();
  return registry.languages;
}

async function resolveLanguage(languageKey) {
  const normalizedKey = normalizeLanguageKey(languageKey);
  const registry = await fetchLanguageRegistry();
  let language = registry.languages.find((entry) => entry.key === normalizedKey);
  if (!language && normalizedKey.startsWith('judge0:')) {
    const providerId = Number(normalizedKey.split(':')[1]);
    const providerLanguage = registry.providerLanguages.find((entry) => Number(entry.id) === providerId && !entry.isArchived);
    if (providerLanguage) {
      language = {
        key: normalizedKey,
        label: buildProviderLabel(providerLanguage),
        enabled: true,
        id: providerId,
        providerName: buildProviderLabel(providerLanguage),
        unavailableReason: null,
      };
    }
  }

  if (!language?.enabled || !language.id) {
    throw new AppError(
      language?.unavailableReason || `${LANGUAGE_LABELS[normalizedKey] || normalizedKey} execution is not configured.`,
      503,
      {
        code: 'language_unavailable',
        language: normalizedKey,
      },
    );
  }

  return language;
}

function mapJudgeStatus(result = {}) {
  const statusId = Number(result.status?.id || 0);
  const description = String(result.status?.description || '').trim();

  if (statusId === 1) {
    return { status: 'queued', terminal: false, description };
  }
  if (statusId === 2) {
    return { status: 'processing', terminal: false, description };
  }
  if (statusId === 3) {
    return { status: 'accepted', terminal: true, description };
  }
  if (statusId === 4) {
    return { status: 'wrong_answer', terminal: true, description };
  }
  if (statusId === 5) {
    return { status: 'timeout', terminal: true, description };
  }
  if (statusId === 6) {
    return { status: 'compile_error', terminal: true, description };
  }
  if (statusId >= 7 && statusId <= 12) {
    return { status: 'runtime_error', terminal: true, description };
  }

  return {
    status: TERMINAL_STATUS_IDS.has(statusId) ? 'failed' : 'processing',
    terminal: TERMINAL_STATUS_IDS.has(statusId),
    description: description || 'Unknown Judge0 status',
  };
}

function normalizeSubmissionResult(result = {}) {
  const mappedStatus = mapJudgeStatus(result);
  return {
    token: result.token || null,
    status: mappedStatus.status,
    statusDescription: mappedStatus.description,
    terminal: mappedStatus.terminal,
    stdout: decodeBase64(result.stdout),
    stderr: decodeBase64(result.stderr),
    compileOutput: decodeBase64(result.compile_output),
    message: decodeBase64(result.message),
    time: result.time === null || result.time === undefined ? null : Number(result.time),
    memory: result.memory === null || result.memory === undefined ? null : Number(result.memory),
    rawStatusId: Number(result.status?.id || 0),
  };
}

async function submit({ language, sourceCode, stdin = '', expectedOutput = null }) {
  const resolvedLanguage = await resolveLanguage(language);
  const body = {
    source_code: encodeBase64(sourceCode),
    language_id: resolvedLanguage.id,
    stdin: encodeBase64(stdin || ''),
    expected_output: expectedOutput === null || expectedOutput === undefined ? undefined : encodeBase64(expectedOutput),
    cpu_time_limit: env.judge0CpuTimeLimit,
    wall_time_limit: env.judge0WallTimeLimit,
    memory_limit: env.judge0MemoryLimitKb,
    max_processes_and_or_threads: 1,
    max_file_size: 2048,
    number_of_runs: 1,
  };

  const data = await requestJudge0('/submissions', {
    method: 'POST',
    params: {
      base64_encoded: 'true',
      wait: 'false',
    },
    body,
  });

  if (!data?.token) {
    throw new AppError('Judge0 did not return a submission token.', 503, {
      code: 'judge0_missing_token',
    });
  }

  return {
    token: data.token,
    language: resolvedLanguage,
  };
}

async function getSubmission(token) {
  const data = await requestJudge0(`/submissions/${encodeURIComponent(token)}`, {
    params: {
      base64_encoded: 'true',
    },
  });

  return normalizeSubmissionResult(data);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function poll(token, { timeoutMs = env.judge0PollTimeoutMs, intervalMs = 1000 } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const result = await getSubmission(token);
    if (result.terminal) {
      return result;
    }

    await sleep(intervalMs);
  }

  throw new AppError('Judge0 execution timed out while waiting for the sandbox result.', 503, {
    code: 'judge0_poll_timeout',
    token,
  });
}

async function submitAndPoll(payload) {
  if (!env.judge0Enabled) {
    throw new AppError('Judge0 execution is not enabled on the backend.', 503, {
      code: 'judge0_disabled',
    });
  }

  const queued = await submit(payload);
  const result = await poll(queued.token);

  return {
    ...result,
    token: queued.token,
    language: queued.language,
  };
}

module.exports = {
  LANGUAGE_LABELS,
  listLanguages,
  fetchLanguageRegistry,
  normalizeLanguageKey,
  submit,
  getSubmission,
  poll,
  submitAndPoll,
};
