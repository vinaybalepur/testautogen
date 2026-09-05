# SecuritySKILL.md
## Enterprise Security Testing Layer — TestAutoGen2

> **SKILL + MCP Approach**
> This document defines the security capabilities as a structured SKILL specification
> and maps each component to an MCP (Model Context Protocol) tool that AI agents
> can invoke to query, configure, and respond to security events.

---

## 1. SKILL Definition

A **SKILL** is a named, versioned, self-describing capability that an AI agent or
human can invoke with defined inputs, outputs, and side-effects.

```
SKILL: SecurityTesting
VERSION: 1.0.0
DOMAIN: API Security / LLM Security / Zero Trust
OWNER: testautogen2
ENTRY_POINT: server/src/security/SecurityPipeline.ts
CONFIG: server/src/security/config/security.json
```

---

## 2. Architecture

```
                        HTTP Request
                             │
                    ┌────────▼────────┐
                    │  securityPipeline│  ← single Express middleware
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────────┐
              ▼              ▼                  ▼
      SecurityHeaders    RateLimiter      BruteForceGuard
     (OWASP API8)      (OWASP API4)       (OWASP API2)
              │              │                  │
              └──────────────┼──────────────────┘
                             │
                    AnomalyDetector
                    (OWASP API6/9)
                             │
                    Repeat-offender
                    Auto-block check
                             │
                    ┌────────▼────────┐
                    │  Route Handler  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ AI Guardrails   │  ← LLM-layer security
                    │  Pipeline       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Response +     │
                    │  AuditLogger    │
                    └─────────────────┘
```

---

## 3. Security Components (SKILL Modules)

### 3.1 RateLimiter
**File:** `security/RateLimiter.ts`
**OWASP:** API4 — Unrestricted Resource Consumption

| Limit Type    | Window  | Max Requests | Key        |
|---------------|---------|--------------|------------|
| Global        | 60s     | 300          | server     |
| Per IP        | 60s     | 200          | IP address |
| Per User      | 60s     | 100          | userId     |
| AI Endpoints  | 60s     | 20           | userId/IP  |

**AI Endpoint paths:** `/api/ai/`, `/api/postman/generate`, `/api/discovery/`

**Response on limit:** `HTTP 429` with `Retry-After` header and `code: RATE_LIMIT_*`

---

### 3.2 BruteForceGuard
**File:** `security/BruteForceGuard.ts`
**OWASP:** API2 — Broken Authentication

| Config               | Value   |
|----------------------|---------|
| Max failed attempts  | 5       |
| Window               | 5 min   |
| Lockout duration     | 15 min  |

