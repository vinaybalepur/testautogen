-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  first_name      VARCHAR(50)  NOT NULL,
  last_name       VARCHAR(50)  NOT NULL,
  email           VARCHAR(150) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  role            VARCHAR(20) DEFAULT 'user'
                  CHECK (role IN ('admin', 'user')),
  last_login_at   TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- 2. REFRESH TOKENS
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  is_used     BOOLEAN DEFAULT FALSE,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user  ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- 3. TOKEN USAGE
CREATE TABLE IF NOT EXISTS token_usage (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider        VARCHAR(50),
  model_family    VARCHAR(50),
  model_version   VARCHAR(100),
  action          VARCHAR(100),
  tokens_consumed INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage(user_id);

-- 4. TEST CASES
CREATE TABLE IF NOT EXISTS test_cases (
  id               SERIAL PRIMARY KEY,
  jira_id          VARCHAR(50)  NOT NULL,
  user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
  test_case        TEXT NOT NULL,
  status           VARCHAR(20)  DEFAULT 'draft'
                   CHECK (status IN ('draft', 'approved', 'rejected', 'modified')),
  defect_jira_id   VARCHAR(50),
  jira_subtask_key VARCHAR(50),
  reviewed_by      INTEGER REFERENCES users(id),
  reviewed_at      TIMESTAMP,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_test_cases_updated
  BEFORE UPDATE ON test_cases
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE INDEX IF NOT EXISTS idx_test_cases_jira_id ON test_cases(jira_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_user_id  ON test_cases(user_id);

-- 5. POSTMAN COLLECTIONS
CREATE TABLE IF NOT EXISTS postman_collections (
  id              SERIAL PRIMARY KEY,
  ticket_key      VARCHAR(50)  NOT NULL,
  user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
  collection_name VARCHAR(200),
  collection_json JSONB NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_postman_collections_ticket ON postman_collections(ticket_key);
CREATE INDEX IF NOT EXISTS idx_postman_collections_user   ON postman_collections(user_id);

-- 6. TEST RUNS
CREATE TABLE IF NOT EXISTS test_runs (
  id            SERIAL PRIMARY KEY,
  collection_id INTEGER REFERENCES postman_collections(id) ON DELETE CASCADE,
  ticket_key    VARCHAR(50)  NOT NULL,
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status        VARCHAR(20) DEFAULT 'pending'
                CHECK (status IN ('pending', 'running', 'passed', 'failed', 'error', 'timeout')),
  total_tests   INTEGER DEFAULT 0,
  passed        INTEGER DEFAULT 0,
  failed        INTEGER DEFAULT 0,
  skipped       INTEGER DEFAULT 0,
  duration_ms   INTEGER DEFAULT 0,
  report_json   JSONB,
  report_html   TEXT,
  report_path   TEXT,
  run_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_runs_collection ON test_runs(collection_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_ticket     ON test_runs(ticket_key);
CREATE INDEX IF NOT EXISTS idx_test_runs_user       ON test_runs(user_id);

-- 7. DEFECTS
CREATE TABLE IF NOT EXISTS defects (
  id              SERIAL PRIMARY KEY,
  test_case_id    INTEGER REFERENCES test_cases(id) ON DELETE CASCADE,
  run_id          INTEGER REFERENCES test_runs(id) ON DELETE CASCADE,
  ticket_key      VARCHAR(50),
  defect_jira_key VARCHAR(50),
  summary         TEXT,
  expected        TEXT,
  actual          TEXT,
  response_data   JSONB,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_defects_test_case ON defects(test_case_id);
CREATE INDEX IF NOT EXISTS idx_defects_run       ON defects(run_id);
CREATE INDEX IF NOT EXISTS idx_defects_ticket    ON defects(ticket_key);

-- 8. AI MODELS (cache + fallback)
CREATE TABLE IF NOT EXISTS ai_models (
  id           SERIAL PRIMARY KEY,
  provider     VARCHAR(50)  NOT NULL,
  model_id     VARCHAR(100) NOT NULL,
  model_name   VARCHAR(100) NOT NULL,
  is_active    BOOLEAN DEFAULT TRUE,
  last_synced  TIMESTAMP DEFAULT NOW(),
  UNIQUE (provider, model_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider);

-- 9. USER AI CONFIGS (encrypted keys)
CREATE TABLE IF NOT EXISTS user_ai_configs (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider   VARCHAR(50) NOT NULL,
  api_key    TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_ai_configs_user     ON user_ai_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ai_configs_provider ON user_ai_configs(provider);

-- Add role to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'
CHECK (role IN ('admin', 'user'));

-- Add status modified to test_cases
ALTER TABLE test_cases DROP CONSTRAINT IF EXISTS test_cases_status_check;
ALTER TABLE test_cases ADD CONSTRAINT test_cases_status_check
CHECK (status IN ('draft', 'approved', 'rejected', 'modified'));

-- Add extra columns to test_cases
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS defect_jira_id   VARCHAR(50);
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS jira_subtask_key VARCHAR(50);

-- Add report_path to test_runs
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS report_path TEXT;

-- Add timeout to test_runs status check
ALTER TABLE test_runs DROP CONSTRAINT IF EXISTS test_runs_status_check;
ALTER TABLE test_runs ADD CONSTRAINT test_runs_status_check
CHECK (status IN ('pending', 'running', 'passed', 'failed', 'error', 'timeout'));

-- Adding new status to DB called approved_modifed. This will help in taking of care of modified test cases

ALTER TABLE test_cases DROP CONSTRAINT IF EXISTS test_cases_status_check;
ALTER TABLE test_cases ADD CONSTRAINT test_cases_status_check
CHECK (status IN ('draft', 'approved', 'rejected', 'modified', 'approved_modified'));

-- ── Discovery columns for api_registry ────────────────
ALTER TABLE api_registry
ADD COLUMN IF NOT EXISTS response_schema JSONB,
ADD COLUMN IF NOT EXISTS discovered_at   TIMESTAMP;

-- ── Collection Discovery (per ticket chain) ────────────
CREATE TABLE IF NOT EXISTS collection_discovery (
  id               SERIAL PRIMARY KEY,
  ticket_key       VARCHAR(50) NOT NULL UNIQUE,
  status           VARCHAR(20) DEFAULT 'pending'
                   CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  run_by           INTEGER REFERENCES users(id),
  api_ids          JSONB,
  base_url         TEXT,
  response_schemas JSONB,
  extracted_vars   JSONB,
  api_chain        JSONB,
  error            TEXT,
  started_at       TIMESTAMP,
  completed_at     TIMESTAMP,
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_discovery ON collection_discovery(ticket_key);

-- ── Add missing columns to collection_discovery ────────
ALTER TABLE collection_discovery
ADD COLUMN IF NOT EXISTS api_ids  JSONB,
ADD COLUMN IF NOT EXISTS base_url TEXT;
