/*

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { pool, testConnection } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth.routes');
const taskRoutes = require('./routes/task.routes');
const logRoutes = require('./routes/log.routes');
const powerPocketRoutes = require('./routes/powerPocket.routes');
const progressRoutes = require('./routes/progress.routes');
const uploadRoutes = require('./routes/upload.routes');
const resumeRoutes = require('./routes/resume.routes');
const aiRoutes = require('./routes/ai.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security ──────────────────────────────────────────────
app.use(helmet());

// ── Rate Limiting ─────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ── CORS ──────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body Parsing ──────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging ───────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Static Uploads (fallback if Cloudinary unavailable) ───
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Health Check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'PlacePrep API',
    version: '1.0.0',
  });
});

// ── API Routes ────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/power-pocket', powerPocketRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/ai', aiRoutes);

// ── 404 Handler ───────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  });
});

// ── Error Handler ─────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────
async function startServer() {
  try {
    await testConnection();
    console.log('✅ Database connected successfully');

    app.listen(PORT, () => {
      console.log(`\n🚀 PlacePrep API running on http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();

*/
const app = require('./app');
const env = require('./config/env');
const { testConnection } = require('./config/database');
const { initializeDatabase } = require('./db/init');
const { ensureBootstrapInvite } = require('./services/invite.service');
const { startNotificationScheduler } = require('./schedulers/notification.scheduler');

function formatErrorMessage(error) {
  if (error?.errors?.length) {
    return error.errors.map((item) => item.message).join('; ');
  }

  return error?.message || error?.code || String(error);
}

async function startServer() {
  try {
    await testConnection();

    if (env.autoInitDb) {
      await initializeDatabase();
    }

    const bootstrapInvite = await ensureBootstrapInvite();

    app.listen(env.port, () => {
      console.log(`PlacePrep API running on http://localhost:${env.port}`);
      console.log(`Health check available at http://localhost:${env.port}/api/health`);
      console.log(`Environment: ${env.nodeEnv}`);
      if (bootstrapInvite) {
        console.log(`Bootstrap invite ready at ${bootstrapInvite.inviteLink}`);
      }
      startNotificationScheduler();
    });
  } catch (error) {
    console.error('Failed to start PlacePrep API:', formatErrorMessage(error));
    process.exit(1);
  }
}

startServer();
