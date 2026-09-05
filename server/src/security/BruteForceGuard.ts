import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const cfg = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'config/security.json'), 'utf-8')
).bruteForce;

interface Attempt { count: number; firstAt: number; lockedUntil: number | null; }

const attempts = new Map<string, Attempt>();

function key(ip: string, endpoint: string): string { return `${ip}::${endpoint}`; }

function isProtected(p: string): boolean {
  return (cfg.protectedEndpoints as string[]).some((e: string) => p === e || p.startsWith(e));
}

export function bruteForceGuard(req: Request, res: Response, next: NextFunction): void {
  if (!cfg.enabled || !isProtected(req.path)) return next();

  const ip = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown')
               .split(',')[0].trim();
  const k   = key(ip, req.path);
  const now = Date.now();
  let att   = attempts.get(k);

  // Reset window if expired
  if (att && now - att.firstAt > cfg.windowMs && !att.lockedUntil) {
    att = undefined;
    attempts.delete(k);
  }

  // Check lockout
  if (att?.lockedUntil && now < att.lockedUntil) {
    const retryAfter = Math.ceil((att.lockedUntil - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      error: `Too many failed attempts. Account locked for ${Math.ceil(retryAfter / 60)} minutes.`,
      code:  'BRUTE_FORCE_LOCKOUT',
      retryAfterSeconds: retryAfter,
    });
    return;
  }

  // Attach failure recorder to response so controllers can call it on auth failure
  (res as any).recordAuthFailure = () => {
    const current = attempts.get(k) || { count: 0, firstAt: now, lockedUntil: null };
    current.count++;
    if (current.count >= cfg.maxFailedAttempts) {
      current.lockedUntil = now + cfg.lockoutDurationMs;
    }
    attempts.set(k, current);
  };

  // Attach success clearer
  (res as any).clearAuthFailures = () => { attempts.delete(k); };

  next();
}

// Expose for metrics
export function getBruteForceStats() {
  let locked = 0;
  const now  = Date.now();
  for (const att of attempts.values()) { if (att.lockedUntil && now < att.lockedUntil) locked++; }
  return { trackedKeys: attempts.size, currentlyLocked: locked };
}

// Allow manual unlock (admin use)
export function unlockIp(ip: string): void {
  for (const k of attempts.keys()) { if (k.startsWith(`${ip}::`)) attempts.delete(k); }
}
