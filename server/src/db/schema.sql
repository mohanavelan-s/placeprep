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
  tier TEXT NOT NULL DEFAULT 'free',
  plan_generations INTEGER NOT NULL DEFAULT 0,
  mentor_messages INTEGER NOT NULL DEFAULT 0,
  coach_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_role_check CHECK (role IN ('admin', 'user')),
  CONSTRAINT users_tier_check CHECK (tier IN ('free', 'pro', 'college'))
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
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_generations INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mentor_messages INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'user' WHERE role = 'viewer';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'));
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tier_check;
UPDATE users SET tier = 'free' WHERE tier IS NULL OR tier NOT IN ('free', 'pro', 'college');
ALTER TABLE users ADD CONSTRAINT users_tier_check CHECK (tier IN ('free', 'pro', 'college'));
UPDATE users
SET
  role = 'admin',
  tier = 'college',
  coach_metadata = (COALESCE(coach_metadata, '{}'::JSONB) - 'accessTier')
    || '{"accessTier": "standard", "owner": true}'::JSONB
WHERE LOWER(email) IN ('mohanavelan2006@gmail.com');

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

CREATE TABLE IF NOT EXISTS billing_customers (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  checkout_session_id TEXT,
  tier TEXT NOT NULL,
  status TEXT NOT NULL,
  price_id TEXT,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_subscriptions_tier_check CHECK (tier IN ('pro', 'college'))
);

CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  due_at TIMESTAMPTZ,
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

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

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

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
    type IN ('daily_inactivity', 'pending_tasks', 'missed_streak', 'countdown_urgency', 'motivation', 'coach_capsule', 'test_notification')
  ),
  CONSTRAINT notifications_user_type_dedupe_unique UNIQUE (user_id, type, dedupe_key)
);

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check CHECK (
  type IN ('daily_inactivity', 'pending_tasks', 'missed_streak', 'countdown_urgency', 'motivation', 'coach_capsule', 'test_notification')
);

CREATE TABLE IF NOT EXISTS delivery_jobs (
  id UUID PRIMARY KEY,
  type VARCHAR(60) NOT NULL,
  dedupe_key TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by VARCHAR(120),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT delivery_jobs_status_check CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  CONSTRAINT delivery_jobs_type_check CHECK (
    type IN ('notification_digest_email', 'admin_assignment_email', 'web_push_notification')
  )
);

ALTER TABLE delivery_jobs DROP CONSTRAINT IF EXISTS delivery_jobs_type_check;
ALTER TABLE delivery_jobs
ADD CONSTRAINT delivery_jobs_type_check CHECK (
  type IN ('notification_digest_email', 'admin_assignment_email', 'web_push_notification')
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  expiration_time TIMESTAMPTZ,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
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

WITH ranked_group_names AS (
  SELECT
    id,
    name,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(name)
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_rank
  FROM coach_groups
)
UPDATE coach_groups
SET name = LEFT(
  coach_groups.name,
  GREATEST(1, 120 - LENGTH(CONCAT(' (', ranked_group_names.duplicate_rank, ')')))
) || CONCAT(' (', ranked_group_names.duplicate_rank, ')')
FROM ranked_group_names
WHERE coach_groups.id = ranked_group_names.id
  AND ranked_group_names.duplicate_rank > 1;

WITH ranked_memberships AS (
  SELECT
    group_id,
    user_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY created_at ASC, group_id ASC
    ) AS membership_rank
  FROM coach_group_members
)
DELETE FROM coach_group_members
USING ranked_memberships
WHERE coach_group_members.group_id = ranked_memberships.group_id
  AND coach_group_members.user_id = ranked_memberships.user_id
  AND ranked_memberships.membership_rank > 1;

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
  duration_months INTEGER NOT NULL DEFAULT 1,
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

