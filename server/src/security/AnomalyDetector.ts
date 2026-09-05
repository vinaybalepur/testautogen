import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const cfg = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'config/security.json'), 'utf-8')
).anomaly;

// Track rapid requests per IP for velocity detection
const ipTimestamps = new Map<string, number[]>();
// Track cumulative violations per IP
const ipViolations = new Map<string, number>();

const uaPatterns   = (cfg.suspiciousUserAgents as string[]).map((s: string) => new RegExp(s, 'i'));
const pathPatterns = (cfg.suspiciousPathPatterns as string[]).map((s: string) => new RegExp(s, 'i'));

function getIp(req: Request): string {
  return ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown')
    .split(',')[0].trim();
}

export function anomalyDetector(req: Request, res: Response, next: NextFunction): void {
  if (!cfg.enabled) return next();

  const ip      = getIp(req);
  const ua      = (req.headers['user-agent'] || '').toLowerCase();
  const urlPath = req.originalUrl || req.path;
  const now     = Date.now();
  const threats: string[] = [];

  // ── 1. Suspicious User-Agent (OWASP API8) ──────────
  for (const p of uaPatterns) {
    if (p.test(ua)) { threats.push(`suspicious_ua:${p.source}`); break; }
  }

  // ── 2. Path Traversal / Recon (OWASP API9) ─────────
  for (const p of pathPatterns) {
    if (p.test(urlPath)) { threats.push(`suspicious_path:${p.source}`); break; }
  }

  // ── 3. Oversized Body (OWASP API4) ─────────────────
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > cfg.maxBodySizeBytes) {
    threats.push(`oversized_body:${contentLength}`);
  }

  // ── 4. Request Velocity (OWASP API4 / API6) ────────
  const times = (ipTimestamps.get(ip) || []).filter(t => now - t < cfg.rapidRequestThresholdMs);
  times.push(now);
  ipTimestamps.set(ip, times);
  if (times.length > cfg.rapidRequestCount) {
    threats.push(`rapid_requests:${times.length}`);
  }

  // ── 5. HTTP Method Anomaly ──────────────────────────
  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
  if (!allowedMethods.includes(req.method.toUpperCase())) {
    threats.push(`invalid_method:${req.method}`);
  }

  // ── 6. Host Header Injection ────────────────────────
  const host = req.headers.host || '';
  if (/[<>"'`;\\/]/.test(host)) {
    threats.push(`host_injection:${host.slice(0, 40)}`);
  }

  if (threats.length > 0) {
    // Accumulate violations
    const prev = ipViolations.get(ip) || 0;
    ipViolations.set(ip, prev + threats.length);

    // Attach to request for SecurityPipeline to log
    (req as any).anomalyThreats = threats;
    (req as any).anomalyIp      = ip;

    // Hard block only for path traversal / UA scanners
    const hardBlock = threats.some(t => t.startsWith('suspicious_path') || t.startsWith('suspicious_ua') || t.startsWith('host_injection'));
    if (hardBlock) {
      res.status(400).json({ error: 'Request rejected by security policy.', code: 'ANOMALY_DETECTED' });
      return;
    }
  }

  next();
}

export function getAnomalyStats() {
  return { trackedIps: ipTimestamps.size, totalViolations: [...ipViolations.values()].reduce((a, b) => a + b, 0) };
}

export function getViolationCount(ip: string): number { return ipViolations.get(ip) || 0; }
export function resetViolations(ip: string): void     { ipViolations.delete(ip); }
