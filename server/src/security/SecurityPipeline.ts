/**
 * SecurityPipeline
 * ─────────────────
 * Single Express middleware that runs the full HTTP security stack:
 *
 *   1. Blocked IP check
 *   2. Security Headers (HSTS, CSP, X-Frame …)
 *   3. Audit Logger (attach request ID, record on finish)
 *   4. Rate Limiter (global → per-IP → per-user → AI endpoints)
 *   5. Brute Force Guard (auth endpoint lockout)
 *   6. Anomaly Detector (UA scanners, path recon, velocity, body size)
 *   7. Repeat-offender auto-block
 *   8. Metrics increment
 *
 * The AI guardrails pipeline (input/output LLM guards) runs inside
 * individual controllers — this layer covers HTTP-level security.
 */
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

import { securityHeaders }                    from './SecurityHeaders';
import { auditLogger }                        from './AuditLogger';
import { rateLimiter }                        from './RateLimiter';
import { bruteForceGuard }                    from './BruteForceGuard';
import { anomalyDetector, getViolationCount } from './AnomalyDetector';
import { SecurityLogger }                     from './SecurityLogger';
import { Metrics }                            from './MetricsCollector';

const cfg = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'config/security.json'), 'utf-8')
);

function getIp(req: Request): string {
  return ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown')
    .split(',')[0].trim();
}

export function securityPipeline(req: Request, res: Response, next: NextFunction): void {
  const ip = getIp(req);

  // 1 — Blocked IP check
  if (SecurityLogger.isBlocked(ip)) {
    Metrics.requestBlocked();
    res.status(403).json({ error: 'Access denied.', code: 'IP_BLOCKED' });
    return;
  }

  Metrics.requestTotal();

  // Sequential middleware chain
  securityHeaders(req, res, () =>
    auditLogger(req, res, () =>
      rateLimiter(req, res, () =>
        bruteForceGuard(req, res, () =>
          anomalyDetector(req, res, () => {

            // 7 — Repeat-offender auto-block
            if (cfg.threats.autoBlockRepeatOffenders) {
              const violations = getViolationCount(ip);
              if (violations >= cfg.threats.blockAfterViolations) {
                SecurityLogger.blockIp(ip, cfg.threats.blockDurationMs);
                Metrics.requestBlocked();
                SecurityLogger.log('HIGH', 'AUTO_BLOCKED', ip, req.path,
                  `Auto-blocked after ${violations} violations`,
                  (req as any).userId ?? null
                );
                res.status(403).json({ error: 'Access denied due to suspicious activity.', code: 'AUTO_BLOCKED' });
                return;
              }
            }

            // 8 — Log non-blocking anomalies for audit trail
            const threats: string[] = (req as any).anomalyThreats || [];
            if (threats.length > 0) {
              const level = threats.some(t =>
                t.startsWith('suspicious_ua') || t.startsWith('suspicious_path')
              ) ? 'HIGH' as const : 'MEDIUM' as const;
              SecurityLogger.log(level, 'ANOMALY', ip, req.path,
                threats.join(' | '), (req as any).userId ?? null, { threats }
              );
              Metrics.anomalyDetected();
            }

            next();
          })
        )
      )
    )
  );
}

/**
 * Call this from controllers/guardrail hooks to record an AI security event
 * into the security log and increment the relevant metric counter.
 */
export function logGuardrailEvent(
  req: Request,
  guardrailName: string,
  reason: string
): void {
  const ip = getIp(req);

  const metricMap: Record<string, () => void> = {
    PromptInjectionGuard:  Metrics.promptInjection,
    JailbreakDetector:     Metrics.jailbreak,
    PIIDetector:           Metrics.piiMasked,
    SecretDetector:        Metrics.secretMasked,
    SQLInjectionGuard:     Metrics.sqlInjection,
    XSSGuard:              Metrics.xssAttempt,
    CommandInjectionGuard: Metrics.commandInjection,
    HallucinationGuard:    Metrics.hallucinationBlocked,
  };
  metricMap[guardrailName]?.();

  const highSeverity = ['PromptInjectionGuard','JailbreakDetector','SQLInjectionGuard','CommandInjectionGuard'];
  const level = highSeverity.includes(guardrailName) ? 'HIGH' as const : 'MEDIUM' as const;

  SecurityLogger.log(level, guardrailName.toUpperCase(), ip, req.path, reason,
    (req as any).userId ?? null
  );

  if (!(req as any).guardrailsTriggered) (req as any).guardrailsTriggered = [];
  (req as any).guardrailsTriggered.push(guardrailName);
}
