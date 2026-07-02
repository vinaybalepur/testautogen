import jwt    from 'jsonwebtoken';
import crypto from 'crypto';
import pool   from '../config/db';
import { Response } from 'express';

// ── Generate Access Token (short lived 15 mins) ───────
export const generateAccessToken = (userId: number): string => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET as string,
    { expiresIn: '15m' }
  );
};

// ── Generate Refresh Token (long lived 7 days) ────────
export const generateRefreshToken = (): string => {
  // Cryptographically secure random token
  return crypto.randomBytes(64).toString('hex');
};

// ── Store Refresh Token in DB ─────────────────────────
export const storeRefreshToken = async (
  userId: number,
  token:  string
): Promise<void> => {
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '1 day')`,
    [userId, token]
  );
};

// ── Set Both Cookies ──────────────────────────────────
export const setTokenCookies = (
  res:          Response,
  accessToken:  string,
  refreshToken: string
): void => {
  // Access token cookie — 15 mins
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   15 * 60 * 1000                          // 15 mins in ms
  });

  // Refresh token cookie — 7 days
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   24 * 60 * 60 * 1000                // 1 day in ms
  });
};

// ── Clear Both Cookies ────────────────────────────────
export const clearTokenCookies = (res: Response): void => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
};