**Protected endpoints:**
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/refresh`

**Mechanism:** Attaches `res.recordAuthFailure()` and `res.clearAuthFailures()` hooks.
Controllers call these after auth success/failure.

---

### 3.3 AnomalyDetector
**File:** `security/AnomalyDetector.ts`
**OWASP:** API6 (Business Flow Abuse), API8 (Misconfiguration), API9 (Inventory)

**Checks:**
1. **Suspicious User-Agent** — sqlmap, nikto, nmap, burpsuite, zaproxy, hydra, ffuf, gobuster, etc.
2. **Path Traversal / Recon** — `.env`, `.git`, `wp-admin`, `etc/passwd`, `.aws/credentials`, `id_rsa`
3. **Oversized Body** — blocks requests > 512 KB
4. **Request Velocity** — blocks IPs making > 15 requests/second
5. **Invalid HTTP Method** — rejects non-standard methods
6. **Host Header Injection** — rejects headers with special characters

Hard-block (HTTP 400): UA scanners, path traversal, host injection.
Soft-flag (logged): velocity, oversized body.

---

### 3.4 SecurityHeaders
**File:** `security/SecurityHeaders.ts`
**OWASP:** API8 — Security Misconfiguration

| Header                      | Value                                     |
|-----------------------------|-------------------------------------------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains`     |
| `Content-Security-Policy`   | Restrictive — self + fonts only           |
| `X-Frame-Options`           | `DENY`                                    |
| `X-Content-Type-Options`    | `nosniff`                                 |
| `X-XSS-Protection`          | `1; mode=block`                           |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`         |
| `Permissions-Policy`        | camera, mic, geolocation, payment all off |
| `X-Request-ID`              | Unique per-request correlation ID         |
| API responses               | `Cache-Control: no-store, private`        |
| Removed                     | `X-Powered-By`, `Server`                 |

---

### 3.5 AuditLogger
**File:** `security/AuditLogger.ts`

Every request (except `/health`) is logged with:
- Request ID, timestamp, userId, userRole, IP
- Method, path, status code, duration
- User-Agent
- Guardrails triggered (from AI pipeline)
- Security flags

**Sensitive fields masked:** password, token, api_key, authorization, cookie, jwt, cvv, card_number

**Buffer:** Last 1000 entries in memory (circular).

---

### 3.6 SecurityLogger
**File:** `security/SecurityLogger.ts`

Structured security event log with severity levels:

| Level    | Examples                                       |
|----------|------------------------------------------------|
| CRITICAL | Data exfiltration, auth bypass                 |
| HIGH     | Prompt injection, SQL injection, auto-block    |
| MEDIUM   | PII detected, anomaly, rate limit              |
| LOW      | Suspicious UA, language warning                |

**Auto-block:** IPs accumulating ≥ 10 violations are blocked for 1 hour.

---

### 3.7 MetricsCollector
**File:** `security/MetricsCollector.ts`

In-memory counters:

| Counter                   | Tracks                         |
|---------------------------|--------------------------------|
| `req.total`               | All requests                   |
| `req.blocked`             | Blocked requests               |
| `threat.prompt_injection` | Prompt injection attempts      |
| `threat.jailbreak`        | Jailbreak attempts             |
| `threat.pii_masked`       | PII masking events             |
| `threat.secret_masked`    | Secret masking events          |
| `threat.sql_injection`    | SQL injection attempts         |
| `threat.xss`              | XSS attempts                   |
| `threat.command_injection`| Command injection attempts     |
| `threat.brute_force`      | Brute force lockouts           |
| `threat.rate_limit`       | Rate limit hits                |
| `threat.anomaly`          | Anomaly detections             |
| `threat.hallucination`    | Hallucination blocks           |
| `ai.total`                | AI generation requests         |
| `ai.blocked`              | Blocked AI requests            |

---

## 4. MCP Tool Definitions

MCP (Model Context Protocol) tools expose security functions to AI agents.
An agent can query metrics, read events, block IPs, or check policy status
without direct database access.

```json
{
  "tools": [

    {
      "name": "security.getReport",
      "description": "Get full security dashboard — metrics, threats, blocked IPs, recent events.",
      "endpoint": "GET /api/security/report",
      "auth": "admin_jwt_cookie",
      "output": {
        "counters": "object",
        "rateLimit": "object",
        "bruteForce": "object",
        "anomaly": "object",
        "recentEvents": "array",
        "blockedIps": "array"
      }
    },

    {
      "name": "security.getEvents",
      "description": "Get recent security events, optionally filtered by severity level.",
      "endpoint": "GET /api/security/events?limit=50&level=HIGH",
      "auth": "admin_jwt_cookie",
      "params": {
        "limit": "integer (max 200)",
        "level": "LOW | MEDIUM | HIGH | CRITICAL"
      }
    },

    {
      "name": "security.getAuditLog",
      "description": "Get structured audit log of all recent API requests.",
      "endpoint": "GET /api/security/audit?limit=100",
      "auth": "admin_jwt_cookie"
    },

    {
      "name": "security.getMetrics",
      "description": "Get raw security metric counters.",
      "endpoint": "GET /api/security/metrics",
      "auth": "admin_jwt_cookie"
    },

    {
      "name": "security.blockIp",
      "description": "Block an IP address for a configurable duration.",
      "endpoint": "POST /api/security/block",
      "auth": "admin_jwt_cookie",
      "body": {
        "ip": "string (required)",
        "durationMinutes": "integer (default 60)"
      }
    },

    {
      "name": "security.unblockIp",
      "description": "Unblock a previously blocked IP address.",
      "endpoint": "DELETE /api/security/block/:ip",
      "auth": "admin_jwt_cookie"
    }

  ]
}
```

---

## 5. OWASP API Security Top 10 Coverage

| # | Risk                               | Coverage                                              | Status |
|---|-------------------------------------|-------------------------------------------------------|--------|
| API1 | Broken Object Level Authorization | Per-controller ownership checks + userId binding    | ✅     |
| API2 | Broken Authentication              | JWT + BruteForceGuard + token rotation               | ✅     |
| API3 | Broken Object Property Level Auth  | PII masking in output guardrails                    | ✅     |
| API4 | Unrestricted Resource Consumption  | RateLimiter (global/user/IP/AI) + body size limit   | ✅     |
| API5 | Broken Function Level Authorization| isAdmin middleware + RBAC                           | ✅     |
| API6 | Sensitive Business Flow Abuse      | AnomalyDetector velocity + AI rate limits           | ✅     |
| API7 | Server-Side Request Forgery        | SSRF blocked-host config in security.json           | ✅     |
| API8 | Security Misconfiguration          | SecurityHeaders + removed fingerprinting            | ✅     |
| API9 | Improper Inventory Management      | Path recon detection in AnomalyDetector             | ✅     |
| API10 | Unsafe API Consumption            | Output guardrails validate all AI responses         | ✅     |

---

## 6. OWASP LLM / GenAI Security Coverage

| # | Risk                         | Coverage                                              | Status |
|---|------------------------------|-------------------------------------------------------|--------|
| LLM01 | Prompt Injection        | PromptInjectionGuard + JailbreakDetector             | ✅     |
| LLM02 | Sensitive Info Disclosure| PIIDetector + PiiMasker + SecretDetector             | ✅     |
| LLM03 | Supply Chain            | npm audit in CI (documented)                         | ⚠️    |
| LLM04 | Data + Model Poisoning  | Input validation before storage                      | ✅     |
| LLM05 | Improper Output Handling| JsonValidator + ResponseValidator + TestCaseValidator| ✅     |
| LLM06 | Excessive Agency        | Tool allowlist in allowedTools.json                  | ✅     |
| LLM07 | System Prompt Leakage   | PromptInjectionGuard blocks extraction attempts      | ✅     |
| LLM08 | Vector/Embedding Risks  | Tenant isolation at DB query level                   | ✅     |
| LLM09 | Misinformation          | HallucinationGuard + confidence scoring              | ✅     |
| LLM10 | Unbounded Consumption   | AI rate limit (20 req/min) + TokenLimitGuard         | ✅     |

---

## 7. Agent Security (Zero Trust for AI)

```
AI Agent wants to call a tool
              │
              ▼
     Tool allowed? (allowedTools.json)
              │ NO → BLOCK
              │ YES
              ▼
     User has permission? (RBAC)
              │ NO → 403
              │ YES
              ▼
     Input guardrails pass?
              │ NO → BLOCK + LOG
              │ YES
              ▼
     Rate limit OK?
              │ NO → 429
              │ YES
              ▼
     Execute tool
              │
              ▼
     Output guardrails pass?
              │ NO → SANITISE / BLOCK
              │ YES
              ▼
     Return to agent
