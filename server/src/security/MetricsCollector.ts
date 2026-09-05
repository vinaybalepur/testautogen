// In-memory metrics counters for the security dashboard

import { getRateLimitStats }   from './RateLimiter';
import { getBruteForceStats }  from './BruteForceGuard';
import { getAnomalyStats }     from './AnomalyDetector';
import { getAuditStats }       from './AuditLogger';
import { SecurityLogger }      from './SecurityLogger';

interface Counter { value: number; lastReset: number; }

const counters: Record<string, Counter> = {};

function inc(key: string, by = 1): void {
  if (!counters[key]) counters[key] = { value: 0, lastReset: Date.now() };
  counters[key].value += by;
}

export const Metrics = {
  // ── Increment helpers ──
  requestTotal:        () => inc('req.total'),
  requestBlocked:      () => inc('req.blocked'),
  promptInjection:     () => inc('threat.prompt_injection'),
  jailbreak:           () => inc('threat.jailbreak'),
  piiMasked:           () => inc('threat.pii_masked'),
  secretMasked:        () => inc('threat.secret_masked'),
  sqlInjection:        () => inc('threat.sql_injection'),
  xssAttempt:          () => inc('threat.xss'),
  commandInjection:    () => inc('threat.command_injection'),
  bruteForce:          () => inc('threat.brute_force'),
  rateLimitHit:        () => inc('threat.rate_limit'),
  anomalyDetected:     () => inc('threat.anomaly'),
  hallucinationBlocked:() => inc('threat.hallucination'),
  policyViolation:     () => inc('threat.policy_violation'),
  aiRequestTotal:      () => inc('ai.total'),
  aiRequestBlocked:    () => inc('ai.blocked'),

  // ── Snapshot ──
  snapshot(): Record<string, any> {
    return {
      timestamp:    new Date().toISOString(),
      counters:     { ...Object.fromEntries(Object.entries(counters).map(([k, v]) => [k, v.value])) },
      rateLimit:    getRateLimitStats(),
      bruteForce:   getBruteForceStats(),
      anomaly:      getAnomalyStats(),
      audit:        getAuditStats(),
      security:     SecurityLogger.getSummary(),
    };
  },

  // ── Dashboard report ──
  dashboard(): Record<string, any> {
    const snap  = Metrics.snapshot();
    const evts  = SecurityLogger.getEvents(20);
    const blocked = SecurityLogger.getBlockedIps();
    return {
      ...snap,
      recentEvents:  evts,
      blockedIps:    blocked,
      generatedAt:   new Date().toISOString(),
    };
  },

  get(key: string): number { return counters[key]?.value ?? 0; },
  reset(key: string): void  { if (counters[key]) counters[key].value = 0; },
};
