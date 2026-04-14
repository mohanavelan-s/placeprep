CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  username VARCHAR(60),
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  weak_areas TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  strong_topics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  target_role VARCHAR(120),
  placement_date DATE,
  timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Calcutta',
  solved_problems INTEGER NOT NULL DEFAULT 0,
  average_time_per_problem NUMERIC(6, 2) NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  mistake_count INTEGER NOT NULL DEFAULT 0,
  consistency_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  readiness_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  coach_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'))
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(60);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS strong_topics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS solved_problems INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS average_time_per_problem NUMERIC(6, 2) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mistake_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consistency_score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS readiness_score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'user' WHERE role = 'viewer';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'));

CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY,
  code VARCHAR(120) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT invites_role_check CHECK (role IN ('admin', 'user'))
);

ALTER TABLE invites DROP CONSTRAINT IF EXISTS invites_role_check;
UPDATE invites SET role = 'user' WHERE role = 'viewer';
ALTER TABLE invites ADD CONSTRAINT invites_role_check CHECK (role IN ('admin', 'user'));

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  description TEXT,
  category VARCHAR(40) NOT NULL DEFAULT 'DSA',
  subcategory VARCHAR(120),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  intensity VARCHAR(30) DEFAULT 'medium',
  reference_label VARCHAR(120),
  reference_url TEXT,
  due_date DATE,
  scheduled_for DATE NOT NULL DEFAULT CURRENT_DATE,
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  actual_minutes INTEGER NOT NULL DEFAULT 0,
  difficulty INTEGER DEFAULT 3,
  weak_area VARCHAR(120),
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tasks_category_check CHECK (category IN ('DSA', 'Core', 'Project', 'Aptitude', 'Resume', 'MockInterview', 'Other')),
  CONSTRAINT tasks_status_check CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  CONSTRAINT tasks_priority_check CHECK (priority IN ('low', 'medium', 'high'))
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  summary TEXT,
  wins TEXT,
  blockers TEXT,
  mood INTEGER,
  energy INTEGER,
  productivity_score INTEGER DEFAULT 0,
  focus_minutes INTEGER DEFAULT 0,
  hours_studied NUMERIC(6, 2) DEFAULT 0,
  tasks_completed_count INTEGER DEFAULT 0,
  notes TEXT,
  improvement_plan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT daily_logs_unique_day UNIQUE (user_id, log_date),
  CONSTRAINT daily_logs_mood_check CHECK (mood IS NULL OR (mood >= 1 AND mood <= 5)),
  CONSTRAINT daily_logs_energy_check CHECK (energy IS NULL OR (energy >= 1 AND energy <= 5)),
  CONSTRAINT daily_logs_productivity_check CHECK (productivity_score >= 0 AND productivity_score <= 100)
);

CREATE TABLE IF NOT EXISTS power_pocket_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  title VARCHAR(180),
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  source VARCHAR(30) NOT NULL DEFAULT 'manual',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT power_pocket_status_check CHECK (status IN ('active', 'completed', 'abandoned')),
  CONSTRAINT power_pocket_source_check CHECK (source IN ('manual', 'suggested', 'ai'))
);

CREATE TABLE IF NOT EXISTS progress_stats (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  streak INTEGER NOT NULL DEFAULT 0,
  bonus_streak INTEGER NOT NULL DEFAULT 0,
  consistency_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  readiness_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  execution_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  total_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  power_pocket_minutes INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT progress_stats_unique_day UNIQUE (user_id, stat_date)
);

CREATE TABLE IF NOT EXISTS images (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  daily_log_id UUID REFERENCES daily_logs(id) ON DELETE SET NULL,
  secure_url TEXT NOT NULL,
  public_id TEXT NOT NULL,
  asset_id TEXT,
  mime_type VARCHAR(120),
  format VARCHAR(40),
  bytes INTEGER DEFAULT 0,
  width INTEGER,
  height INTEGER,
  storage_provider VARCHAR(30) NOT NULL DEFAULT 'cloudinary',
  proof_date DATE NOT NULL DEFAULT CURRENT_DATE,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255),
  mime_type VARCHAR(120),
  secure_url TEXT,
  public_id TEXT,
  storage_provider VARCHAR(30) NOT NULL DEFAULT 'cloudinary',
  size_bytes INTEGER DEFAULT 0,
  extracted_text TEXT,
  analysis_summary TEXT,
  score INTEGER DEFAULT 0,
  strengths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  improvements TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  sections JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  linkedin_url TEXT,
  github_url TEXT,
  leetcode_url TEXT,
  portfolio_url TEXT,
  resume_url TEXT,
  avatar_url TEXT,
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notification_email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notification_browser_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  notification_browser_permission VARCHAR(20) NOT NULL DEFAULT 'default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notification_email_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notification_browser_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notification_browser_permission VARCHAR(20) NOT NULL DEFAULT 'default';

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  delivery_channels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  dedupe_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_type_check CHECK (
    type IN ('daily_inactivity', 'pending_tasks', 'missed_streak', 'countdown_urgency', 'motivation', 'coach_capsule')
  ),
  CONSTRAINT notifications_user_type_dedupe_unique UNIQUE (user_id, type, dedupe_key)
);

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check CHECK (
  type IN ('daily_inactivity', 'pending_tasks', 'missed_streak', 'countdown_urgency', 'motivation', 'coach_capsule')
);