-- Backfill current columns onto legacy deployments. CREATE TABLE IF NOT EXISTS
-- preserves older table layouts, so shared read queries can fail until newer
-- nullable/defaulted columns are added explicitly.
ALTER TABLE users ADD COLUMN IF NOT EXISTS target_role VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS placement_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Calcutta';
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_generations INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mentor_messages INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE invites ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS used_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE invites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE billing_customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE billing_customers ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE billing_customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE billing_customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS checkout_session_id TEXT;
ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'pro';
ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'incomplete';
ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS price_id TEXT;
ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ;
ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;
ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;
ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE billing_subscriptions DROP CONSTRAINT IF EXISTS billing_subscriptions_tier_check;
UPDATE billing_subscriptions SET tier = 'pro' WHERE tier IS NULL OR tier NOT IN ('pro', 'college');
ALTER TABLE billing_subscriptions ADD CONSTRAINT billing_subscriptions_tier_check CHECK (tier IN ('pro', 'college'));

ALTER TABLE billing_events ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE billing_events ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE billing_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subcategory VARCHAR(120);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'pending';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'medium';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS intensity VARCHAR(30) DEFAULT 'medium';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reference_label VARCHAR(120);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reference_url TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_for DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER NOT NULL DEFAULT 30;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS difficulty INTEGER DEFAULT 3;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS weak_area VARCHAR(120);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS wins TEXT;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS blockers TEXT;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS mood INTEGER;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS energy INTEGER;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS productivity_score INTEGER DEFAULT 0;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS focus_minutes INTEGER DEFAULT 0;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS hours_studied NUMERIC(6, 2) DEFAULT 0;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS tasks_completed_count INTEGER DEFAULT 0;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS improvement_plan TEXT;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE power_pocket_sessions ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE power_pocket_sessions ADD COLUMN IF NOT EXISTS title VARCHAR(180);
ALTER TABLE power_pocket_sessions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE power_pocket_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active';
ALTER TABLE power_pocket_sessions ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'manual';
ALTER TABLE power_pocket_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE power_pocket_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE power_pocket_sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 0;
ALTER TABLE power_pocket_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE power_pocket_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE progress_stats ADD COLUMN IF NOT EXISTS streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE progress_stats ADD COLUMN IF NOT EXISTS bonus_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE progress_stats ADD COLUMN IF NOT EXISTS consistency_score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE progress_stats ADD COLUMN IF NOT EXISTS readiness_score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE progress_stats ADD COLUMN IF NOT EXISTS execution_rate NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE progress_stats ADD COLUMN IF NOT EXISTS total_hours NUMERIC(8, 2) NOT NULL DEFAULT 0;
ALTER TABLE progress_stats ADD COLUMN IF NOT EXISTS tasks_completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE progress_stats ADD COLUMN IF NOT EXISTS power_pocket_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE progress_stats ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE progress_stats ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE progress_stats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE images ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE images ADD COLUMN IF NOT EXISTS daily_log_id UUID REFERENCES daily_logs(id) ON DELETE SET NULL;
ALTER TABLE images ADD COLUMN IF NOT EXISTS asset_id TEXT;
ALTER TABLE images ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120);
ALTER TABLE images ADD COLUMN IF NOT EXISTS format VARCHAR(40);
ALTER TABLE images ADD COLUMN IF NOT EXISTS bytes INTEGER DEFAULT 0;
ALTER TABLE images ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE images ADD COLUMN IF NOT EXISTS height INTEGER;
ALTER TABLE images ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(30) NOT NULL DEFAULT 'cloudinary';
ALTER TABLE images ADD COLUMN IF NOT EXISTS proof_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE images ADD COLUMN IF NOT EXISTS caption TEXT;
ALTER TABLE images ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE images ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE resumes ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120);
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS secure_url TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS public_id TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(30) NOT NULL DEFAULT 'cloudinary';
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS size_bytes INTEGER DEFAULT 0;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS extracted_text TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS analysis_summary TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS strengths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improvements TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS sections JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS delivery_channels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT NOT NULL DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE delivery_jobs ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
ALTER TABLE delivery_jobs ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'queued';
ALTER TABLE delivery_jobs ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE delivery_jobs ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5;
ALTER TABLE delivery_jobs ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE delivery_jobs ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE delivery_jobs ADD COLUMN IF NOT EXISTS locked_by VARCHAR(120);
ALTER TABLE delivery_jobs ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE delivery_jobs ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE delivery_jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE delivery_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS expiration_time TIMESTAMPTZ;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

