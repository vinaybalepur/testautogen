import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

const cfg = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'config/security.json'), 'utf-8')
).headers;

/**
 * Applies enterprise-grade security response headers.
 * Covers OWASP API8 (Security Misconfiguration).
 *
 * Headers applied:
 *  - Strict-Transport-Security (HSTS)
 *  - Content-Security-Policy (CSP)
 *  - X-Frame-Options
 *  - X-Content-Type-Options
 *  - X-XSS-Protection
 *  - Referrer-Policy
 *  - Permissions-Policy
 *  - X-Request-ID  (correlation)
 *  - Remove: X-Powered-By, Server
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  if (!cfg.enabled) return next();

  // Attach a unique request ID for correlation
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('X-Request-ID', requestId);
  (req as any).requestId = requestId;

  // HSTS — only over HTTPS; safe to always set, browsers ignore over HTTP
  res.setHeader('Strict-Transport-Security', cfg.hsts);

  // CSP
  res.setHeader('Content-Security-Policy', cfg.csp);

  // Clickjacking prevention
  res.setHeader('X-Frame-Options', cfg.frameOptions);

  // MIME sniffing prevention
  if (cfg.noSniff) res.setHeader('X-Content-Type-Options', 'nosniff');

  // Legacy XSS protection (IE/Chrome <57)
  res.setHeader('X-XSS-Protection', cfg.xssProtection);

  // Referrer
  res.setHeader('Referrer-Policy', cfg.referrerPolicy);

  // Permissions Policy (formerly Feature-Policy)
  res.setHeader('Permissions-Policy', cfg.permissionsPolicy);

  // Cache control for API responses — prevent caching sensitive data
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }

  // Remove fingerprinting headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
}
