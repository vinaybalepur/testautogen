import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api       from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user:     User | null;
  loading:  boolean;
  login:    (email: string, password: string) => Promise<User>;
  register: (first_name: string, last_name: string, email: string, password: string) => Promise<User>;
  logout:   () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const { data } = await api.post('/auth/login', { email, password });
    console.log('Login response:', data);      // ← add this
    console.log('User object:', data.user); 
    setUser(data.user);
    return data.user;
  };

  const register = async (
    first_name: string,
    last_name:  string,
    email:      string,
    password:   string
  ): Promise<User> => {
    const { data } = await api.post('/auth/register', { first_name, last_name, email, password });
    setUser(data.user);
    return data.user;
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore errors
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};