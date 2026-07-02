export interface User {
  id:                     number;
  first_name:             string;
  last_name:              string;
  email:                  string;
  password_hash:          string;
  is_active:              boolean;
  last_login_at:          Date | null;
  session_fingerprint:    string | null;
  fingerprint_created_at: Date | null;
  created_at:             Date;
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

// Extends Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}