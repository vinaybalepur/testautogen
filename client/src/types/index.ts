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

export interface JwtPayload {
  userId: number;
  iat: number;
  exp: number;
}
