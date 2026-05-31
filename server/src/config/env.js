const path = require('path');
require('dotenv').config();

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME || 'placeprep';
  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function detectAIProvider(apiKey) {
  if (!apiKey) {
    return 'openai';
  }

  if (apiKey.startsWith('sk-or-v1-')) {
    return 'openrouter';
  }

  return 'openai';
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractEmailAddress(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  const bracketMatch = text.match(/<([^>]+)>/);
  if (bracketMatch?.[1]) {
    return bracketMatch[1].trim();
  }

  return text;
}

function isValidWebPushSubject(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }

  if (/^mailto:/i.test(text)) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text.slice('mailto:'.length).trim());
  }

  if (/^https?:\/\//i.test(text)) {
    try {
      const parsed = new URL(text);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  return false;
}

function normalizeWebPushSubject(value, fallbackEmail = '') {
  const text = String(value || '').trim();
  if (isValidWebPushSubject(text)) {
    return text;
  }

  const extractedEmail = extractEmailAddress(text);
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(extractedEmail)) {
    return `mailto:${extractedEmail}`;
  }

  if (isValidWebPushSubject(fallbackEmail)) {
    return fallbackEmail;
  }

  const fallbackAddress = extractEmailAddress(fallbackEmail);
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fallbackAddress)) {
    return `mailto:${fallbackAddress}`;
  }

  return 'mailto:support@placeprep.app';
}

const LEGACY_DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-5.5-pro';

