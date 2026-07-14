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