CREATE TABLE IF NOT EXISTS coach_groups (
  id UUID PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coach_group_members (
  group_id UUID NOT NULL REFERENCES coach_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS prep_plans (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  known_topics JSONB NOT NULL DEFAULT '[]'::JSONB,
  target_topics JSONB NOT NULL DEFAULT '[]'::JSONB,
  roadmap JSONB NOT NULL DEFAULT '[]'::JSONB,
  tasks JSONB NOT NULL DEFAULT '[]'::JSONB,
  resources JSONB NOT NULL DEFAULT '[]'::JSONB,
  flashcards JSONB NOT NULL DEFAULT '[]'::JSONB,
  time_per_day INTEGER DEFAULT 120,
  target_role VARCHAR(120),
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source_plan_id UUID REFERENCES prep_plans(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mentor_messages (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mentor_messages_role_check CHECK (role IN ('user', 'assistant', 'system'))
);

CREATE TABLE IF NOT EXISTS apk_versions (
  id UUID PRIMARY KEY,
  version VARCHAR(40) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  public_id TEXT,
  mime_type VARCHAR(120),
  bytes INTEGER NOT NULL DEFAULT 0,
  storage_provider VARCHAR(30) NOT NULL DEFAULT 'cloudinary',
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_scheduled_for ON tasks(user_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_power_pocket_user_started_at ON power_pocket_sessions(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_progress_stats_user_date ON progress_stats(user_id, stat_date);
CREATE INDEX IF NOT EXISTS idx_images_user_proof_date ON images(user_id, proof_date);
CREATE INDEX IF NOT EXISTS idx_resumes_user_active ON resumes(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);
CREATE INDEX IF NOT EXISTS idx_invites_created_at ON invites(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invites_unused_expires_at ON invites(used, expires_at);
CREATE INDEX IF NOT EXISTS idx_prep_plans_user_active ON prep_plans(user_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentor_messages_user_created_at ON mentor_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_sent_at ON notifications(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_apk_versions_active_uploaded_at ON apk_versions(is_active, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_groups_created_at ON coach_groups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_group_members_user_id ON coach_group_members(user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_set_updated_at') THEN
    CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'invites_set_updated_at') THEN
    CREATE TRIGGER invites_set_updated_at BEFORE UPDATE ON invites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tasks_set_updated_at') THEN
    CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'daily_logs_set_updated_at') THEN
    CREATE TRIGGER daily_logs_set_updated_at BEFORE UPDATE ON daily_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'power_pocket_sessions_set_updated_at') THEN
    CREATE TRIGGER power_pocket_sessions_set_updated_at BEFORE UPDATE ON power_pocket_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'progress_stats_set_updated_at') THEN
    CREATE TRIGGER progress_stats_set_updated_at BEFORE UPDATE ON progress_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'images_set_updated_at') THEN
    CREATE TRIGGER images_set_updated_at BEFORE UPDATE ON images FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'resumes_set_updated_at') THEN
    CREATE TRIGGER resumes_set_updated_at BEFORE UPDATE ON resumes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'user_profiles_set_updated_at') THEN
    CREATE TRIGGER user_profiles_set_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'prep_plans_set_updated_at') THEN
    CREATE TRIGGER prep_plans_set_updated_at BEFORE UPDATE ON prep_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'notifications_set_updated_at') THEN
    CREATE TRIGGER notifications_set_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'coach_groups_set_updated_at') THEN
    CREATE TRIGGER coach_groups_set_updated_at BEFORE UPDATE ON coach_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'apk_versions_set_updated_at') THEN
    CREATE TRIGGER apk_versions_set_updated_at BEFORE UPDATE ON apk_versions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
