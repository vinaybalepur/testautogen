// ── Auth ────────────────────────────────────────────
export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: 'admin' | 'user';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

// ── Test Cases ──────────────────────────────────────
export type TestCaseStatus = 'draft' | 'approved' | 'rejected' | 'modified';

export interface TestCase {
  id: number;
  jira_id: string;
  user_id: number;
  test_case: string;
  status: TestCaseStatus;
  defect_jira_id: string | null;
  jira_subtask_key: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Postman ─────────────────────────────────────────
export interface PostmanCollection {
  id: number;
  ticket_key: string;
  user_id: number;
  collection_name: string;
  collection_json: object;
  created_at: string;
}

// ── Test Runs ───────────────────────────────────────
export type RunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'error' | 'timeout';

export interface TestRun {
  id: number;
  collection_id: number;
  ticket_key: string;
  user_id: number;
  status: RunStatus;
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  report_json: object | null;
  report_html: string | null;
  report_path: string | null;
  run_at: string;
}

// ── Defects ─────────────────────────────────────────
export interface Defect {
  id: number;
  test_case_id: number | null;
  run_id: number | null;
  ticket_key: string | null;
  defect_jira_key: string | null;
  summary: string | null;
  expected: string | null;
  actual: string | null;
  response_data: object | null;
  created_at: string;
}

// ── Token Usage ─────────────────────────────────────
export interface TokenUsage {
  id: number;
  user_id: number;
  provider: string;
  model_family: string;
  model_version: string;
  action: string;
  tokens_consumed: number;
  created_at: string;
}

// ── Jira ────────────────────────────────────────────
export interface JiraTicket {
  id: string;
  key: string;
  summary: string;
  description: string | null;
  status: string;
  priority: string;
  issueType: string;
  reporter: string;
  assignee: string | null;
}

// ── API Generic ─────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