ALTER TABLE coach_groups ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE coach_groups ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE coach_groups ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE coach_groups ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE coach_groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE coach_group_members ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE coach_group_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE prep_plans ADD COLUMN IF NOT EXISTS known_topics JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE prep_plans ADD COLUMN IF NOT EXISTS target_topics JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE prep_plans ADD COLUMN IF NOT EXISTS roadmap JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE prep_plans ADD COLUMN IF NOT EXISTS tasks JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE prep_plans ADD COLUMN IF NOT EXISTS resources JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE prep_plans ADD COLUMN IF NOT EXISTS flashcards JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE prep_plans ADD COLUMN IF NOT EXISTS time_per_day INTEGER DEFAULT 120;
ALTER TABLE prep_plans ADD COLUMN IF NOT EXISTS duration_months INTEGER NOT NULL DEFAULT 1;
ALTER TABLE prep_plans ADD COLUMN IF NOT EXISTS target_role VARCHAR(120);
ALTER TABLE prep_plans ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE prep_plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE prep_plans ADD COLUMN IF NOT EXISTS source_plan_id UUID REFERENCES prep_plans(id) ON DELETE SET NULL;
ALTER TABLE prep_plans ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE prep_plans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE prep_plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE mentor_messages ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE mentor_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE apk_versions ADD COLUMN IF NOT EXISTS public_id TEXT;
ALTER TABLE apk_versions ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120);
ALTER TABLE apk_versions ADD COLUMN IF NOT EXISTS bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE apk_versions ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(30) NOT NULL DEFAULT 'cloudinary';
ALTER TABLE apk_versions ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE apk_versions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE apk_versions ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE apk_versions ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE apk_versions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE apk_versions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_tasks_user_scheduled_for ON tasks(user_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_created_at ON tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due_at_active ON tasks(user_id, due_at ASC)
WHERE status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_tasks_admin_assignment_lookup ON tasks((metadata->>'shareKind'), user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_prep_architect_plan_lookup ON tasks(user_id, (metadata->>'planId'), scheduled_for DESC, created_at DESC)
WHERE metadata->>'source' = 'prep-architect';
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_power_pocket_user_started_at ON power_pocket_sessions(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_progress_stats_user_date ON progress_stats(user_id, stat_date);
CREATE INDEX IF NOT EXISTS idx_images_user_proof_date ON images(user_id, proof_date);
CREATE INDEX IF NOT EXISTS idx_resumes_user_active ON resumes(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at ON app_settings(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_billing_customers_user_id ON billing_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_status ON billing_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_customer ON billing_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_type_created_at ON billing_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);
CREATE INDEX IF NOT EXISTS idx_invites_created_at ON invites(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invites_unused_expires_at ON invites(used, expires_at);
CREATE INDEX IF NOT EXISTS idx_invites_used_by ON invites(used_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prep_plans_user_active ON prep_plans(user_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prep_plans_user_created_at ON prep_plans(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentor_messages_user_created_at ON mentor_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_sent_at ON notifications(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_jobs_ready ON delivery_jobs(status, available_at ASC, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_jobs_type_dedupe
ON delivery_jobs(type, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_apk_versions_active_uploaded_at ON apk_versions(is_active, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_groups_created_at ON coach_groups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_group_members_user_id ON coach_group_members(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coach_groups_name_unique ON coach_groups (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_coach_group_members_user_unique ON coach_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_stats_user_created_at ON progress_stats(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_stats_user_id_created_at ON progress_stats(id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_admin_assignment_id ON tasks((metadata->>'assignmentId'), user_id, created_at DESC)
WHERE metadata->>'shareKind' IN ('admin-practice-link', 'admin-assignment');

CREATE TABLE IF NOT EXISTS assessment_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES prep_plans(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  assessment_type VARCHAR(30) NOT NULL DEFAULT 'mcq',
  duration_minutes INTEGER NOT NULL DEFAULT 20,
  weak_spots TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  recommendations JSONB NOT NULL DEFAULT '[]'::JSONB,
  questions JSONB NOT NULL DEFAULT '[]'::JSONB,
  submission JSONB NOT NULL DEFAULT '{}'::JSONB,
  score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assessment_sessions_status_check CHECK (status IN ('draft', 'started', 'completed', 'skipped')),
  CONSTRAINT assessment_sessions_type_check CHECK (assessment_type IN ('mcq', 'fill_blank', 'coding', 'ordering', 'coding_lab'))
);

ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES prep_plans(id) ON DELETE SET NULL;
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft';
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS assessment_type VARCHAR(30) NOT NULL DEFAULT 'mcq';
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 20;
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS weak_spots TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS recommendations JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS questions JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS submission JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE assessment_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE assessment_sessions DROP CONSTRAINT IF EXISTS assessment_sessions_status_check;
ALTER TABLE assessment_sessions
ADD CONSTRAINT assessment_sessions_status_check CHECK (status IN ('draft', 'started', 'completed', 'skipped'));

ALTER TABLE assessment_sessions DROP CONSTRAINT IF EXISTS assessment_sessions_type_check;
ALTER TABLE assessment_sessions
ADD CONSTRAINT assessment_sessions_type_check CHECK (assessment_type IN ('mcq', 'fill_blank', 'coding', 'ordering', 'coding_lab'));

CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user_created_at ON assessment_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user_status ON assessment_sessions(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_plan_id ON assessment_sessions(plan_id, created_at DESC);

CREATE TABLE IF NOT EXISTS coding_submissions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  problem JSONB NOT NULL DEFAULT '{}'::JSONB,
  language VARCHAR(40) NOT NULL,
  source_code TEXT NOT NULL,
  stdin TEXT,
  expected_output TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'queued',
  stdout TEXT,
  stderr TEXT,
  compile_output TEXT,
  judge_token TEXT,
  time NUMERIC(8, 3),
  memory INTEGER,
  test_results JSONB NOT NULL DEFAULT '[]'::JSONB,
  analysis JSONB NOT NULL DEFAULT '{}'::JSONB,
  rubric JSONB NOT NULL DEFAULT '{}'::JSONB,
  score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coding_submissions_status_check CHECK (status IN ('queued', 'processing', 'accepted', 'wrong_answer', 'compile_error', 'runtime_error', 'timeout', 'failed', 'analysis_only'))
);

ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS problem JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS language VARCHAR(40) NOT NULL DEFAULT 'python';
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS source_code TEXT NOT NULL DEFAULT '';
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS stdin TEXT;
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS expected_output TEXT;
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'queued';
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS stdout TEXT;
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS stderr TEXT;
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS compile_output TEXT;
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS judge_token TEXT;
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS time NUMERIC(8, 3);
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS memory INTEGER;
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS test_results JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS analysis JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS rubric JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE coding_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE coding_submissions DROP CONSTRAINT IF EXISTS coding_submissions_status_check;
ALTER TABLE coding_submissions
ADD CONSTRAINT coding_submissions_status_check CHECK (status IN ('queued', 'processing', 'accepted', 'wrong_answer', 'compile_error', 'runtime_error', 'timeout', 'failed', 'analysis_only'));

CREATE INDEX IF NOT EXISTS idx_coding_submissions_user_created_at ON coding_submissions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coding_submissions_task_created_at ON coding_submissions(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coding_submissions_status_created_at ON coding_submissions(status, created_at DESC);

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
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'app_settings_set_updated_at') THEN
    CREATE TRIGGER app_settings_set_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'prep_plans_set_updated_at') THEN
    CREATE TRIGGER prep_plans_set_updated_at BEFORE UPDATE ON prep_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'notifications_set_updated_at') THEN
    CREATE TRIGGER notifications_set_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'delivery_jobs_set_updated_at') THEN
    CREATE TRIGGER delivery_jobs_set_updated_at BEFORE UPDATE ON delivery_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'push_subscriptions_set_updated_at') THEN
    CREATE TRIGGER push_subscriptions_set_updated_at BEFORE UPDATE ON push_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'coach_groups_set_updated_at') THEN
    CREATE TRIGGER coach_groups_set_updated_at BEFORE UPDATE ON coach_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'apk_versions_set_updated_at') THEN
    CREATE TRIGGER apk_versions_set_updated_at BEFORE UPDATE ON apk_versions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'assessment_sessions_set_updated_at') THEN
    CREATE TRIGGER assessment_sessions_set_updated_at BEFORE UPDATE ON assessment_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'coding_submissions_set_updated_at') THEN
    CREATE TRIGGER coding_submissions_set_updated_at BEFORE UPDATE ON coding_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