function resolveAIModel(provider, configuredModel) {
  const model = String(configuredModel || '').trim();

  if (provider === 'openrouter') {
    if (!model || model === LEGACY_DEFAULT_OPENAI_MODEL) {
      return OPENROUTER_DEFAULT_MODEL;
    }

    return model.includes('/') ? model : `openai/${model}`;
  }

  return model || LEGACY_DEFAULT_OPENAI_MODEL;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  clientUrls: splitCsv(process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173'),
  appUrl: process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5173',
  ngrokUrl: process.env.NGROK_URL || '',
  databaseUrl: buildDatabaseUrl(),
  databasePoolUrl: process.env.DATABASE_POOL_URL || buildDatabaseUrl(),
  databasePoolMax: Number(process.env.DB_POOL_MAX || 20),
  databaseIdleTimeoutMs: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  databaseConnectionTimeoutMs: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
  jwtSecret: process.env.JWT_SECRET || 'change-this-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || LEGACY_DEFAULT_OPENAI_MODEL,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'),
  autoInitDb: process.env.AUTO_INIT_DB !== 'false',
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'Asia/Calcutta',
  maxUploadFileSize: Number(process.env.MAX_UPLOAD_FILE_SIZE || 8 * 1024 * 1024),
  maxApkUploadFileSize: Number(process.env.MAX_APK_UPLOAD_FILE_SIZE || 150 * 1024 * 1024),
  smtpHost: process.env.SMTP_HOST || process.env.SMPT_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || process.env.SMPT_PORT || 587),
  smtpSecure: (process.env.SMTP_SECURE || process.env.SMPT_SECURE) === 'true',
  smtpForceIPv4: (process.env.SMTP_FORCE_IPV4 || process.env.SMPT_FORCE_IPV4 || 'true') !== 'false',
  smtpConnectionTimeoutMs: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || process.env.SMPT_CONNECTION_TIMEOUT_MS || 30000),
  smtpUser: process.env.SMTP_USER || process.env.SMPT_USER || '',
  smtpPass: process.env.SMTP_PASS || process.env.SMPT_PASS || '',
  smtpFrom: process.env.SMTP_FROM || process.env.SMPT_FROM || process.env.SMTP_USER || process.env.SMPT_USER || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFrom: process.env.RESEND_FROM || process.env.EMAIL_FROM || '',
  emailProvider: process.env.EMAIL_PROVIDER || 'resend',
  allowSmtpFallback: process.env.ALLOW_SMTP_FALLBACK === 'true',
  ownerEmails: splitCsv(process.env.OWNER_EMAILS || process.env.OWNER_EMAIL || 'mohanavelan2006@gmail.com')
    .map((email) => email.toLowerCase()),
  webPushPublicKey: process.env.WEB_PUSH_PUBLIC_KEY || '',
  webPushPrivateKey: process.env.WEB_PUSH_PRIVATE_KEY || '',
  webPushSubject: normalizeWebPushSubject(
    process.env.WEB_PUSH_SUBJECT
      || process.env.SMTP_FROM
      || process.env.SMPT_FROM
      || process.env.SMTP_USER
      || process.env.SMPT_USER
      || '',
    process.env.SMTP_USER || process.env.SMPT_USER || 'support@placeprep.app',
  ),
  inviteSignupNotifyEmail: process.env.INVITE_SIGNUP_NOTIFY_EMAIL || process.env.SMTP_USER || process.env.SMPT_USER || '',
  notificationCron: process.env.NOTIFICATION_SWEEP_CRON || process.env.NOTIFICATION_CRON || '*/15 * * * *',
  notificationMorningHour: Number(process.env.NOTIFICATION_MORNING_HOUR || 8),
  notificationEveningHour: Number(process.env.NOTIFICATION_EVENING_HOUR || 20),
  notificationSlotWindowMinutes: Number(process.env.NOTIFICATION_SLOT_WINDOW_MINUTES || 75),
  notificationSchedulerEnabled: process.env.NOTIFICATION_SCHEDULER_ENABLED !== 'false',
  deliveryWorkerEnabled: process.env.DELIVERY_WORKER_ENABLED !== 'false',
  deliveryWorkerCron: process.env.DELIVERY_WORKER_CRON || '*/1 * * * *',
  deliveryWorkerBatchSize: Number(process.env.DELIVERY_WORKER_BATCH_SIZE || 12),
  publicSignupEnabled: process.env.INVITE_ONLY_ACCESS !== 'true',
  judge0Enabled: process.env.JUDGE0_ENABLED !== 'false',
  judge0BaseUrl: process.env.JUDGE0_BASE_URL || 'https://ce.judge0.com',
  judge0ApiKey: process.env.JUDGE0_API_KEY || '',
  judge0AuthHeader: process.env.JUDGE0_AUTH_HEADER || 'X-Auth-Token',
  judge0RapidApiHost: process.env.JUDGE0_RAPIDAPI_HOST || '',
  judge0AllowedLanguages: splitCsv(process.env.JUDGE0_ALLOWED_LANGUAGES || 'python,c,cpp,java,mysql,postgresql'),
  judge0CpuTimeLimit: Number(process.env.JUDGE0_CPU_TIME_LIMIT || 2),
  judge0WallTimeLimit: Number(process.env.JUDGE0_WALL_TIME_LIMIT || 5),
  judge0MemoryLimitKb: Number(process.env.JUDGE0_MEMORY_LIMIT_KB || 128000),
  judge0MaxSourceBytes: Number(process.env.JUDGE0_MAX_SOURCE_BYTES || 20000),
  judge0MaxStdinBytes: Number(process.env.JUDGE0_MAX_STDIN_BYTES || 4000),
  judge0PollTimeoutMs: Number(process.env.JUDGE0_POLL_TIMEOUT_MS || 20000),
  bootstrapAdminInviteCode: process.env.BOOTSTRAP_ADMIN_INVITE_CODE || '',
  bootstrapObserverInviteCode: process.env.BOOTSTRAP_OBSERVER_INVITE_CODE || '',
  bootstrapUserInviteCode: process.env.BOOTSTRAP_USER_INVITE_CODE || '',
  bootstrapInviteCode: process.env.BOOTSTRAP_INVITE_CODE || '',
  bootstrapInviteRole: process.env.BOOTSTRAP_INVITE_ROLE || 'admin',
  bootstrapInviteExpiresDays: Number(process.env.BOOTSTRAP_INVITE_EXPIRES_DAYS || 14),
};

env.openaiEnabled = Boolean(env.openaiApiKey);
env.aiProvider = process.env.AI_PROVIDER || detectAIProvider(env.openaiApiKey);
env.aiBaseUrl = process.env.AI_BASE_URL
  || (env.aiProvider === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined);
env.aiModel = resolveAIModel(env.aiProvider, env.openaiModel);
env.cloudinaryEnabled = Boolean(
  env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret
);
env.smtpEnabled = Boolean(
  env.smtpHost
  && env.smtpPort
  && env.smtpFrom
  && (!env.smtpUser || env.smtpPass)
);
env.resendEnabled = Boolean(env.resendApiKey && env.resendFrom);

const requestedEmailProvider = String(env.emailProvider || '').trim().toLowerCase();
env.emailProvider = env.allowSmtpFallback && requestedEmailProvider === 'smtp' ? 'smtp' : 'resend';

env.emailFrom = env.emailProvider === 'resend' ? env.resendFrom : env.smtpFrom;
env.emailEnabled = env.emailProvider === 'resend' ? env.resendEnabled : env.smtpEnabled;
env.inviteOnlyAccess = !env.publicSignupEnabled;

if (env.ngrokUrl && !env.clientUrls.includes(env.ngrokUrl)) {
  env.clientUrls.push(env.ngrokUrl);
}

module.exports = env;
