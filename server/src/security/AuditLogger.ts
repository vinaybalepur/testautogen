import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const cfg = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'config/security.json'), 'utf-8')
).audit;

export interface AuditEntry {
  requestId:    string;
  timestamp:    string;
  userId:       number | null;
  userRole:     string | null;
  ip:           string;
  method:       string;
  path:         string;
  statusCode:   number;
  durationMs:   number;
  userAgent:    string;
  guardrailsTriggered: string[];
  securityFlags:       string[];
}

// In-memory circular buffer — last 1000 entries
const LOG_BUFFER_SIZE = 1000;
const auditLog: AuditEntry[] = [];

function maskSensitive(obj: Record<string, any>): Record<string, any> {
  const masked: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    masked[k] = (cfg.sensitiveFields as string[]).some((f: string) => k.toLowerCase().includes(f))
      ? '[REDACTED]'
      : v;
  }
  return masked;
}

export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  if (!cfg.enabled) return next();
  if ((cfg.skipPaths as string[]).some((p: string) => req.path.startsWith(p))) return next();

  const start = Date.now();
  const ip    = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown')
                  .split(',')[0].trim();

  res.on('finish', () => {
    const entry: AuditEntry = {
      requestId:    (req as any).requestId || 'unknown',
      timestamp:    new Date().toISOString(),
      userId:       (req as any).userId    ?? null,
      userRole:     (req as any).role      ?? null,
      ip,
      method:       req.method,
      path:         req.path,
      statusCode:   res.statusCode,
      durationMs:   Date.now() - start,
      userAgent:    req.headers['user-agent'] || '',
      guardrailsTriggered: (req as any).guardrailsTriggered || [],
      securityFlags:       (req as any).securityFlags       || [],
    };

    // Push to circular buffer
    if (auditLog.length >= LOG_BUFFER_SIZE) auditLog.shift();
    auditLog.push(entry);
  });

  next();
}

export function getAuditLog(limit = 100): AuditEntry[] {
  return auditLog.slice(-limit).reverse();
}

export function getAuditStats() {
  const total    = auditLog.length;
  const errors   = auditLog.filter(e => e.statusCode >= 400).length;
  const blocked  = auditLog.filter(e => e.statusCode === 429 || e.statusCode === 403).length;
  const avgMs    = total ? Math.round(auditLog.reduce((s, e) => s + e.durationMs, 0) / total) : 0;
  return { total, errors, blocked, avgResponseMs: avgMs };
}

export { maskSensitive };
