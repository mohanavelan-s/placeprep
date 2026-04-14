const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const taskRoutes = require('./routes/task.routes');
const logRoutes = require('./routes/log.routes');
const powerPocketRoutes = require('./routes/powerPocket.routes');
const progressRoutes = require('./routes/progress.routes');
const userProfileRoutes = require('./routes/userProfile.routes');
const notificationRoutes = require('./routes/notification.routes');
const inviteRoutes = require('./routes/invite.routes');
const apkRoutes = require('./routes/apk.routes');
const uploadRoutes = require('./routes/upload.routes');
const resumeRoutes = require('./routes/resume.routes');
const aiRoutes = require('./routes/ai.routes');
const coachRoutes = require('./routes/coach.routes');
const { getAIStatus } = require('./config/openai');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.has(origin)) {
    return true;
  }

  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

const allowedOrigins = new Set([
  ...env.clientUrls,
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 250,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});

app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(limiter);
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (env.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

app.use('/uploads', express.static(env.uploadDir));

function buildHealthPayload() {
  const aiStatus = getAIStatus();

  return {
    success: true,
    data: {
      status: 'ok',
      service: 'PlacePrep API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      aiEnabled: aiStatus.aiEnabled,
      aiReason: aiStatus.reason,
      aiProvider: aiStatus.provider,
      aiModel: aiStatus.model,
      cloudinaryEnabled: env.cloudinaryEnabled,
      emailEnabled: env.emailEnabled,
      notificationSchedulerEnabled: env.notificationSchedulerEnabled,
      inviteOnlyAccess: env.inviteOnlyAccess,
      appUrl: env.appUrl,
    },
  };
}

app.get('/', (req, res) => {
  res.json(buildHealthPayload());
});

app.get('/healthz', (req, res) => {
  res.json(buildHealthPayload());
});

app.get('/api/health', (req, res) => {
  res.json(buildHealthPayload());
});

app.use('/api/auth', authRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/power-pocket', powerPocketRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/profile', userProfileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/apk', apkRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/coach', coachRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
