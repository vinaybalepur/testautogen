import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const cfg = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'config/security.json'), 'utf-8')
).rateLimit;

interface Window { count: number; resetAt: number; }

const globalWin: Window   = { count: 0, resetAt: Date.now() + cfg.global.windowMs };
const perUserMap           = new Map<string, Window>();
const perIpMap             = new Map<string, Window>();
const perAiMap             = new Map<string, Window>();

function tick(map: Map<string, Window>, key: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  let w = map.get(key);
  if (!w || now >= w.resetAt) { w = { count: 0, resetAt: now + windowMs }; map.set(key, w); }
  w.count++;
  return w.count <= max;
}

function tickGlobal(): boolean {
  const now = Date.now();
  if (now >= globalWin.resetAt) { globalWin.count = 0; globalWin.resetAt = now + cfg.global.windowMs; }
  globalWin.count++;
  return globalWin.count <= cfg.global.maxRequests;
}

function windowRemaining(map: Map<string, Window>, key: string, max: number): number {
  const w = map.get(key);
  return w ? Math.max(0, max - w.count) : max;
}

const isAiPath = (p: string) =>
  (cfg.aiPaths as string[]).some((ap: string) => p.startsWith(ap));

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (!cfg.enabled) return next();

  const ip     = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown')
                   .split(',')[0].trim();
  const userId = (req as any).userId ? String((req as any).userId) : null;

  // OWASP API4 — Unrestricted Resource Consumption
  if (!tickGlobal()) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({ error: 'Server is busy. Try again in a minute.', code: 'RATE_LIMIT_GLOBAL' });
    return;
  }
  if (!tick(perIpMap, ip, cfg.perIp.windowMs, cfg.perIp.maxRequests)) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({ error: 'Too many requests from your IP.', code: 'RATE_LIMIT_IP' });
    return;
  }
  if (userId && !tick(perUserMap, userId, cfg.perUser.windowMs, cfg.perUser.maxRequests)) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({ error: 'Request limit reached. Please wait.', code: 'RATE_LIMIT_USER' });
    return;
  }
  if (isAiPath(req.path)) {
    const key = userId || ip;
    if (!tick(perAiMap, key, cfg.aiEndpoints.windowMs, cfg.aiEndpoints.maxRequests)) {
      res.setHeader('Retry-After', '60');
      res.status(429).json({ error: 'AI generation limit reached. Please wait.', code: 'RATE_LIMIT_AI' });
      return;
    }
  }

  if (userId) res.setHeader('X-RateLimit-Remaining', windowRemaining(perUserMap, userId, cfg.perUser.maxRequests));
  next();
}

export function getRateLimitStats() {
  return { globalCount: globalWin.count, activeUsers: perUserMap.size, activeIps: perIpMap.size, activeAi: perAiMap.size };
}
