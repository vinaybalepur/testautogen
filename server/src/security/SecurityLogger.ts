// Security event logger — threat events, violations, blocked IPs

export type ThreatLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityEvent {
  id:          string;
  timestamp:   string;
  level:       ThreatLevel;
  type:        string;   // e.g. PROMPT_INJECTION, BRUTE_FORCE, RATE_LIMIT, ANOMALY
  ip:          string;
  userId:      number | null;
  path:        string;
  description: string;
  metadata?:   Record<string, any>;
}

const EVENT_BUFFER_SIZE = 500;
const events: SecurityEvent[] = [];

// Blocked IPs: ip -> unblockAt timestamp
const blockedIps = new Map<string, number>();

let idCounter = 0;
function nextId(): string { return `sec_${Date.now()}_${(++idCounter).toString(36)}`; }

export const SecurityLogger = {
  log(
    level: ThreatLevel,
    type: string,
    ip: string,
    path: string,
    description: string,
    userId: number | null = null,
    metadata?: Record<string, any>
  ): SecurityEvent {
    const event: SecurityEvent = {
      id: nextId(), timestamp: new Date().toISOString(),
      level, type, ip, userId, path, description, metadata,
    };
    if (events.length >= EVENT_BUFFER_SIZE) events.shift();
    events.push(event);

    // Console output for dev visibility
    const prefix = level === 'CRITICAL' ? '🔴' : level === 'HIGH' ? '🟠' : level === 'MEDIUM' ? '🟡' : '🔵';
    console.warn(`${prefix} [SECURITY] ${type} | ${ip} | ${path} | ${description}`);

    return event;
  },

  blockIp(ip: string, durationMs: number): void {
    blockedIps.set(ip, Date.now() + durationMs);
    SecurityLogger.log('HIGH', 'IP_BLOCKED', ip, '*', `IP blocked for ${durationMs / 60000} minutes`);
  },

  isBlocked(ip: string): boolean {
    const until = blockedIps.get(ip);
    if (!until) return false;
    if (Date.now() >= until) { blockedIps.delete(ip); return false; }
    return true;
  },

  unblockIp(ip: string): void { blockedIps.delete(ip); },

  getEvents(limit = 50, level?: ThreatLevel): SecurityEvent[] {
    const filtered = level ? events.filter(e => e.level === level) : events;
    return filtered.slice(-limit).reverse();
  },

  getBlockedIps(): Array<{ ip: string; unblockAt: string }> {
    const now = Date.now();
    const result: Array<{ ip: string; unblockAt: string }> = [];
    for (const [ip, until] of blockedIps.entries()) {
      if (now < until) result.push({ ip, unblockAt: new Date(until).toISOString() });
    }
    return result;
  },

  getSummary() {
    const counts: Record<ThreatLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const e of events) counts[e.level]++;
    return {
      totalEvents: events.length,
      ...counts,
      blockedIps: blockedIps.size,
      topThreats: getTopThreats(),
    };
  },
};

function getTopThreats(): Array<{ type: string; count: number }> {
  const freq: Record<string, number> = {};
  for (const e of events) freq[e.type] = (freq[e.type] || 0) + 1;
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));
}
