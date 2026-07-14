import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db';
import { User } from '../types';
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  setTokenCookies,
  clearTokenCookies
} from '../utils/tokens';

// ── REGISTER ──────────────────────────────────────────
export const register = async (req: Request, res: Response): Promise<void> => {
  const { first_name, last_name, email, password } = req.body;

  // Validate inputs
  if (!first_name || !last_name || !email || !password) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  try {
    // Check if email already exists
    const existing = await pool.query<User>(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Check if any users exist
    const userCount = await pool.query(
      'SELECT COUNT(*) FROM users'
    );

    // First user gets admin role automatically
    const role = parseInt(userCount.rows[0].count) === 0 ? 'admin' : 'user';

    // Insert new user
    // Insert new user
    const result = await pool.query<User>(
      `INSERT INTO users (first_name, last_name, email, password_hash, role)
   VALUES ($1, $2, $3, $4, $5)
   RETURNING id, first_name, last_name, email, role, created_at`,
      [first_name, last_name, email, password_hash, role]
    );

    const user = result.rows[0];

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();

    await storeRefreshToken(user.id, refreshToken);
    setTokenCookies(res, accessToken, refreshToken);

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        first_name: user.first_name,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── LOGIN ─────────────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    // Find active user by email
    const result = await pool.query<User>(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid or expired email' });
      return;
    }

    const user = result.rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    // Update last login timestamp
    await pool.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Invalidate all previous refresh tokens for this user
    await pool.query(
      'UPDATE refresh_tokens SET is_used = TRUE WHERE user_id = $1',
      [user.id]
    );

    // Generate fresh tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();

    // Store new refresh token in DB
    await storeRefreshToken(user.id, refreshToken);

    // Set both cookies
    setTokenCookies(res, accessToken, refreshToken);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        first_name: user.first_name,
        email: user.email
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── REFRESH ───────────────────────────────────────────
export const refresh = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies.refresh_token;

  if (!refreshToken) {
    res.status(401).json({ error: 'No refresh token provided' });
    return;
  }

  try {
    // Find refresh token in DB
    const result = await pool.query(
      `SELECT * FROM refresh_tokens
       WHERE token = $1
       AND is_used = FALSE
       AND expires_at > NOW()`,
      [refreshToken]
    );

    if (result.rows.length === 0) {
      // Token not found, already used, or expired
      // Could be a replay attack — clear cookies and force login
      clearTokenCookies(res);
      res.status(401).json({ error: 'Invalid session. Please login again' });
      return;
    }

    const storedToken = result.rows[0];

    // Mark current refresh token as used (one time use)
    await pool.query(
      'UPDATE refresh_tokens SET is_used = TRUE WHERE id = $1',
      [storedToken.id]
    );

    // Generate new token pair
    const newAccessToken = generateAccessToken(storedToken.user_id);
    const newRefreshToken = generateRefreshToken();

    // Store new refresh token
    await storeRefreshToken(storedToken.user_id, newRefreshToken);

    // Set new cookies
    setTokenCookies(res, newAccessToken, newRefreshToken);

    res.json({ message: 'Token refreshed successfully' });

  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── LOGOUT ────────────────────────────────────────────
export const logout = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies.refresh_token;

  if (refreshToken) {
    // Invalidate refresh token in DB
    await pool.query(
      'UPDATE refresh_tokens SET is_used = TRUE WHERE token = $1',
      [refreshToken]
    );
  }

  clearTokenCookies(res);
  res.json({ message: 'Logged out successfully' });
};

// ── GET CURRENT USER ──────────────────────────────────
export const me = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<User>(
      `SELECT id, first_name, last_name, email, last_login_at, created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: result.rows[0] });

  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};