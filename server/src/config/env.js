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
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'),
  autoInitDb: process.env.AUTO_INIT_DB !== 'false',
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'Asia/Calcutta',
  maxUploadFileSize: Number(process.env.MAX_UPLOAD_FILE_SIZE || 8 * 1024 * 1024),
  maxApkUploadFileSize: Number(process.env.MAX_APK_UPLOAD_FILE_SIZE || 150 * 1024 * 1024),
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || '',
  webPushPublicKey: process.env.WEB_PUSH_PUBLIC_KEY || '',
  webPushPrivateKey: process.env.WEB_PUSH_PRIVATE_KEY || '',
  webPushSubject: process.env.WEB_PUSH_SUBJECT || process.env.SMTP_FROM || 'mailto:support@placeprep.app',
  inviteSignupNotifyEmail: process.env.INVITE_SIGNUP_NOTIFY_EMAIL || process.env.SMTP_USER || '',
  notificationCron: process.env.NOTIFICATION_CRON || '0 20 * * *',
  notificationSchedulerEnabled: process.env.NOTIFICATION_SCHEDULER_ENABLED !== 'false',
  deliveryWorkerEnabled: process.env.DELIVERY_WORKER_ENABLED !== 'false',
  deliveryWorkerCron: process.env.DELIVERY_WORKER_CRON || '*/1 * * * *',
  deliveryWorkerBatchSize: Number(process.env.DELIVERY_WORKER_BATCH_SIZE || 12),
  publicSignupEnabled: process.env.ALLOW_PUBLIC_SIGNUP === 'true',
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
env.aiModel = env.aiProvider === 'openrouter' && !env.openaiModel.includes('/')
  ? `openai/${env.openaiModel}`
  : env.openaiModel;
env.cloudinaryEnabled = Boolean(
  env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret
);
env.emailEnabled = Boolean(
  env.smtpHost
  && env.smtpPort
  && env.smtpFrom
  && (!env.smtpUser || env.smtpPass)
);
env.inviteOnlyAccess = !env.publicSignupEnabled;

if (env.ngrokUrl && !env.clientUrls.includes(env.ngrokUrl)) {
  env.clientUrls.push(env.ngrokUrl);
}

module.exports = env;