```

**Key principle:** The LLM is treated as an untrusted decision-maker.
Every tool call is independently authorized by the security layer,
not by the model's own judgment.

---

## 8. Security API Endpoints

All require `authenticate` + `isAdmin` middleware.

| Method | Endpoint                    | Description                         |
|--------|-----------------------------|-------------------------------------|
| GET    | `/api/security/report`      | Full dashboard snapshot             |
| GET    | `/api/security/events`      | Security event log (filterable)     |
| GET    | `/api/security/audit`       | Request audit log                   |
| GET    | `/api/security/metrics`     | Raw metric counters                 |
| POST   | `/api/security/block`       | Manually block an IP                |
| DELETE | `/api/security/block/:ip`   | Unblock an IP                       |

---

## 9. Configuration (No Code Changes Required)

All thresholds are configurable in `security/config/security.json`:

```jsonc
{
  "rateLimit":  { "perUser": { "maxRequests": 100 } },  // change limit
  "bruteForce": { "maxFailedAttempts": 5 },              // change attempts
  "anomaly":    { "rapidRequestCount": 15 },             // change velocity
  "threats":    { "blockAfterViolations": 10 },          // auto-block threshold
  "headers":    { "frameOptions": "SAMEORIGIN" }         // relax if needed
}
```

Restart server to pick up changes.

---

## 10. Security Testing Scenarios (MCP-driven)

An AI agent can run these test scenarios via MCP tools:

```
SCENARIO: Brute Force Test
  1. POST /api/auth/login × 6 with wrong password
  2. Expected: HTTP 429 on 6th attempt
  3. Verify: security.getEvents(level=HIGH) shows BRUTEFORCE event
  4. Verify: IP locked in security.getReport()

SCENARIO: Rate Limit Test
  1. POST /api/ai/generate × 21 in 60s
  2. Expected: HTTP 429 on 21st request (code: RATE_LIMIT_AI)

SCENARIO: Prompt Injection Test
  1. POST /api/ai/generate with body containing "ignore previous instructions"
  2. Expected: HTTP 400, code: GUARDRAIL_BLOCKED
  3. Verify: security.getEvents shows PROMPTINJECTIONGUARD event

SCENARIO: Path Traversal Test
  1. GET /api/../../../etc/passwd
  2. Expected: HTTP 400, code: ANOMALY_DETECTED

SCENARIO: SQL Injection Test
  1. POST /api/testcases/search with body "ticketKey: ' OR 1=1--"
  2. Expected: HTTP 400, guardrail blocks before DB hit

SCENARIO: Auto-block Test
  1. Trigger 10+ anomalies from same IP
  2. Expected: All subsequent requests return HTTP 403, code: AUTO_BLOCKED
  3. Unblock via: DELETE /api/security/block/{ip}
```

---

## 11. Files Created

```
server/src/security/
├── config/
│   └── security.json          ← master config (all thresholds)
├── RateLimiter.ts             ← OWASP API4
├── BruteForceGuard.ts         ← OWASP API2
├── AnomalyDetector.ts         ← OWASP API6/8/9
├── SecurityHeaders.ts         ← OWASP API8
├── AuditLogger.ts             ← audit trail
├── SecurityLogger.ts          ← threat event log + IP blocking
├── MetricsCollector.ts        ← dashboard counters
└── SecurityPipeline.ts        ← orchestrator (single app.use)

server/src/routes/
└── security.ts                ← /api/security/* (admin only)

server/src/index.ts            ← wired: app.use(securityPipeline)
SecuritySKILL.md               ← this document
```
