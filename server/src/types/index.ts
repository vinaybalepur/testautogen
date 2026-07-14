export interface User {
  id:                     number;
  first_name:             string;
  last_name:              string;
  email:                  string;
  password_hash:          string;
  is_active:              boolean;
  last_login_at:          Date | null;
  created_at:             Date;
  role:                   string;
}

export interface JwtPayload {
  userId: number;
  iat:    number;
  exp:    number;
}

export interface RefreshToken {
  id:         number;
  user_id:    number;
  token:      string;
  is_used:    boolean;
  expires_at: Date;
  created_at: Date;
}



// Jira ticket fields
export interface JiraTicket {
  id:          string;
  key:         string;
  summary:     string;
  description: string | null;
  status:      string;
  priority:    string;
  issueType:   string;
  reporter:    string;
  assignee:    string | null;
}

// Cached ticket in our DB
export interface DBTicket {
  id:          number;
  user_id:     number;
  jira_id:     string;
  summary:     string;
  description: string | null;
  fetched_at:  Date;
}

// AI Provider request
export interface AIRequest {
  summary:     string;
  description: string | null;
  provider:    string;    // 'copilot', 'gemini', 'claude'
  model:       string;    // 'gpt-4o', 'gemini-2.5-flash' etc
}

// AI Provider response
export interface AIResponse {
  testCases:      string[];
  tokensConsumed: number;
  provider:       string;
  model:          string;
}

// Extends Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      role?:   string; 
    }
  }
}