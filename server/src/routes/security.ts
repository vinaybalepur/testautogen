import { Router, Request, Response } from 'express';
import authenticate from '../middleware/authenticate';
import isAdmin      from '../middleware/isAdmin';
import { Metrics }           from '../security/MetricsCollector';
import { SecurityLogger }    from '../security/SecurityLogger';
import { getAuditLog }       from '../security/AuditLogger';
import { getRateLimitStats } from '../security/RateLimiter';
import { getBruteForceStats, unlockIp } from '../security/BruteForceGuard';
import { getAnomalyStats, resetViolations } from '../security/AnomalyDetector';

const router = Router();

// ── All security routes require admin ─────────────────

/**
 * GET /api/security/report
 * Full security dashboard snapshot — metrics, top threats, blocked IPs.
 */
router.get('/report', authenticate, isAdmin, (_req: Request, res: Response) => {
  res.json(Metrics.dashboard());
});

/**
 * GET /api/security/events
 * Recent security events. Query: ?limit=50&level=HIGH
 */
router.get('/events', authenticate, isAdmin, (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string || '50'), 200);
  const level = req.query.level as any;
  res.json({
    events: SecurityLogger.getEvents(limit, level),
    blockedIps: SecurityLogger.getBlockedIps(),
  });
});

/**
 * GET /api/security/audit
 * Structured audit log of all requests.  Query: ?limit=100
 */
router.get('/audit', authenticate, isAdmin, (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string || '100'), 500);
  res.json({ entries: getAuditLog(limit) });
});

/**
 * GET /api/security/metrics
 * Raw counter snapshot.
 */
router.get('/metrics', authenticate, isAdmin, (_req: Request, res: Response) => {
  res.json({
    rateLimit:  getRateLimitStats(),
    bruteForce: getBruteForceStats(),
    anomaly:    getAnomalyStats(),
    counters:   Metrics.snapshot(),
  });
});

/**
 * POST /api/security/block
 * Manually block an IP.  Body: { ip, durationMinutes? }
 */
router.post('/block', authenticate, isAdmin, (req: Request, res: Response) => {
  const { ip, durationMinutes = 60 } = req.body;
  if (!ip) { res.status(400).json({ error: 'ip is required' }); return; }
  SecurityLogger.blockIp(ip, durationMinutes * 60 * 1000);
  res.json({ message: `IP ${ip} blocked for ${durationMinutes} minutes` });
});

/**
 * DELETE /api/security/block/:ip
 * Unblock an IP manually.
 */
router.delete('/block/:ip', authenticate, isAdmin, (req: Request, res: Response) => {
  const ip = String(req.params.ip);
  SecurityLogger.unblockIp(ip);
  unlockIp(ip);
  resetViolations(ip);
  res.json({ message: `IP ${ip} unblocked` });
});

export default router;
